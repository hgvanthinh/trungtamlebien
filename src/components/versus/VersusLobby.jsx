import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    listenToLobby,
    listenToLobbyPlayers,
    listenToLobbyChallenges,
    sendChallenge,
    cancelChallenge,
    respondToChallenge,
    updatePlayerStatus,
} from '../../services/versusSessionService';
import { getVersusGame } from '../../services/versusGameService';
import Avatar from '../common/Avatar';
import Icon from '../common/Icon';
import Toast from '../common/Toast';

const STATUS_LABELS = {
    waiting: { text: 'Đang chờ', className: 'bg-primary/15 text-green-700 dark:bg-primary/20 dark:text-primary' },
    in_match: { text: 'Đang thi đấu', className: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' },
    done: { text: 'Đã đấu xong', className: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400' },
};

/**
 * Phòng chờ Đấu Trí 1v1 — HS thách đấu / nhận thách đấu.
 * Cơ chế vào trận (cả 2 client): listener players thấy mình status='in_match' + matchId → onEnterMatch(matchId).
 */
export default function VersusLobby({ gameId, onEnterMatch, onLeave }) {
    const { currentUser, userProfile } = useAuth();
    const uid = currentUser?.uid;
    const myName =
        userProfile?.fullName || userProfile?.displayName || userProfile?.username || 'Học sinh';

    const [gameTitle, setGameTitle] = useState('');
    const [players, setPlayers] = useState({});
    const [lobbyStatus, setLobbyStatus] = useState('open');
    const [connected, setConnected] = useState(false);

    // Challenge state
    const [sentChallengeId, setSentChallengeId] = useState(null);
    const [sentChallengeTo, setSentChallengeTo] = useState(null); // tên người mình thách
    const [incomingChallenge, setIncomingChallenge] = useState(null); // { challengeId, fromName }
    const [responding, setResponding] = useState(false);
    const [toast, setToast] = useState(null);

    // Chống gọi onEnterMatch lặp (listener bắn nhiều lần)
    const enteredMatchRef = useRef(false);
    const sentChallengeIdRef = useRef(null);
    sentChallengeIdRef.current = sentChallengeId;
    const sentChallengeToRef = useRef(null);
    sentChallengeToRef.current = sentChallengeTo;

    // Tên bài đấu (hiển thị header)
    useEffect(() => {
        let cancelled = false;
        getVersusGame(gameId)
            .then((game) => { if (!cancelled && game) setGameTitle(game.title || ''); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [gameId]);

    // Trạng thái phòng: nếu GV đóng phòng → báo + tự rời
    useEffect(() => {
        if (!gameId) return;
        const unsub = listenToLobby(gameId, (lobby) => {
            const status = lobby?.status || null;
            setLobbyStatus(status || 'closed');
        });
        return unsub;
    }, [gameId]);

    // Players node: nguồn chân lý để vào trận (cả người thách lẫn người nhận)
    useEffect(() => {
        if (!gameId || !uid) return;
        enteredMatchRef.current = false;
        const unsub = listenToLobbyPlayers(gameId, (playersData) => {
            setPlayers(playersData || {});
            setConnected(true);

            const me = playersData?.[uid];
            if (me?.status === 'in_match' && me?.matchId && !enteredMatchRef.current) {
                enteredMatchRef.current = true;
                onEnterMatch(me.matchId);
            }
        });
        return unsub;
    }, [gameId, uid]); // eslint-disable-line react-hooks/exhaustive-deps

    // Challenges node: modal nhận thách đấu + theo dõi thách đấu mình gửi
    useEffect(() => {
        if (!gameId || !uid) return;
        const unsub = listenToLobbyChallenges(gameId, (challenges) => {
            const entries = Object.entries(challenges || {});

            // 1. Thách đấu gửi ĐẾN mình đang pending → hiện modal
            const incoming = entries.find(
                ([, c]) => c?.toPlayerId === uid && c?.status === 'pending'
            );
            setIncomingChallenge(
                incoming
                    ? { challengeId: incoming[0], fromName: incoming[1]?.fromName || 'Một bạn' }
                    : null
            );

            // 2. Thách đấu MÌNH gửi (khôi phục sau reload / theo dõi kết quả)
            const myId = sentChallengeIdRef.current;
            if (myId) {
                const mine = challenges?.[myId];
                if (!mine || mine.status === 'cancelled') {
                    setSentChallengeId(null);
                    setSentChallengeTo(null);
                } else if (mine.status === 'rejected') {
                    setToast({
                        type: 'info',
                        message: `${sentChallengeToRef.current || 'Đối thủ'} đã từ chối thách đấu của bạn.`,
                    });
                    setSentChallengeId(null);
                    setSentChallengeTo(null);
                }
                // 'accepted' → không cần xử lý ở đây, listener players sẽ đưa mình vào trận
            } else {
                // Reconnect: tìm lại challenge pending mình đã gửi trước khi reload
                const pendingMine = entries.find(
                    ([, c]) => c?.fromPlayerId === uid && c?.status === 'pending'
                );
                if (pendingMine) setSentChallengeId(pendingMine[0]);
            }
        });
        return unsub;
    }, [gameId, uid]);

    // Phòng bị đóng → thông báo rồi tự rời
    useEffect(() => {
        if (lobbyStatus !== 'closed') return;
        setToast({ type: 'warning', message: 'Thầy cô đã đóng phòng đấu này.' });
        const timer = setTimeout(() => onLeave(), 2000);
        return () => clearTimeout(timer);
    }, [lobbyStatus]); // eslint-disable-line react-hooks/exhaustive-deps

    // ==================== HANDLERS ====================

    const handleChallenge = async (targetId, targetName) => {
        if (sentChallengeId) return;
        try {
            const cId = await sendChallenge(gameId, uid, myName, targetId);
            setSentChallengeId(cId);
            setSentChallengeTo(targetName);
        } catch (err) {
            console.error('[VersusLobby] Challenge error:', err);
            setToast({ type: 'error', message: 'Không gửi được lời thách đấu. Thử lại nhé!' });
        }
    };

    const handleCancelChallenge = async () => {
        if (!sentChallengeId) return;
        try {
            await cancelChallenge(gameId, sentChallengeId);
        } catch (err) {
            console.warn('[VersusLobby] Cancel error:', err);
        }
        setSentChallengeId(null);
        setSentChallengeTo(null);
    };

    const handleAcceptChallenge = async () => {
        if (!incomingChallenge || responding) return;
        try {
            setResponding(true);
            const sessionId = await respondToChallenge(
                gameId,
                incomingChallenge.challengeId,
                true,
                null // service tự đọc doc versusGames
            );
            setIncomingChallenge(null);
            if (sessionId) {
                if (!enteredMatchRef.current) {
                    enteredMatchRef.current = true;
                    onEnterMatch(sessionId);
                }
            } else {
                setToast({ type: 'error', message: 'Không thể bắt đầu trận đấu. Vui lòng thử lại.' });
            }
        } catch (err) {
            console.error('[VersusLobby] Accept error:', err);
            setToast({ type: 'error', message: 'Lỗi khi chấp nhận thách đấu.' });
        } finally {
            setResponding(false);
        }
    };

    const handleRejectChallenge = async () => {
        if (!incomingChallenge) return;
        try {
            await respondToChallenge(gameId, incomingChallenge.challengeId, false, null);
        } catch (err) {
            console.warn('[VersusLobby] Reject error:', err);
        }
        setIncomingChallenge(null);
    };

    const handleReadyAgain = async () => {
        try {
            await updatePlayerStatus(gameId, uid, 'waiting');
        } catch (err) {
            console.error('[VersusLobby] Ready-again error:', err);
            setToast({ type: 'error', message: 'Không cập nhật được trạng thái. Thử lại nhé!' });
        }
    };

    // ==================== RENDER ====================

    const myStatus = players[uid]?.status || 'waiting';
    const otherPlayers = Object.entries(players)
        .filter(([id]) => id !== uid)
        .sort((a, b) => (a[1]?.joinedAt || 0) - (b[1]?.joinedAt || 0));
    const waitingCount = otherPlayers.filter(([, p]) => p?.status === 'waiting').length;

    if (lobbyStatus === 'closed') {
        return (
            <div className="clay-card p-10 text-center animate-slide-up">
                <div className="text-6xl mb-4">🔒</div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Phòng đã đóng</h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Thầy cô đã đóng phòng đấu này. Đang đưa bạn về danh sách phòng...
                </p>
                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-slide-up">
            {/* Header phòng chờ */}
            <div className="clay-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="size-14 rounded-2xl bg-primary/15 dark:bg-primary/20 flex items-center justify-center text-3xl shrink-0">
                            🏟️
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                                {gameTitle || 'Phòng chờ đấu trí'}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {myStatus === 'done' ? (
                                    'Bạn vừa đấu xong một trận!'
                                ) : sentChallengeId ? (
                                    <>Đang chờ <b>{sentChallengeTo || 'đối thủ'}</b> trả lời...</>
                                ) : (
                                    'Đang chờ đối thủ...'
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {myStatus === 'done' && (
                            <button
                                onClick={handleReadyAgain}
                                className="clay-btn-primary inline-flex items-center gap-2 font-bold rounded-2xl px-4 py-3"
                            >
                                <Icon name="swords" />
                                Sẵn sàng đấu tiếp
                            </button>
                        )}
                        <button
                            onClick={onLeave}
                            className="inline-flex items-center gap-2 font-bold rounded-2xl px-4 py-3 bg-white dark:bg-surface-dark text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 shadow-sm transition-all"
                        >
                            <Icon name="logout" />
                            Rời phòng
                        </button>
                    </div>
                </div>

                {/* Banner thách đấu đang gửi */}
                {sentChallengeId && (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 px-4 py-3">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                            <Icon name="hourglass_top" size={20} className="animate-spin-slow" />
                            Đã gửi lời thách đấu{sentChallengeTo ? <> tới <b>{sentChallengeTo}</b></> : null}. Đang chờ trả lời...
                        </p>
                        <button
                            onClick={handleCancelChallenge}
                            className="shrink-0 px-3 py-1.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                            Hủy
                        </button>
                    </div>
                )}
            </div>

            {/* Danh sách người chơi */}
            <div className="clay-card p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Icon name="groups" className="text-primary" />
                    Người chơi trong phòng
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        ({waitingCount} đang chờ)
                    </span>
                </h3>

                {!connected ? (
                    <div className="text-center py-8">
                        <Icon name="progress_activity" size={32} className="animate-spin text-primary" />
                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Đang kết nối...</p>
                    </div>
                ) : otherPlayers.length === 0 ? (
                    <div className="text-center py-10 rounded-2xl bg-[#f0f5f1] dark:bg-white/5">
                        <div className="text-5xl mb-3">👀</div>
                        <p className="font-bold text-gray-700 dark:text-gray-300">Chưa có ai khác trong phòng...</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Hãy đợi bạn cùng lớp vào nhé!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {otherPlayers.map(([id, p]) => {
                            const st = STATUS_LABELS[p?.status] || STATUS_LABELS.waiting;
                            return (
                                <div
                                    key={id}
                                    className="flex items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4"
                                >
                                    <Avatar src={p?.avatar || null} name={p?.name} size="lg" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-gray-900 dark:text-white truncate">
                                            {p?.name || 'Học sinh'}
                                        </p>
                                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${st.className}`}>
                                            {st.text}
                                        </span>
                                    </div>
                                    {p?.status === 'waiting' && (
                                        <button
                                            onClick={() => handleChallenge(id, p?.name)}
                                            disabled={!!sentChallengeId || myStatus !== 'waiting'}
                                            className="clay-btn-primary shrink-0 inline-flex items-center gap-1 font-bold rounded-2xl px-3 py-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            ⚔️ Thách đấu
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal nhận thách đấu */}
            {incomingChallenge && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="clay-card w-full max-w-sm p-8 text-center animate-scale-in">
                        <div className="text-6xl mb-4 animate-bounce">⚔️</div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            {incomingChallenge.fromName} thách đấu bạn!
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Bạn có dám nhận lời không?
                        </p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={handleRejectChallenge}
                                disabled={responding}
                                className="px-5 py-3 rounded-2xl font-bold bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 shadow-sm transition-all disabled:opacity-50"
                            >
                                Từ chối
                            </button>
                            <button
                                onClick={handleAcceptChallenge}
                                disabled={responding}
                                className="clay-btn-primary inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold disabled:opacity-60"
                            >
                                {responding ? (
                                    <Icon name="progress_activity" className="animate-spin" />
                                ) : (
                                    '⚔️'
                                )}
                                Chấp nhận!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}
        </div>
    );
}
