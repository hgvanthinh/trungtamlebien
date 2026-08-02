import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllPigs } from '../../services/pigService';
import { getLatestWeeklyResult } from '../../services/pigWeeklyService';
import { getPigImage } from '../../config/pigAssets';

// Khóa nút "Tải lại" sau mỗi lần bấm để tránh HS bấm liên tục làm tốn lượt đọc Firestore
const RELOAD_COOLDOWN_SEC = 15;

const formatTime = (date) =>
    date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * Bảng xếp hạng heo theo khối: level → XP → đạt XP trước.
 * Vùng top N (được đập heo cuối tuần) được tô màu.
 *
 * Dữ liệu KHÔNG realtime (tránh listener trên toàn collection pigs): tải khi mở trang,
 * khi HS bấm "Tải lại", và tự động mỗi khi refreshKey đổi (sau hành động của chính HS).
 */
export default function PigLeaderboard({ settings, myUid, myGrade, refreshKey = 0 }) {
    const [pigsByGrade, setPigsByGrade] = useState({});
    const [grades, setGrades] = useState([]);
    const [activeGrade, setActiveGrade] = useState(null);
    const [lastWeek, setLastWeek] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [cooldown, setCooldown] = useState(0);

    // Giữ khối đang xem khi tải lại; chỉ auto-chọn khối ở lần tải đầu
    const activeGradeRef = useRef(null);
    activeGradeRef.current = activeGrade;

    const load = useCallback(async () => {
        try {
            const [pigs, latest] = await Promise.all([getAllPigs(), getLatestWeeklyResult()]);
            const groups = {};
            pigs.forEach(pig => {
                const g = pig.grade ?? 0;
                if (!groups[g]) groups[g] = [];
                groups[g].push(pig);
            });
            const gradeList = Object.keys(groups).map(Number).sort((a, b) => b - a);
            setPigsByGrade(groups);
            setGrades(gradeList);
            setActiveGrade(prev =>
                prev !== null && gradeList.includes(prev)
                    ? prev
                    : (gradeList.includes(myGrade) ? myGrade : gradeList[0] ?? null)
            );
            setLastWeek(latest);
            setUpdatedAt(new Date());
        } catch (error) {
            console.error('Error loading pig leaderboard:', error);
        }
    }, [myGrade]);

    // Tải lần đầu + tự tải lại sau hành động của HS (cho ăn, mua/đập heo, nộp bài)
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setRefreshing(true);
            await load();
            if (!cancelled) setRefreshing(false);
            if (!cancelled) setLoading(false);
        };
        run();
        return () => { cancelled = true; };
    }, [load, refreshKey]);

    // Đếm ngược cooldown của nút bấm tay
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleManualReload = async () => {
        if (cooldown > 0 || refreshing) return;
        setRefreshing(true);
        await load();
        setRefreshing(false);
        setCooldown(RELOAD_COOLDOWN_SEC);
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center text-gray-500">
                Đang tải bảng xếp hạng heo...
            </div>
        );
    }

    const pigs = pigsByGrade[activeGrade] || [];
    const topN = settings.smashTopNByGrade?.[activeGrade] ?? 3;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        🏆 Bảng xếp hạng Heo theo khối
                    </h3>
                    {updatedAt && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Cập nhật lúc {formatTime(updatedAt)}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleManualReload}
                    disabled={cooldown > 0 || refreshing}
                    title={cooldown > 0 ? `Chờ ${cooldown}s rồi tải lại được` : 'Tải lại bảng xếp hạng'}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${cooldown > 0 || refreshing
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900/70'
                        }`}
                >
                    {refreshing ? '⏳ Đang tải...' : cooldown > 0 ? `🔄 ${cooldown}s` : '🔄 Tải lại'}
                </button>
            </div>

            {/* Tabs khối */}
            {grades.length > 0 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                    {grades.map(g => (
                        <button
                            key={g}
                            onClick={() => setActiveGrade(g)}
                            className={`px-4 py-1.5 rounded-full font-bold text-sm transition-colors ${activeGrade === g
                                ? 'bg-pink-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                        >
                            Khối {g || '?'}
                        </button>
                    ))}
                </div>
            )}

            {pigs.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                    Khối này chưa có heo nào. Hãy là người đầu tiên! 🐷
                </p>
            ) : (
                <>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Top <b>{topN}</b> của khối cuối tuần sẽ được +1 lượt đập heo lấy vàng 🔨
                    </p>
                    <div className="space-y-2">
                        {pigs.map((pig, index) => {
                            const rank = index + 1;
                            const inTop = rank <= topN;
                            const isMine = pig.ownerUid === myUid;
                            return (
                                <div
                                    key={pig.id}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-xl border-2 ${isMine
                                        ? 'border-pink-400 bg-pink-50 dark:bg-pink-950'
                                        : inTop
                                            ? 'border-amber-300 bg-amber-50 dark:bg-amber-950'
                                            : 'border-transparent bg-gray-50 dark:bg-gray-700/50'
                                        }`}
                                >
                                    <span className={`w-8 text-center font-extrabold ${rank === 1 ? 'text-amber-500 text-lg' : rank <= 3 ? 'text-gray-500' : 'text-gray-400'
                                        }`}>
                                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                                    </span>
                                    <img src={getPigImage(pig.level)} alt="" className="w-9 h-9 object-contain" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-900 dark:text-white truncate">
                                            {pig.ownerName || 'HS'} {isMine && <span className="text-pink-500 text-xs">(bạn)</span>}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-pink-600 dark:text-pink-400 text-sm">Cấp {pig.level || 1}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{pig.xp || 0} XP</p>
                                    </div>
                                    {inTop && <span title="Trong top được đập heo">🔨</span>}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Kết quả tuần trước */}
            {lastWeek?.grades && (
                <div className="mt-5 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-2">
                        📜 Tuần trước ({lastWeek.weekId}) — được đập heo:
                    </h4>
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        {Object.keys(lastWeek.grades)
                            .sort((a, b) => Number(b) - Number(a))
                            .map(g => (
                                <p key={g}>
                                    <b>Khối {g}:</b>{' '}
                                    {lastWeek.grades[g].smashWinners?.length
                                        ? lastWeek.grades[g].smashWinners.map(w => `${w.name} (cấp ${w.level})`).join(', ')
                                        : 'Không có heo'}
                                </p>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}
