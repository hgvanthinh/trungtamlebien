import { useState, useEffect } from 'react';
import {
    listenToLobby,
    listenToSessionMeta,
    forceFinishMatch,
    closeLobby,
} from '../../services/versusSessionService';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Avatar from '../common/Avatar';

const STATUS_LABELS = {
    waiting: { label: 'Đang chờ', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    in_match: { label: 'Đang đấu', className: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300' },
    done: { label: 'Đã xong', className: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
};

/**
 * Thanh tiến độ đơn giản: score / winSteps
 */
function ProgressBar({ score, winSteps, colorClass }) {
    const percent = Math.min(100, Math.max(0, ((score || 0) / (winSteps || 1)) * 100));
    return (
        <div className="h-2 rounded-full bg-[#f0f5f1] dark:bg-white/10 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}

/**
 * Card 1 trận đang diễn ra — tự listen meta của session (score live).
 */
function MatchCard({ sessionId, gameId }) {
    const [meta, setMeta] = useState(null);
    const [stopping, setStopping] = useState(false);

    useEffect(() => {
        const unsubscribe = listenToSessionMeta(sessionId, setMeta);
        return () => unsubscribe();
    }, [sessionId]);

    if (!meta) {
        return (
            <div className="clay-card p-4 flex items-center justify-center gap-2 text-[#556958] dark:text-[#a5b5a8]">
                <Icon name="progress_activity" size={20} className="animate-spin" />
                <span className="text-sm">Đang tải trận...</span>
            </div>
        );
    }

    const p1 = meta.player1 || {};
    const p2 = meta.player2 || {};
    const winSteps = meta.winSteps || 5;
    const isFinished = meta.status === 'finished';
    const winnerName = isFinished && meta.winner ? meta[meta.winner]?.name : null;

    const handleForceFinish = async () => {
        setStopping(true);
        try {
            await forceFinishMatch(sessionId, gameId);
        } catch (error) {
            console.error('Error force finishing match:', error);
        } finally {
            setStopping(false);
        }
    };

    return (
        <div className={`clay-card p-4 ${isFinished ? 'opacity-60' : ''}`}>
            {/* Header trận */}
            <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isFinished
                    ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                    : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                    }`}>
                    <Icon name={isFinished ? 'flag' : 'swords'} size={14} />
                    {isFinished ? 'Kết thúc' : 'Đang đấu'}
                </span>
                {isFinished ? (
                    winnerName && (
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            🏆 {winnerName} thắng
                        </span>
                    )
                ) : (
                    <button
                        onClick={handleForceFinish}
                        disabled={stopping}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                        <Icon name={stopping ? 'progress_activity' : 'stop_circle'} size={14} className={stopping ? 'animate-spin' : ''} />
                        Kết thúc trận
                    </button>
                )}
            </div>

            {/* Đấu thủ 1 */}
            <div className="mb-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={p1.name} size="xs" lazy={false} />
                        <span className="font-bold text-sm text-[#111812] dark:text-white truncate">
                            {p1.name || '?'}
                        </span>
                    </div>
                    <span className="text-sm font-extrabold text-red-500 shrink-0">{p1.score || 0}/{winSteps}</span>
                </div>
                <ProgressBar score={p1.score} winSteps={winSteps} colorClass="bg-red-400" />
            </div>

            {/* Đấu thủ 2 */}
            <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={p2.name} size="xs" lazy={false} />
                        <span className="font-bold text-sm text-[#111812] dark:text-white truncate">
                            {p2.name || '?'}
                        </span>
                    </div>
                    <span className="text-sm font-extrabold text-blue-500 shrink-0">{p2.score || 0}/{winSteps}</span>
                </div>
                <ProgressBar score={p2.score} winSteps={winSteps} colorClass="bg-blue-400" />
            </div>
        </div>
    );
}

/**
 * VersusSpectator — GV/Admin xem trực tiếp phòng "Đấu Trí 1v1":
 * danh sách HS trong phòng + score live các trận đang diễn ra.
 */
export default function VersusSpectator({ gameId, gameTitle, onClose }) {
    const { currentUser } = useAuth();
    const { showConfirm, ConfirmDialog } = useConfirm();
    const [lobby, setLobby] = useState(null);
    const [loading, setLoading] = useState(true);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (!gameId) return;
        const unsubscribe = listenToLobby(gameId, (data) => {
            setLobby(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [gameId]);

    const handleCloseLobby = () => {
        showConfirm({
            title: 'Đóng phòng đấu?',
            message: 'Học sinh sẽ không thể vào phòng và ghép trận mới nữa. Các trận đang diễn ra nên được kết thúc trước.',
            confirmText: 'Đóng phòng',
            cancelText: 'Hủy',
            type: 'danger',
            onConfirm: async () => {
                setClosing(true);
                try {
                    await closeLobby(gameId, currentUser?.uid);
                    onClose?.();
                } catch (error) {
                    console.error('Error closing lobby:', error);
                } finally {
                    setClosing(false);
                }
            },
        });
    };

    if (loading) {
        return (
            <div className="clay-card p-10 flex items-center justify-center gap-3 text-[#556958] dark:text-[#a5b5a8]">
                <Icon name="progress_activity" size={28} className="animate-spin text-primary" />
                <span className="font-medium">Đang kết nối phòng đấu...</span>
            </div>
        );
    }

    const isOpen = !!lobby && lobby.status === 'open';
    const players = lobby?.players || {};
    const playerEntries = Object.entries(players).sort(
        ([, a], [, b]) => (a.joinedAt || 0) - (b.joinedAt || 0)
    );

    // Gom sessionId duy nhất từ players đang in_match
    const activeSessionIds = [...new Set(
        playerEntries
            .filter(([, p]) => p.status === 'in_match' && p.matchId)
            .map(([, p]) => p.matchId)
    )];

    return (
        <section className="space-y-6 animate-scale-in">
            {/* Header */}
            <div className="clay-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="size-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary-dark dark:text-primary shrink-0">
                            <Icon name="visibility" size={26} filled />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-extrabold text-[#111812] dark:text-white truncate">
                                Xem trực tiếp — {gameTitle || 'Đấu Trí 1v1'}
                            </h2>
                            <span className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${isOpen
                                ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                                : 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300'
                                }`}>
                                <span className={`size-2 rounded-full ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                                {isOpen ? 'Phòng đang mở' : 'Phòng đã đóng'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" icon="arrow_back" onClick={onClose}>
                            Quay lại
                        </Button>
                        {isOpen && (
                            <Button
                                variant="secondary"
                                size="sm"
                                icon="lock"
                                loading={closing}
                                onClick={handleCloseLobby}
                                className="!text-red-600 dark:!text-red-400"
                            >
                                Đóng phòng
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Danh sách HS trong phòng */}
            <div className="clay-card p-5">
                <h3 className="flex items-center gap-2 text-base font-bold text-[#111812] dark:text-white mb-4">
                    <Icon name="groups" size={22} className="text-primary-dark dark:text-primary" filled />
                    Học sinh trong phòng ({playerEntries.length})
                </h3>
                {playerEntries.length === 0 ? (
                    <div className="py-8 text-center text-[#556958] dark:text-[#a5b5a8]">
                        <Icon name="hourglass_empty" size={36} className="mb-2 opacity-60" />
                        <p className="font-medium">Chưa có học sinh nào vào phòng.</p>
                        <p className="text-sm mt-1">Hãy chia sẻ phòng đấu để các em tham gia nhé!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {playerEntries.map(([uid, p]) => {
                            const status = STATUS_LABELS[p.status] || STATUS_LABELS.waiting;
                            return (
                                <div
                                    key={uid}
                                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#f0f5f1] dark:bg-white/5"
                                >
                                    <Avatar name={p.name} src={p.avatar} size="sm" lazy={false} />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-sm text-[#111812] dark:text-white truncate">
                                            {p.name || 'Học sinh'}
                                        </p>
                                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${status.className}`}>
                                            {status.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Các trận đang diễn ra */}
            <div className="clay-card p-5">
                <h3 className="flex items-center gap-2 text-base font-bold text-[#111812] dark:text-white mb-4">
                    <Icon name="swords" size={22} className="text-red-500" filled />
                    Trận đang diễn ra ({activeSessionIds.length})
                </h3>
                {activeSessionIds.length === 0 ? (
                    <div className="py-8 text-center text-[#556958] dark:text-[#a5b5a8]">
                        <Icon name="sports_esports" size={36} className="mb-2 opacity-60" />
                        <p className="font-medium">Chưa có trận nào đang diễn ra.</p>
                        <p className="text-sm mt-1">Khi hai học sinh thách đấu nhau, trận sẽ hiện ở đây.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {activeSessionIds.map((sessionId) => (
                            <MatchCard key={sessionId} sessionId={sessionId} gameId={gameId} />
                        ))}
                    </div>
                )}
            </div>

            <ConfirmDialog />
        </section>
    );
}
