import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/common/Icon';
import Toast from '../components/common/Toast';
import ArenaRoomList from '../components/arena/ArenaRoomList';
import ArenaLobby from '../components/arena/ArenaLobby';
import ArenaMatch from '../components/arena/ArenaMatch';
import ArenaResult from '../components/arena/ArenaResult';
import ArenaPracticeResult from '../components/arena/ArenaPracticeResult';
import {
    joinArenaRoom,
    leaveArenaRoom,
    listenToArenaRoom,
    ARENA_MODE,
} from '../services/arenaSessionService';
import { getArenaSettings } from '../services/arenaSettingsService';
import { cleanupArenaRoom, startArenaPractice } from '../services/arenaRewardService';

/**
 * Trang Đấu Trường (HS).
 *
 * Hai luồng tách biệt, chọn theo `mode` của phòng:
 *
 * - Thi đấu (live):  rooms → lobby → match → result
 *   Chuyển màn do LISTENER trên node phòng quyết định, không do người bấm:
 *   chủ phòng bấm bắt đầu thì mọi client thấy status đổi và cùng vào trận.
 *
 * - Luyện tập (practice):  rooms → match → practiceResult
 *   Không phòng chờ, không đối thủ. Bấm vào là server tạo đề riêng và HS làm
 *   ngay, nên không cần nghe node phòng.
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
    // Chế độ của phòng đang chơi — quyết định dùng luồng nào
    const [mode, setMode] = useState(ARENA_MODE.LIVE);

    // Giữ lại danh sách người chơi lúc vào trận — sau khi trận xong, node phòng
    // có thể đã bị dọn nhưng bảng xếp hạng vẫn cần avatar/viền để hiển thị.
    const playersSnapshotRef = useRef({});

    // ===== Cài đặt =====
    useEffect(() => {
        getArenaSettings().then(setSettings).catch(() => setSettings(null));
    }, []);

    // ===== Nghe phòng =====
    useEffect(() => {
        // Luyện tập không qua phòng chờ nên không cần nghe node phòng
        if (!roomId || mode === ARENA_MODE.PRACTICE) return undefined;

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
    }, [roomId, mode]);

    /**
     * Bắt đầu (hoặc bắt đầu lại) một lượt luyện tập.
     *
     * Mỗi lượt là một session mới với đề random lại — server tự kiểm tra khối
     * và số lượt còn lại trong ngày, nên client chỉ cần báo lỗi ra màn hình.
     */
    const startPractice = async (id) => {
        const res = await startArenaPractice(id);
        // Xoá dấu vết phòng thi đấu trước đó trong cùng phiên — luyện tập là
        // một mình, không được mang theo danh sách người chơi cũ.
        playersSnapshotRef.current = {};
        setRoom(null);
        setRoomId(id);
        setMode(ARENA_MODE.PRACTICE);
        setSessionId(res.sessionId);
        setView('match');

        if (res.maxPerDay > 0) {
            setToast({
                type: 'info',
                message: `Lượt luyện thứ ${res.usedToday}/${res.maxPerDay} hôm nay`,
            });
        }
    };

    const handleJoin = async (id, roomMode) => {
        if (joining) return;
        setJoining(true);
        try {
            if (roomMode === ARENA_MODE.PRACTICE) {
                await startPractice(id);
                return;
            }

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
            setMode(ARENA_MODE.LIVE);
            setView('lobby');
        } catch (error) {
            setToast({ type: 'error', message: error.message || 'Không vào được phòng' });
        } finally {
            setJoining(false);
        }
    };

    /** Luyện tiếp một lượt mới trong cùng phòng */
    const handlePracticeAgain = async () => {
        if (joining || !roomId) return;
        setJoining(true);
        try {
            await startPractice(roomId);
        } catch (error) {
            setToast({ type: 'error', message: error.message || 'Không bắt đầu được lượt mới' });
        } finally {
            setJoining(false);
        }
    };

    const handleLeave = async () => {
        // Luyện tập không ghi tên vào phòng nên không có gì phải dọn
        if (mode === ARENA_MODE.PRACTICE) {
            setRoomId(null);
            setRoom(null);
            setSessionId(null);
            setMode(ARENA_MODE.LIVE);
            setView('rooms');
            return;
        }

        if (roomId && uid) {
            try {
                const res = await leaveArenaRoom(roomId, uid);
                // Người cuối cùng rời đi: nhờ server dọn phòng, nếu không phòng
                // sẽ nằm mãi trong danh sách với trạng thái "đang thi đấu" dù
                // chẳng còn ai. Server tự kiểm tra lại phòng có trống thật không.
                if (res?.wasLastPlayer) {
                    cleanupArenaRoom(roomId).catch(() => {
                        // Dọn hụt thì admin vẫn có nút "Mở lại phòng"
                    });
                }
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
                        <Icon name="swords" size={28} className="text-primary" />
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
                    settings={settings}
                    onLeave={handleLeave}
                    onToast={setToast}
                />
            )}

            {view === 'match' && sessionId && (
                <ArenaMatch
                    key={sessionId}
                    sessionId={sessionId}
                    settings={settings}
                    mode={mode}
                    room={{ ...room, myUid: uid, players: room?.players || playersSnapshotRef.current }}
                    onFinished={() => setView('result')}
                    onToast={setToast}
                />
            )}

            {view === 'result' && sessionId && mode === ARENA_MODE.PRACTICE && (
                <ArenaPracticeResult
                    key={sessionId}
                    sessionId={sessionId}
                    onAgain={handlePracticeAgain}
                    onExit={handleExitResult}
                    onToast={setToast}
                />
            )}

            {view === 'result' && sessionId && mode !== ARENA_MODE.PRACTICE && (
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
