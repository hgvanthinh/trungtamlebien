import { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getPigGameSettings } from '../services/gameSettingsService';
import { getPig, buyPig, buyFood, feedPig, smashPiggy } from '../services/pigService';
import { getPigFoodItem } from '../services/storeService';
import { getStudentGrade } from '../services/leaderboardService';
import { getPigImage } from '../config/pigAssets';
import PigDisplay from '../components/pig/PigDisplay';
import FeedPanel from '../components/pig/FeedPanel';
import SmashPiggy from '../components/pig/SmashPiggy';
import PigLeaderboard from '../components/pig/PigLeaderboard';
import GoldIcon from '../components/common/GoldIcon';
import Toast from '../components/common/Toast';

export default function PigPet() {
    const { userProfile, currentUser, updateUserProfile } = useAuth();
    const [settings, setSettings] = useState(null);
    const [pig, setPig] = useState(null);
    const [foodItem, setFoodItem] = useState(null);
    const [grade, setGrade] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState(null);
    const [xpFloat, setXpFloat] = useState(null);
    const [smashResult, setSmashResult] = useState(null);

    const uid = currentUser?.uid;
    const userName = userProfile?.fullName || '';

    const load = useCallback(async () => {
        if (!uid) return;
        try {
            setLoading(true);
            const [s, p, f, g] = await Promise.all([
                getPigGameSettings(),
                getPig(uid),
                getPigFoodItem(),
                getStudentGrade(userProfile?.classes)
            ]);
            setSettings(s);
            setFoodItem(f);
            setGrade(g);

            // Đồng bộ khối của heo nếu HS chuyển lớp (g = 0 nghĩa là chưa có lớp → giữ nguyên)
            if (p && g > 0 && String(p.grade) !== String(g)) {
                updateDoc(doc(db, 'pigs', uid), { grade: g }).catch(() => { });
                p.grade = g;
            }
            setPig(p);
        } catch (error) {
            console.error('Error loading pig page:', error);
            setToast({ type: 'error', message: 'Lỗi khi tải trang heo đất' });
        } finally {
            setLoading(false);
        }
    }, [uid, userProfile?.classes]);

    useEffect(() => { load(); }, [load]);

    const handleBuyPig = async () => {
        try {
            setBusy(true);
            const result = await buyPig(uid, userName, grade, settings);
            updateUserProfile({ gold: result.newGold, pigLevel: 1 });
            setToast({ type: 'success', message: '🐷 Chúc mừng! Bạn đã có heo đất. Hãy cho heo ăn để lên cấp nhé!' });
            await load();
        } catch (error) {
            setToast({ type: 'error', message: error.message });
        } finally {
            setBusy(false);
        }
    };

    const handleFeed = async () => {
        try {
            setBusy(true);
            const result = await feedPig(uid, userName);
            setPig(prev => ({
                ...prev,
                xp: result.newXp,
                level: result.newLevel,
                food: result.newFood,
                // cập nhật local để FeedPanel tính lượt còn lại đúng (load lại từ server khi refresh)
            }));
            setXpFloat({ key: Date.now(), amount: result.xpGained });
            setTimeout(() => setXpFloat(null), 1800);
            if (result.leveledUp) {
                updateUserProfile({ pigLevel: result.newLevel });
                setToast({ type: 'success', message: `🎉 Heo lên CẤP ${result.newLevel}! Heo to hơn rồi!` });
            }
            // Đồng bộ lại windowFeeds/extraFeeds từ server
            getPig(uid).then(p => p && setPig(p)).catch(() => { });
        } catch (error) {
            setToast({ type: 'error', message: error.message });
        } finally {
            setBusy(false);
        }
    };

    const handleBuyFood = async (quantity, item) => {
        try {
            setBusy(true);
            const result = await buyFood(uid, userName, quantity, item.price);
            updateUserProfile({ coins: result.newCoins });
            setPig(prev => ({ ...prev, food: result.newFood }));
            setToast({ type: 'success', message: `🌽 Đã mua ${quantity} thức ăn cho heo!` });
        } catch (error) {
            setToast({ type: 'error', message: error.message });
        } finally {
            setBusy(false);
        }
    };

    const handleSmash = async () => {
        try {
            setBusy(true);
            const result = await smashPiggy(uid, userName, settings);
            updateUserProfile({ gold: result.newGold, smashAttempts: result.attemptsLeft, pigLevel: 0 });
            setPig(null);
            setSmashResult(result);
        } catch (error) {
            setToast({ type: 'error', message: error.message });
        } finally {
            setBusy(false);
        }
    };

    if (loading || !settings) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="text-5xl mb-4 animate-bounce">🐷</div>
                    <p className="text-gray-600 dark:text-gray-400">Đang tải heo đất...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">🐷 Nuôi Heo Đất</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Cho heo ăn đúng giờ, dạy heo học để lên cấp — cuối tuần top khối được đập heo lấy vàng!
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-6">
                    {pig ? (
                        <>
                            <PigDisplay pig={pig} settings={settings} xpFloat={xpFloat} />
                            <SmashPiggy
                                smashAttempts={userProfile?.smashAttempts || 0}
                                settings={settings}
                                onSmash={handleSmash}
                                busy={busy}
                            />
                            <FeedPanel
                                pig={pig}
                                settings={settings}
                                foodItem={foodItem}
                                userCoins={userProfile?.coins || 0}
                                onFeed={handleFeed}
                                onBuyFood={handleBuyFood}
                                busy={busy}
                            />
                        </>
                    ) : !grade ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
                            <img src={getPigImage(1)} alt="Heo đất" className="w-44 mx-auto mb-4 opacity-40 grayscale" />
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Chưa thể nuôi heo đất
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400">
                                Bạn chưa được xếp vào lớp nào. Heo đất xếp hạng theo khối, nên bạn cần
                                được giáo viên thêm vào lớp trước khi mua heo.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
                            <img src={getPigImage(1)} alt="Heo đất" className="w-44 mx-auto mb-4 opacity-90" />
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Bạn chưa có heo đất!
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-5">
                                Mua heo để bắt đầu nuôi — cho ăn, làm đề kiểm tra để heo lên cấp,
                                cuối tuần lọt top khối sẽ được đập heo nhận Đồng Vàng!
                            </p>
                            <div className="flex items-center justify-center gap-2 mb-5 text-lg">
                                <span className="text-gray-600 dark:text-gray-300">Giá:</span>
                                <GoldIcon size={22} />
                                <b className="text-gray-900 dark:text-white">{settings.pigPrice} Đồng Vàng</b>
                                <span className="text-gray-400 text-sm">
                                    (bạn có {userProfile?.gold || 0})
                                </span>
                            </div>
                            <button
                                onClick={handleBuyPig}
                                disabled={busy || (userProfile?.gold || 0) < settings.pigPrice}
                                className={`px-8 py-3 rounded-xl font-bold text-lg transition-all ${(userProfile?.gold || 0) >= settings.pigPrice && !busy
                                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white transform hover:scale-105 shadow-lg'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {busy ? 'Đang mua...' : (userProfile?.gold || 0) >= settings.pigPrice ? '🐷 Mua heo ngay!' : 'Không đủ Đồng Vàng'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2">
                    <PigLeaderboard settings={settings} myUid={uid} myGrade={grade} />
                </div>
            </div>

            {/* Kết quả đập heo */}
            {smashResult && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
                        <div className="text-6xl mb-3">{smashResult.isHigh ? '🎉' : '✨'}</div>
                        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
                            Heo đã vỡ!
                        </h3>
                        <p className="text-lg text-gray-700 dark:text-gray-300 mb-1">Bạn nhận được</p>
                        <p className="text-4xl font-extrabold text-amber-500 mb-4 flex items-center justify-center gap-2">
                            <GoldIcon size={36} /> +{smashResult.goldWon} Vàng
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                            {smashResult.attemptsLeft > 0
                                ? `Bạn còn ${smashResult.attemptsLeft} lượt đập (cần mua heo mới để đập tiếp).`
                                : 'Mua heo mới để tiếp tục nuôi cho tuần sau nhé!'}
                        </p>
                        <button
                            onClick={() => setSmashResult(null)}
                            className="px-8 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-bold hover:from-pink-600 hover:to-rose-600"
                        >
                            Tuyệt vời!
                        </button>
                    </div>
                </div>
            )}

            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}
        </div>
    );
}
