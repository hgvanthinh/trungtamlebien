import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    listenToOpenLobbies,
    getLobbyStatus,
    joinLobby,
    leaveLobby,
    getPlayerInLobby,
} from '../services/versusSessionService';
import VersusLobby from '../components/versus/VersusLobby';
import VersusMatch from '../components/versus/VersusMatch';
import Icon from '../components/common/Icon';
import Toast from '../components/common/Toast';

/**
 * Trang Đấu Trí 1v1 dành cho học sinh (route /versus).
 * State machine 3 màn trong 1 page:
 *   - rooms: danh sách phòng đang mở (versus_open_lobbies)
 *   - lobby: phòng chờ — thách đấu / nhận thách đấu
 *   - match: trận đấu real-time (VersusMatch)
 */
export default function VersusGame() {
    const { currentUser, userProfile } = useAuth();
    const uid = currentUser?.uid;
    const playerName =
        userProfile?.fullName || userProfile?.displayName || userProfile?.username || 'Học sinh';
    const playerAvatar = userProfile?.avatar || null;

    const [view, setView] = useState('rooms'); // 'rooms' | 'lobby' | 'match'
    const [checking, setChecking] = useState(true); // đang kiểm tra reconnect khi mount
    const [openLobbies, setOpenLobbies] = useState({}); // { gameId: { title, openedAt } }
    const [activeGameId, setActiveGameId] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [joiningId, setJoiningId] = useState(null);
    const [toast, setToast] = useState(null);

    // Lắng nghe danh sách phòng mở + reconnect check 1 lần khi mount.
    // didReconnect là biến cục bộ trong effect → StrictMode double-mount vẫn chạy đúng
    // (mỗi lần mount có flag riêng, cleanup hủy lần chạy cũ qua `cancelled`).
    useEffect(() => {
        if (!uid) return;
        let cancelled = false;
        let didReconnect = false;

        const unsub = listenToOpenLobbies(async (lobbies) => {
            if (cancelled) return;
            setOpenLobbies(lobbies || {});

            if (didReconnect) return;
            didReconnect = true;

            // Reconnect: duyệt các phòng mở, tìm xem mình đang ở phòng nào
            const ids = Object.keys(lobbies || {});
            for (const gid of ids) {
                try {
                    const player = await getPlayerInLobby(gid, uid);
                    if (cancelled) return;
                    if (player) {
                        setActiveGameId(gid);
                        if (player.status === 'in_match' && player.matchId) {
                            setSessionId(player.matchId);
                            setView('match');
                        } else {
                            // 'waiting' hoặc 'done' → vào thẳng phòng chờ
                            setView('lobby');
                        }
                        setChecking(false);
                        return;
                    }
                } catch (err) {
                    console.warn('[VersusGame] Lỗi kiểm tra reconnect:', err);
                }
            }
            if (!cancelled) setChecking(false);
        });

        return () => {
            cancelled = true;
            unsub();
        };
    }, [uid]);

    const handleJoinRoom = async (gameId) => {
        if (!uid || joiningId) return;
        try {
            setJoiningId(gameId);
            // Xác nhận phòng còn mở trước khi join (tránh race khi GV vừa đóng)
            const status = await getLobbyStatus(gameId);
            if (status !== 'open') {
                setToast({ type: 'warning', message: 'Phòng này đã đóng, hãy chọn phòng khác nhé!' });
                return;
            }
            await joinLobby(gameId, uid, playerName, playerAvatar);
            setActiveGameId(gameId);
            setView('lobby');
        } catch (err) {
            console.error('[VersusGame] Join error:', err);
            setToast({ type: 'error', message: 'Không thể vào phòng. Vui lòng thử lại.' });
        } finally {
            setJoiningId(null);
        }
    };

    const handleLeaveLobby = async () => {
        const gid = activeGameId;
        setView('rooms');
        setActiveGameId(null);
        setSessionId(null);
        if (gid && uid) {
            try {
                await leaveLobby(gid, uid);
            } catch (err) {
                console.warn('[VersusGame] Leave error:', err);
            }
        }
    };

    const handleEnterMatch = (newSessionId) => {
        setSessionId(newSessionId);
        setView('match');
    };

    // Thoát trận → quay lại phòng chờ (vẫn còn trong lobby, VersusLobby lo phần "Sẵn sàng đấu tiếp")
    const handleExitMatch = () => {
        setSessionId(null);
        setView('lobby');
    };

    // ==================== RENDER ====================

    if (checking) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="text-5xl mb-4 animate-bounce">⚔️</div>
                    <p className="text-gray-600 dark:text-gray-400">Đang kiểm tra trận đấu của bạn...</p>
                </div>
            </div>
        );
    }

    if (view === 'match' && sessionId && activeGameId) {
        return (
            <VersusMatch
                sessionId={sessionId}
                gameId={activeGameId}
                onExit={handleExitMatch}
            />
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">⚔️ Đấu Trí 1v1</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Thách đấu bạn cùng lớp — trả lời nhanh và chính xác để giành chiến thắng!
                </p>
            </div>

            {view === 'lobby' && activeGameId ? (
                <VersusLobby
                    gameId={activeGameId}
                    onEnterMatch={handleEnterMatch}
                    onLeave={handleLeaveLobby}
                />
            ) : (
                <RoomList
                    openLobbies={openLobbies}
                    joiningId={joiningId}
                    onJoin={handleJoinRoom}
                />
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}

/** Danh sách phòng đang mở */
function RoomList({ openLobbies, joiningId, onJoin }) {
    const rooms = Object.entries(openLobbies || {}).sort(
        (a, b) => (a[1]?.openedAt || 0) - (b[1]?.openedAt || 0)
    );

    if (rooms.length === 0) {
        return (
            <div className="clay-card p-10 text-center animate-slide-up">
                <div className="text-6xl mb-4">🏟️</div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Chưa có phòng đấu nào đang mở...
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Hãy đợi thầy cô mở phòng đấu nhé! Trang sẽ tự cập nhật khi có phòng mới.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map(([gameId, room]) => (
                <div key={gameId} className="clay-card p-6 flex flex-col animate-slide-up">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="size-12 rounded-2xl bg-primary/15 dark:bg-primary/20 flex items-center justify-center text-2xl">
                            ⚔️
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 dark:text-white truncate">
                                {room?.title || 'Phòng đấu'}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <span className="inline-block size-2 rounded-full bg-primary animate-pulse" />
                                Đang mở
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => onJoin(gameId)}
                        disabled={!!joiningId}
                        className="clay-btn-primary mt-auto inline-flex items-center justify-center gap-2 font-bold rounded-2xl px-4 py-3 disabled:opacity-60"
                    >
                        {joiningId === gameId ? (
                            <Icon name="progress_activity" className="animate-spin" />
                        ) : (
                            <Icon name="login" />
                        )}
                        Vào phòng
                    </button>
                </div>
            ))}
        </div>
    );
}
