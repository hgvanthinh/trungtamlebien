import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    getPigGameSettings,
    updatePigGameSettings,
    getDateKeyVN
} from '../../services/gameSettingsService';
import { getPigLogs } from '../../services/pigService';
import {
    previewWeeklyResults,
    finalizeWeek,
    getWeeklyResultsHistory
} from '../../services/pigWeeklyService';
import { getAllTransfers } from '../../services/transferService';
import Toast from '../../components/common/Toast';

const GRADES = [6, 7, 8, 9, 10, 11, 12];

const LOG_TYPE_LABELS = {
    buy_pig: '🐷 Mua heo',
    buy_food: '🌽 Mua đồ ăn',
    feed_window: '🍽️ Ăn khung giờ',
    feed_extra: '🍽️ Ăn thêm',
    exam_xp: '📝 XP đề thi',
    smash: '🔨 Đập heo',
    weekly_award: '🏆 Thưởng tuần',
    weekly_reset: '♻️ Reset tuần'
};

export default function AdminPigGame() {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('settings');
    const [settings, setSettings] = useState(null);
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    // Chốt tuần
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [finalizing, setFinalizing] = useState(false);
    const [confirmFinalize, setConfirmFinalize] = useState(false);
    const [history, setHistory] = useState([]);

    // Lịch sử
    const [transfers, setTransfers] = useState([]);
    const [transferFilter, setTransferFilter] = useState('');
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const s = await getPigGameSettings(true);
        setSettings(s);
        setForm({
            ...s,
            smashHighChancePct: Math.round(s.smashHighChance * 100)
        });
    };

    useEffect(() => {
        if (activeTab === 'weekly') {
            getWeeklyResultsHistory().then(setHistory).catch(() => { });
        } else if (activeTab === 'transfers') {
            getAllTransfers().then(setTransfers).catch(() => { });
        } else if (activeTab === 'logs') {
            getPigLogs().then(setLogs).catch(() => { });
        }
    }, [activeTab]);

    const handleSaveSettings = async () => {
        try {
            setSaving(true);
            const { smashHighChancePct, ...rest } = form;
            await updatePigGameSettings({
                ...rest,
                pigPrice: Number(form.pigPrice) || 1,
                xpPerLevel: Number(form.xpPerLevel) || 50,
                feedXpMin: Number(form.feedXpMin) || 1,
                feedXpMax: Number(form.feedXpMax) || 5,
                maxExtraFeedsPerDay: Number(form.maxExtraFeedsPerDay) || 2,
                smashHighChance: Math.min(100, Math.max(0, Number(smashHighChancePct) || 75)) / 100,
                smashHighGold: Number(form.smashHighGold) || 10,
                smashLowGold: Number(form.smashLowGold) || 5,
                transferDailyLimit: Number(form.transferDailyLimit) || 3,
                transferMaxAmount: Number(form.transferMaxAmount) || 0,
                smashTopNByGrade: Object.fromEntries(
                    Object.entries(form.smashTopNByGrade).map(([g, n]) => [g, Number(n) || 0])
                )
            });
            await loadSettings();
            setToast({ type: 'success', message: 'Đã lưu cài đặt game heo đất!' });
        } catch (error) {
            setToast({ type: 'error', message: 'Lỗi khi lưu: ' + error.message });
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = async () => {
        try {
            setPreviewLoading(true);
            const s = await getPigGameSettings(true);
            setSettings(s);
            const p = await previewWeeklyResults(s);
            setPreview(p);
        } catch (error) {
            setToast({ type: 'error', message: 'Lỗi xem trước: ' + error.message });
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleFinalize = async () => {
        setConfirmFinalize(false);
        try {
            setFinalizing(true);
            const result = await finalizeWeek(preview, currentUser.uid);
            setToast({
                type: 'success',
                message: `✅ Đã chốt tuần ${result.weekId}: ${result.winnersCount} HS được lượt đập, ${result.pigsReset} heo về cấp 1. Tuần mới: ${result.nextWeekId}`
            });
            setPreview(null);
            await loadSettings();
            getWeeklyResultsHistory().then(setHistory).catch(() => { });
        } catch (error) {
            setToast({ type: 'error', message: error.message });
        } finally {
            setFinalizing(false);
        }
    };

    const updateWindow = (index, field, value) => {
        const windows = form.feedingWindows.map((w, i) => i === index ? { ...w, [field]: value } : w);
        setForm({ ...form, feedingWindows: windows });
    };

    if (!form) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    const filteredTransfers = transfers.filter(t =>
        !transferFilter ||
        t.fromName?.toLowerCase().includes(transferFilter.toLowerCase()) ||
        t.toName?.toLowerCase().includes(transferFilter.toLowerCase())
    );

    const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
    const labelCls = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1";

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">🐷 Heo Đất - Quản lý Game</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Cài đặt luật chơi, chốt tuần, theo dõi giao dịch và nhật ký
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {[
                    { id: 'settings', label: '⚙️ Cài đặt' },
                    { id: 'weekly', label: '🏁 Chốt tuần' },
                    { id: 'transfers', label: '💸 Chuyển khoản' },
                    { id: 'logs', label: '📋 Nhật ký heo' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2.5 rounded-xl font-bold transition-colors ${activeTab === tab.id
                            ? 'bg-pink-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ===== TAB: CÀI ĐẶT ===== */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Heo & XP</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className={labelCls}>Giá heo (vàng)</label>
                                <input type="number" min="0" className={inputCls} value={form.pigPrice}
                                    onChange={e => setForm({ ...form, pigPrice: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>XP để lên 1 cấp</label>
                                <input type="number" min="1" className={inputCls} value={form.xpPerLevel}
                                    onChange={e => setForm({ ...form, xpPerLevel: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>XP cho ăn (min)</label>
                                <input type="number" min="1" className={inputCls} value={form.feedXpMin}
                                    onChange={e => setForm({ ...form, feedXpMin: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>XP cho ăn (max)</label>
                                <input type="number" min="1" className={inputCls} value={form.feedXpMax}
                                    onChange={e => setForm({ ...form, feedXpMax: e.target.value })} />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                            💡 Giá thức ăn heo chỉnh ở <b>Quản lý Cửa Hàng</b> (món loại "Thức ăn heo", tính bằng Xu).
                        </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Khung giờ cho ăn</h3>
                        <div className="space-y-3">
                            {form.feedingWindows.map((w, i) => (
                                <div key={w.id} className="flex items-center gap-3">
                                    <input type="text" className={`${inputCls} w-28`} value={w.label || w.id}
                                        onChange={e => updateWindow(i, 'label', e.target.value)} />
                                    <input type="time" className={`${inputCls} w-36`} value={w.start}
                                        onChange={e => updateWindow(i, 'start', e.target.value)} />
                                    <span className="text-gray-500">→</span>
                                    <input type="time" className={`${inputCls} w-36`} value={w.end}
                                        onChange={e => updateWindow(i, 'end', e.target.value)} />
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 w-64">
                            <label className={labelCls}>Lượt cho ăn thêm/ngày (ngoài khung)</label>
                            <input type="number" min="0" className={inputCls} value={form.maxExtraFeedsPerDay}
                                onChange={e => setForm({ ...form, maxExtraFeedsPerDay: e.target.value })} />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Đập heo đất 🔨</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className={labelCls}>Tỉ lệ trúng mức cao (%)</label>
                                <input type="number" min="0" max="100" className={inputCls} value={form.smashHighChancePct}
                                    onChange={e => setForm({ ...form, smashHighChancePct: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>Vàng mức cao</label>
                                <input type="number" min="0" className={inputCls} value={form.smashHighGold}
                                    onChange={e => setForm({ ...form, smashHighGold: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>Vàng mức thấp</label>
                                <input type="number" min="0" className={inputCls} value={form.smashLowGold}
                                    onChange={e => setForm({ ...form, smashLowGold: e.target.value })} />
                            </div>
                        </div>
                        <label className={labelCls}>Số heo top mỗi khối được +1 lượt đập cuối tuần</label>
                        <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                            {GRADES.map(g => (
                                <div key={g}>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 text-center mb-1">Khối {g}</label>
                                    <input
                                        type="number" min="0"
                                        className={`${inputCls} text-center`}
                                        value={form.smashTopNByGrade[g] ?? ''}
                                        onChange={e => setForm({
                                            ...form,
                                            smashTopNByGrade: { ...form.smashTopNByGrade, [g]: e.target.value }
                                        })}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Chuyển Xu/Vàng giữa HS</h3>
                        <div className="grid grid-cols-2 gap-4 max-w-xl">
                            <div>
                                <label className={labelCls}>Số lần chuyển tối đa/ngày</label>
                                <input type="number" min="0" className={inputCls} value={form.transferDailyLimit}
                                    onChange={e => setForm({ ...form, transferDailyLimit: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>Tối đa mỗi lần (0 = không giới hạn)</label>
                                <input type="number" min="0" className={inputCls} value={form.transferMaxAmount}
                                    onChange={e => setForm({ ...form, transferMaxAmount: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="px-8 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-bold shadow disabled:opacity-50"
                    >
                        {saving ? 'Đang lưu...' : '💾 Lưu cài đặt'}
                    </button>
                </div>
            )}

            {/* ===== TAB: CHỐT TUẦN ===== */}
            {activeTab === 'weekly' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                                    Tuần hiện tại: <span className="text-pink-500">{settings?.currentWeekId}</span>
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Chốt tuần: top khối nhận lượt đập heo, TẤT CẢ heo về cấp 1 / 0 XP
                                </p>
                            </div>
                            <button
                                onClick={handlePreview}
                                disabled={previewLoading}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50"
                            >
                                {previewLoading ? 'Đang tính...' : '👁️ Xem trước kết quả'}
                            </button>
                        </div>

                        {preview && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                                    Tổng <b>{preview.totalPigs}</b> heo sẽ reset về cấp 1. Danh sách nhận +1 lượt đập:
                                </p>
                                {Object.keys(preview.grades).length === 0 ? (
                                    <p className="text-gray-500 italic">Chưa có heo nào trong hệ thống.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {Object.keys(preview.grades).sort((a, b) => Number(b) - Number(a)).map(g => (
                                            <div key={g} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                                                <h4 className="font-bold text-gray-900 dark:text-white mb-2">
                                                    Khối {g} — {preview.grades[g].totalPigs} heo, top {preview.grades[g].smashWinners.length} được đập:
                                                </h4>
                                                {preview.grades[g].smashWinners.length === 0 ? (
                                                    <p className="text-sm text-gray-500 italic">Không có heo</p>
                                                ) : (
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="text-left text-gray-500 dark:text-gray-400">
                                                                <th className="py-1">#</th>
                                                                <th>Học sinh</th>
                                                                <th>Cấp</th>
                                                                <th>XP</th>
                                                                <th>Thưởng</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="text-gray-900 dark:text-white">
                                                            {preview.grades[g].smashWinners.map(w => (
                                                                <tr key={w.uid} className="border-t border-gray-200 dark:border-gray-600">
                                                                    <td className="py-1.5 font-bold">{w.rank}</td>
                                                                    <td>{w.name}</td>
                                                                    <td>Cấp {w.level}</td>
                                                                    <td>{w.xp}</td>
                                                                    <td>🔨 +1 lượt đập</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={() => setConfirmFinalize(true)}
                                    disabled={finalizing}
                                    className="mt-4 px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold disabled:opacity-50"
                                >
                                    {finalizing ? 'Đang chốt...' : `🏁 CHỐT TUẦN ${preview.weekId}`}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Lịch sử các tuần */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">📜 Các tuần đã chốt</h3>
                        {history.length === 0 ? (
                            <p className="text-gray-500 italic">Chưa chốt tuần nào.</p>
                        ) : (
                            <div className="space-y-3">
                                {history.map(week => (
                                    <div key={week.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                                        <p className="font-bold text-gray-900 dark:text-white mb-1">
                                            Tuần {week.weekId} — {week.totalPigsReset} heo reset
                                            <span className="text-xs text-gray-500 ml-2">
                                                {week.finalizedAt?.toDate?.()?.toLocaleString('vi-VN')}
                                            </span>
                                        </p>
                                        <div className="text-sm text-gray-600 dark:text-gray-300">
                                            {Object.keys(week.grades || {}).sort((a, b) => Number(b) - Number(a)).map(g => (
                                                <p key={g}>
                                                    <b>Khối {g}:</b>{' '}
                                                    {week.grades[g].smashWinners?.map(w => `${w.name} (cấp ${w.level})`).join(', ') || '—'}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== TAB: CHUYỂN KHOẢN ===== */}
            {activeTab === 'transfers' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">💸 Lịch sử chuyển Xu/Vàng</h3>
                        <input
                            type="text"
                            placeholder="Lọc theo tên HS..."
                            value={transferFilter}
                            onChange={e => setTransferFilter(e.target.value)}
                            className={`${inputCls} max-w-xs`}
                        />
                    </div>
                    {filteredTransfers.length === 0 ? (
                        <p className="text-gray-500 italic">Chưa có giao dịch nào.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                        <th className="py-2">Thời gian</th>
                                        <th>Người gửi</th>
                                        <th>Người nhận</th>
                                        <th>Loại</th>
                                        <th className="text-right">Số lượng</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-900 dark:text-white">
                                    {filteredTransfers.map(t => (
                                        <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700/50">
                                            <td className="py-2 text-gray-500 dark:text-gray-400">
                                                {t.createdAt?.toDate?.()?.toLocaleString('vi-VN') || '—'}
                                            </td>
                                            <td>{t.fromName}</td>
                                            <td>{t.toName}</td>
                                            <td>{t.currency === 'coins' ? '🪙 Xu' : '🥇 Vàng'}</td>
                                            <td className="text-right font-bold">{t.amount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ===== TAB: NHẬT KÝ ===== */}
            {activeTab === 'logs' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">📋 Nhật ký game heo (200 gần nhất)</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Dòng <span className="bg-red-100 dark:bg-red-900/40 px-1 rounded">đỏ</span>: ngày trên máy HS khác ngày server → nghi chỉnh giờ máy để gian lận khung giờ cho ăn.
                    </p>
                    {logs.length === 0 ? (
                        <p className="text-gray-500 italic">Chưa có hoạt động nào.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                        <th className="py-2">Thời gian (server)</th>
                                        <th>Học sinh</th>
                                        <th>Hành động</th>
                                        <th>Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-900 dark:text-white">
                                    {logs.map(log => {
                                        const serverDate = log.createdAt?.toDate?.();
                                        const mismatch = serverDate && log.dateKey && getDateKeyVN(serverDate) !== log.dateKey;
                                        return (
                                            <tr
                                                key={log.id}
                                                className={`border-b border-gray-100 dark:border-gray-700/50 ${mismatch ? 'bg-red-100 dark:bg-red-900/40' : ''}`}
                                            >
                                                <td className="py-2 text-gray-500 dark:text-gray-400">
                                                    {serverDate?.toLocaleString('vi-VN') || '—'}
                                                    {mismatch && <span className="ml-1 text-red-500 font-bold" title={`Máy HS: ${log.dateKey}`}>⚠️</span>}
                                                </td>
                                                <td>{log.userName || log.uid}</td>
                                                <td>{LOG_TYPE_LABELS[log.type] || log.type}</td>
                                                <td className="text-xs text-gray-500 dark:text-gray-400">
                                                    {JSON.stringify(log.detail)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modal xác nhận chốt tuần */}
            {confirmFinalize && preview && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                            ⚠️ Xác nhận chốt tuần {preview.weekId}
                        </h3>
                        <ul className="text-gray-600 dark:text-gray-300 text-sm space-y-1 mb-5 list-disc list-inside">
                            <li><b>{Object.values(preview.grades).reduce((s, g) => s + g.smashWinners.length, 0)}</b> HS nhận +1 lượt đập heo</li>
                            <li><b>{preview.totalPigs}</b> heo về cấp 1 / 0 XP</li>
                            <li>Heo top sẽ VỠ khi HS bấm đập (phải mua heo mới)</li>
                            <li className="text-red-500 font-semibold">Không thể hoàn tác!</li>
                        </ul>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmFinalize(false)}
                                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold text-gray-800 dark:text-gray-200"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleFinalize}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
                            >
                                🏁 Chốt tuần
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
