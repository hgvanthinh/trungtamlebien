import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getPigGameSettings } from '../services/gameSettingsService';
import { transferCurrency, getTransfersLeftToday, getMyTransfers, isAccountApproved } from '../services/transferService';
import Avatar from '../components/common/Avatar';
import CoinIcon from '../components/common/CoinIcon';
import GoldIcon from '../components/common/GoldIcon';
import Toast from '../components/common/Toast';

export default function Transfer() {
    const { userProfile, currentUser, updateUserProfile } = useAuth();
    const [settings, setSettings] = useState(null);
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState('');
    const [recipient, setRecipient] = useState(null);
    const [currency, setCurrency] = useState('coins');
    const [amount, setAmount] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toast, setToast] = useState(null);

    const uid = currentUser?.uid;

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [s, studentsSnap, myHistory] = await Promise.all([
                    getPigGameSettings(),
                    getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
                    getMyTransfers(uid)
                ]);
                setSettings(s);
                setStudents(
                    studentsSnap.docs
                        .map(d => ({ uid: d.id, fullName: d.data().fullName, username: d.data().username, avatar: d.data().avatar, approved: isAccountApproved(d.data()) }))
                        .filter(st => st.uid !== uid && st.approved)
                        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'vi'))
                );
                setHistory(myHistory);
            } catch (error) {
                console.error('Error loading transfer page:', error);
                setToast({ type: 'error', message: 'Lỗi khi tải trang chuyển khoản' });
            } finally {
                setLoading(false);
            }
        };
        if (uid) load();
    }, [uid]);

    const transfersLeft = settings ? getTransfersLeftToday(userProfile, settings) : 0;
    const amountNum = parseInt(amount, 10) || 0;
    const balance = currency === 'coins' ? (userProfile?.coins || 0) : (userProfile?.gold || 0);
    const selfApproved = isAccountApproved(userProfile);
    const canSend = selfApproved && recipient && amountNum > 0 && amountNum <= balance && transfersLeft > 0
        && (!settings?.transferMaxAmount || amountNum <= settings.transferMaxAmount);

    const handleSend = async () => {
        setConfirmOpen(false);
        try {
            setSending(true);
            const result = await transferCurrency({
                fromUid: uid,
                fromName: userProfile?.fullName || '',
                toUid: recipient.uid,
                toName: recipient.fullName || '',
                currency,
                amount: amountNum,
                settings
            });
            updateUserProfile({
                [currency]: result.newBalance,
                transferStats: { dateKey: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()), count: settings.transferDailyLimit - result.transfersLeft }
            });
            setToast({
                type: 'success',
                message: `✅ Đã chuyển ${amountNum} ${currency === 'coins' ? 'Xu' : 'Vàng'} cho ${recipient.fullName}! Còn ${result.transfersLeft} lượt hôm nay.`
            });
            setAmount('');
            setRecipient(null);
            getMyTransfers(uid).then(setHistory).catch(() => { });
        } catch (error) {
            setToast({ type: 'error', message: error.message });
        } finally {
            setSending(false);
        }
    };

    if (loading || !settings) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const filteredStudents = students.filter(st =>
        !search ||
        st.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        st.username?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">💸 Chuyển Xu / Vàng</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Chuyển Xu hoặc Đồng Vàng cho bạn bè — tối đa {settings.transferDailyLimit} lần/ngày
                    {settings.transferMaxAmount > 0 && `, mỗi lần tối đa ${settings.transferMaxAmount}`}
                </p>
            </div>

            {!selfApproved && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-300 font-semibold">
                    ⚠️ Tài khoản của bạn chưa được admin duyệt nên chưa thể chuyển hoặc nhận Xu/Vàng. Vui lòng liên hệ giáo viên.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form chuyển */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Chuyển tiền</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${transfersLeft > 0
                            ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                            }`}>
                            Còn {transfersLeft}/{settings.transferDailyLimit} lượt hôm nay
                        </span>
                    </div>

                    {/* Chọn loại tiền */}
                    <div className="flex gap-3 mb-4">
                        <button
                            onClick={() => setCurrency('coins')}
                            className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 border-2 ${currency === 'coins'
                                ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                : 'border-gray-200 dark:border-gray-600 text-gray-500'
                                }`}
                        >
                            <CoinIcon size={18} /> Xu ({userProfile?.coins || 0})
                        </button>
                        <button
                            onClick={() => setCurrency('gold')}
                            className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 border-2 ${currency === 'gold'
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'border-gray-200 dark:border-gray-600 text-gray-500'
                                }`}
                        >
                            <GoldIcon size={18} /> Vàng ({userProfile?.gold || 0})
                        </button>
                    </div>

                    {/* Số lượng */}
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Số lượng</label>
                    <input
                        type="number"
                        min="1"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="Nhập số lượng..."
                        className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold text-lg mb-1"
                    />
                    {amountNum > balance && (
                        <p className="text-red-500 text-sm mb-2">Không đủ {currency === 'coins' ? 'Xu' : 'Vàng'}!</p>
                    )}

                    {/* Người nhận */}
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 mt-3">
                        Người nhận {recipient && <span className="text-green-600">— {recipient.fullName}</span>}
                    </label>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm theo tên hoặc username..."
                        className="w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
                    />
                    <div className="max-h-56 overflow-y-auto space-y-1 mb-4 border border-gray-100 dark:border-gray-700 rounded-xl p-2">
                        {filteredStudents.slice(0, 30).map(st => (
                            <button
                                key={st.uid}
                                onClick={() => setRecipient(st)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${recipient?.uid === st.uid
                                    ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <Avatar src={st.avatar} name={st.fullName} size="sm" />
                                <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-white truncate">{st.fullName}</p>
                                    <p className="text-xs text-gray-500">{st.username}</p>
                                </div>
                            </button>
                        ))}
                        {filteredStudents.length === 0 && (
                            <p className="text-gray-500 text-sm text-center py-4">Không tìm thấy học sinh</p>
                        )}
                    </div>

                    <button
                        onClick={() => setConfirmOpen(true)}
                        disabled={!canSend || sending}
                        className={`w-full py-3 rounded-xl font-bold text-lg ${canSend && !sending
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {transfersLeft <= 0 ? '⏰ Hết lượt hôm nay' : sending ? 'Đang chuyển...' : '💸 Chuyển ngay'}
                    </button>
                </div>

                {/* Lịch sử */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">📜 Lịch sử của bạn</h3>
                    {history.length === 0 ? (
                        <p className="text-gray-500 italic">Chưa có giao dịch nào.</p>
                    ) : (
                        <div className="space-y-2 max-h-[480px] overflow-y-auto">
                            {history.map(t => (
                                <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                    <span className="text-xl">{t.direction === 'sent' ? '📤' : '📥'}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                            {t.direction === 'sent' ? `Gửi cho ${t.toName}` : `Nhận từ ${t.fromName}`}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {t.createdAt?.toDate?.()?.toLocaleString('vi-VN') || ''}
                                        </p>
                                    </div>
                                    <span className={`font-bold ${t.direction === 'sent' ? 'text-red-500' : 'text-green-500'}`}>
                                        {t.direction === 'sent' ? '−' : '+'}{t.amount} {t.currency === 'coins' ? 'Xu' : 'Vàng'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal xác nhận */}
            {confirmOpen && recipient && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Xác nhận chuyển</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-2">
                            Chuyển <b className="text-gray-900 dark:text-white">{amountNum} {currency === 'coins' ? 'Xu' : 'Đồng Vàng'}</b> cho{' '}
                            <b className="text-gray-900 dark:text-white">{recipient.fullName}</b>?
                        </p>
                        <p className="text-red-500 text-sm font-semibold mb-5">⚠️ Không thể hoàn tác sau khi chuyển!</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmOpen(false)}
                                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold text-gray-800 dark:text-gray-200"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={sending}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:opacity-50"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
