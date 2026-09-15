import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/common/Icon';
import Toast from '../components/common/Toast';
import ArenaRoomList from '../components/arena/ArenaRoomList';
import ArenaLobby from '../components/arena/ArenaLobby';
import ArenaMatch from '../components/arena/ArenaMatch';
import ArenaResult from '../components/arena/ArenaResult';
import {
    joinArenaRoom,
    leaveArenaRoom,
    listenToArenaRoom,
} from '../services/arenaSessionService';
import { getArenaSettings } from '../services/arenaSettingsService';

/**
 * Trang Đấu Trường (HS).
 *
 * Máy trạng thái 4 màn: rooms → lobby → match → result.
 * Việc chuyển màn do LISTENER trên node phòng quyết định, không do người bấm:
 * chủ phòng bấm bắt đầu thì mọi client thấy status đổi và cùng vào trận.
 */
export default function Arena() {
    const { currentUser, userProfile } = useAuth();
    const uid = currentUser?.uid;

    const [view, setView] = useState('rooms');
    const [roomId, setRoomId] = useState(null);
    const [room, setRoom] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [settings, setSettings] = useState(null);
    const [toast, setToast] = useState(null);
    const [joining, setJoining] = useState(false);

    // Giữ lại danh sách người chơi lúc vào trận — sau khi trận xong, node phòng
    // có thể đã bị dọn nhưng bảng xếp hạng vẫn cần avatar/viền để hiển thị.
    const playersSnapshotRef = useRef({});

    // ===== Cài đặt =====
    useEffect(() => {
        getArenaSettings().then(setSettings).catch(() => setSettings(null));
    }, []);

    // ===== Nghe phòng =====
    useEffect(() => {
        if (!roomId) return undefined;

        return listenToArenaRoom(roomId, (data) => {
            setRoom(data);

            if (!data) {
                // Phòng bị xoá
                setView('rooms');
                setRoomId(null);
                setSessionId(null);
                return;
            }

            if (Object.keys(data.players || {}).length > 0) {
                playersSnapshotRef.current = data.players;
            }

            if (data.status === 'closed') {
                setToast({ type: 'info', message: 'Phòng đã được đóng' });
                setView('rooms');
                setRoomId(null);
                setSessionId(null);
                return;
            }

            // Chủ phòng đã bấm bắt đầu → cả phòng cùng vào trận
            if (data.status === 'running' && data.sessionId) {
                setSessionId(data.sessionId);
                setView((v) => (v === 'result' ? v : 'match'));
            }
        });
    }, [roomId]);

    const handleJoin = async (id) => {
        if (joining) return;
        setJoining(true);
        try {
            const res = await joinArenaRoom(id, uid, {
                name: userProfile?.fullName || 'Học sinh',
                avatar: userProfile?.avatar || '',
                borderUrl: userProfile?.activeAvatarBorder || '',
                grade: userProfile?.gradeLevel || null,
            });

            if (!res.ok) {
                const messages = {
                    room_full: 'Phòng đã đầy',
                    room_not_open: 'Phòng không còn nhận người',
                    room_not_found: 'Không tìm thấy phòng',
                };
                setToast({ type: 'error', message: messages[res.reason] || 'Không vào được phòng' });
                return;
            }

            setRoomId(id);
            setView('lobby');
        } catch {
            setToast({ type: 'error', message: 'Không vào được phòng' });
        } finally {
            setJoining(false);
        }
    };

    const handleLeave = async () => {
        if (roomId && uid) {
            try {
                await leaveArenaRoom(roomId, uid);
            } catch {
                // Rời phòng lỗi thì vẫn cho HS thoát khỏi màn, không kẹt lại
            }
        }
        setRoomId(null);
        setRoom(null);
        setSessionId(null);
        setView('rooms');
    };

    const handleExitResult = async () => {
        await handleLeave();
    };

    if (!settings) {
        return (
            <div className="p-4 flex items-center justify-center gap-2 text-[#556958] dark:text-[#a5b5a8]">
                <Icon name="progress_activity" size={22} className="animate-spin" />
                Đang tải...
            </div>
        );
    }

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-4">
            {/* Tiêu đề */}
            {view === 'rooms' && (
                <div className="text-center">
                    <h1 className="text-2xl font-black text-[#111812] dark:text-white flex items-center justify-center gap-2">
                        <Icon name="stadium" size={28} className="text-primary" />
                        Đấu Trường
                    </h1>
                    <p className="text-sm text-[#556958] dark:text-[#a5b5a8] mt-1">
                        Thi đấu cùng lúc nhiều người — Top 5 nhận điểm tích luỹ
                    </p>
                </div>
            )}

            {view === 'rooms' && (
                <ArenaRoomList
                    myGrade={userProfile?.gradeLevel}
                    minPlayers={settings.minPlayers}
                    onJoin={handleJoin}
                />
            )}

            {view === 'lobby' && (
                <ArenaLobby
                    roomId={roomId}
                    room={room}
                    myUid={uid}
                    onLeave={handleLeave}
                    onToast={setToast}
                />
            )}

            {view === 'match' && sessionId && (
                <ArenaMatch
                    sessionId={sessionId}
                    settings={settings}
                    room={{ ...room, myUid: uid, players: room?.players || playersSnapshotRef.current }}
                    onFinished={() => setView('result')}
                    onToast={setToast}
                />
            )}

            {view === 'result' && sessionId && (
                <ArenaResult
                    sessionId={sessionId}
                    myUid={uid}
                    onExit={handleExitResult}
                    onToast={setToast}
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
