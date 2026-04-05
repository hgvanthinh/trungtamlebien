// src/pages/public/GameLobby.jsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    socket,
    connectToGameServer,
    disconnectFromGameServer,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    startGame,
    joinLoandauQueue,
    leaveLoandauQueue,
    startLoandauSplit,
    createTournament,
    joinTournament,
    fetchTournamentList,
} from '../../services/api/socket';
import { auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

// ─────────────────────────────────────────────
// Sub-component: Badge trạng thái kết nối
// ─────────────────────────────────────────────
function ConnectionBadge({ connected }) {
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0
      ${connected
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-gray-500/10 border-gray-500/30 text-gray-400'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className="hidden sm:inline">{connected ? 'Đang kết nối' : 'Chưa kết nối'}</span>
            <span className="sm:hidden">{connected ? 'Online' : 'Offline'}</span>
        </div>
    );
}

// ─────────────────────────────────────────────
// Sub-component: Thẻ phòng chơi
// ─────────────────────────────────────────────
function RoomCard({ room, currentUid, onJoin }) {
    const isFull = room.playerCount >= room.maxPlayers;
    const isPlaying = room.status === 'playing';
    const canJoin = !isFull && !isPlaying;

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3
      hover:bg-white/8 hover:border-white/20 transition-all duration-200 active:scale-[0.99]">
            {/* Icon phòng */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20
          border border-white/10 flex items-center justify-center text-lg flex-shrink-0">
                🏠
            </div>

            {/* Tên + số người */}
            <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate leading-tight">{room.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                    {room.playerCount}/{room.maxPlayers} người
                </p>
            </div>

            {/* Badge + nút */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0
          ${isPlaying
                        ? 'bg-red-500/15 text-red-400'
                        : isFull
                            ? 'bg-yellow-500/15 text-yellow-400'
                            : 'bg-blue-500/15 text-blue-400'
                    }`}>
                    {isPlaying ? '🎮' : isFull ? '🔒' : '⏳'}
                    <span className="hidden sm:inline ml-1">
                        {isPlaying ? 'Đang chơi' : isFull ? 'Đầy' : 'Chờ'}
                    </span>
                </span>

                <button
                    id={`btn-join-room-${room.id}`}
                    onClick={() => onJoin(room.id)}
                    disabled={!canJoin}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
            bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95
            disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100
            min-w-[52px] text-center"
                >
                    Vào
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Sub-component: Phòng đang ở (Room Detail)
// ─────────────────────────────────────────────
function CurrentRoomPanel({ room, currentUid, onLeave, onToggleReady, onStart }) {
    const isHost = room.host === currentUid;
    const me = room.players.find(p => p.uid === currentUid);
    const allNonHostReady = room.players.filter(p => !p.isHost).every(p => p.isReady);
    const canStart = isHost && room.players.length >= 2 && allNonHostReady;

    return (
        <div className="bg-white/5 border border-indigo-500/30 rounded-2xl p-4 flex flex-col gap-3">
            {/* Header phòng */}
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest leading-none mb-1">Phòng của bạn</p>
                    <h3 className="text-white font-bold text-base truncate">{room.name}</h3>
                    <p className="text-gray-600 text-xs font-mono truncate mt-0.5">{room.id}</p>
                </div>
                <button
                    id="btn-leave-room"
                    onClick={onLeave}
                    className="flex-shrink-0 text-gray-500 hover:text-red-400 text-xs px-3 py-2 rounded-xl
            border border-white/10 hover:border-red-500/30 transition-all active:scale-95"
                >
                    Rời phòng
                </button>
            </div>

            {/* Danh sách người chơi */}
            <div className="flex flex-col gap-1.5">
                {room.players.map((player) => (
                    <div key={player.uid}
                        className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base flex-shrink-0">{player.isHost ? '👑' : '🧑'}</span>
                            <span className="text-white text-sm font-medium truncate">
                                {player.name}
                                {player.uid === currentUid && (
                                    <span className="text-gray-500 text-xs ml-1">(bạn)</span>
                                )}
                            </span>
                        </div>
                        {player.isHost ? (
                            <span className="text-yellow-400 text-xs font-medium flex-shrink-0">Chủ phòng</span>
                        ) : (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0
                ${player.isReady
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                {player.isReady ? '✓ Sẵn sàng' : 'Chờ...'}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
                {!isHost && (
                    <button
                        id="btn-toggle-ready"
                        onClick={onToggleReady}
                        className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 active:scale-95
              ${me?.isReady
                                ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20'
                            }`}
                    >
                        {me?.isReady ? '❌ Hủy sẵn sàng' : '✅ Sẵn sàng'}
                    </button>
                )}
                {isHost && (
                    <button
                        id="btn-start-game"
                        onClick={onStart}
                        disabled={!canStart}
                        className="flex-1 py-3.5 rounded-xl font-bold text-sm transition-all duration-200
              bg-gradient-to-r from-orange-500 to-red-500
              hover:from-orange-400 hover:to-red-400
              text-white active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
              shadow-lg shadow-orange-500/20"
                    >
                        {room.players.length < 2
                            ? '⏳ Cần thêm người'
                            : !allNonHostReady
                                ? '⏳ Chờ sẵn sàng'
                                : '🚀 Bắt đầu!'}
                    </button>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Component: GameLobby
// ─────────────────────────────────────────────
export function GameLobby() {
    const navigate = useNavigate();
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectError, setConnectError] = useState('');

    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [roomError, setRoomError] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');

    // Chế độ chơi: 'select' | 'loanDau' | 'dauCap'
    const [lobbyMode, setLobbyMode] = useState('select');

    // Loạn Đấu queue
    const [loandauQueue, setLoandauQueue] = useState(null); // { players, count, hostUid }
    const [inQueue, setInQueue] = useState(false);

    // Đấu Cặp tournament list
    const [tournaments, setTournaments] = useState([]);
    const [showCreateTournament, setShowCreateTournament] = useState(false);
    const [newTournamentName, setNewTournamentName] = useState('');

    const currentUid = auth.currentUser?.uid;
    const { userProfile } = useAuth();

    // ── Đăng ký socket events ─────────────────
    useEffect(() => {
        function onConnect() { setConnected(true); setConnecting(false); }
        function onDisconnect() { setConnected(false); setCurrentRoom(null); }
        function onRoomsList(data) { setRooms(data); }
        function onRoomJoined(room) {
            setCurrentRoom(room);
            setRoomError('');
            // Nếu đang ở queue Loạn Đấu → server tự join phòng, chuyển sang lobby mode
            setInQueue(false);
            setLobbyMode('loanDau');
        }
        function onRoomUpdated(room) {
            setCurrentRoom(prev => prev?.id === room.id ? room : prev);
        }
        function onRoomError({ message }) { setRoomError(message); }
        function onGameStart({ roomId }) { navigate(`/phaser-game/${roomId}`); }

        // Loạn Đấu queue
        function onLoandauQueueUpdate(data) { setLoandauQueue(data); }

        // Tournament list
        function onTournamentList(data) { setTournaments(data); }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('rooms:list', onRoomsList);
        socket.on('room:joined', onRoomJoined);
        socket.on('room:updated', onRoomUpdated);
        socket.on('room:error', onRoomError);
        socket.on('game:start', onGameStart);
        socket.on('loandau:queue_update', onLoandauQueueUpdate);
        socket.on('tournament:list', onTournamentList);

        if (socket.connected) setConnected(true);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('rooms:list', onRoomsList);
            socket.off('room:joined', onRoomJoined);
            socket.off('room:updated', onRoomUpdated);
            socket.off('room:error', onRoomError);
            socket.off('game:start', onGameStart);
            socket.off('loandau:queue_update', onLoandauQueueUpdate);
            socket.off('tournament:list', onTournamentList);
        };
    }, [navigate]);

    // ── Handlers ──────────────────────────────
    const handleConnect = async () => {
        setConnecting(true);
        setConnectError('');
        try {
            await connectToGameServer(userProfile?.avatar || '', userProfile?.fullName || '');
        } catch (err) {
            setConnectError(err.message);
            setConnecting(false);
        }
    };

    const handleDisconnect = () => { disconnectFromGameServer(); };

    const handleCreateRoom = useCallback(() => {
        if (!newRoomName.trim()) return;
        createRoom(newRoomName.trim());
        setNewRoomName('');
        setShowCreateModal(false);
    }, [newRoomName]);

    const handleJoinRoom = useCallback((roomId) => {
        setRoomError('');
        joinRoom(roomId);
    }, []);

    const handleLeaveRoom = useCallback(() => {
        if (!currentRoom) return;
        leaveRoom(currentRoom.id);
        setCurrentRoom(null);
    }, [currentRoom]);

    const handleToggleReady = useCallback(() => {
        if (!currentRoom) return;
        toggleReady(currentRoom.id);
    }, [currentRoom]);

    const handleStartGame = useCallback(() => {
        if (!currentRoom) return;
        startGame(currentRoom.id);
    }, [currentRoom]);

    // ── Loạn Đấu Queue handlers ───────────────
    const handleJoinQueue = useCallback(() => {
        joinLoandauQueue();
        setInQueue(true);
    }, []);

    const handleLeaveQueue = useCallback(() => {
        leaveLoandauQueue();
        setInQueue(false);
        setLoandauQueue(null);
    }, []);

    const handleStartSplit = useCallback(() => {
        startLoandauSplit();
    }, []);

    // ── Tournament handlers ───────────────────
    const handleSelectDauCap = useCallback(() => {
        setLobbyMode('dauCap');
        fetchTournamentList();
    }, []);

    const handleCreateTournament = useCallback(() => {
        if (!newTournamentName.trim()) return;
        createTournament(newTournamentName.trim());
        setNewTournamentName('');
        setShowCreateTournament(false);
        // Sau khi tạo sẽ nhận tournament:joined → navigate
        socket.once('tournament:joined', (t) => {
            navigate(`/tournament/${t.id}`);
        });
    }, [newTournamentName, navigate]);

    const handleJoinTournament = useCallback((tournamentId) => {
        joinTournament(tournamentId);
        navigate(`/tournament/${tournamentId}`);
    }, [navigate]);

    // ─────────────────────────────────────────
    // Render: Chưa kết nối
    // ─────────────────────────────────────────
    if (!connected) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950
                flex items-center justify-center p-5">
                <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10
                    rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-7">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                            flex items-center justify-center shadow-lg shadow-indigo-500/30 text-4xl">
                            💣
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Đặt Bom</h1>
                        <p className="text-gray-400 text-sm text-center leading-relaxed">
                            Trò chơi multiplayer theo thời gian thực
                        </p>
                    </div>

                    {connectError && (
                        <div className="w-full bg-red-500/10 border border-red-500/30 rounded-xl
                            px-4 py-3 text-red-300 text-sm text-center">
                            ⚠️ {connectError}
                        </div>
                    )}

                    <button
                        id="btn-connect-game-server"
                        onClick={handleConnect}
                        disabled={connecting}
                        className="w-full py-4 rounded-2xl font-bold text-lg text-white
                            bg-gradient-to-r from-indigo-600 to-purple-600
                            hover:from-indigo-500 hover:to-purple-500
                            active:scale-95 transition-all duration-200
                            shadow-lg shadow-indigo-500/30
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {connecting ? '⏳ Đang kết nối...' : '🚀 Vào Sảnh Chờ'}
                    </button>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────
    // Render: Đã kết nối — Lobby
    // ─────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950">
            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-md border-b border-white/10 px-4 py-3">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    {/* Logo + title */}
                    <span className="text-2xl flex-shrink-0">💣</span>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-white font-bold text-base leading-tight truncate">
                            Sảnh Chờ — Đặt Bom
                        </h1>
                        <p className="text-gray-600 text-xs font-mono truncate">
                            {auth.currentUser?.email}
                        </p>
                    </div>
                    {/* Badge + thoát */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <ConnectionBadge connected={connected} />
                        <button
                            onClick={handleDisconnect}
                            className="text-gray-500 hover:text-red-400 text-xs px-2.5 py-1.5 rounded-lg
                                border border-white/10 hover:border-red-500/30 transition-all active:scale-95"
                        >
                            Thoát
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Nội dung chính ── */}
            <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">

                {/* Lỗi phòng */}
                {roomError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3
                        text-red-300 text-sm flex items-center justify-between gap-3">
                        <span>⚠️ {roomError}</span>
                        <button onClick={() => setRoomError('')}
                            className="text-red-400 hover:text-red-300 flex-shrink-0 text-base leading-none">✕</button>
                    </div>
                )}

                {/* Phòng đang ở */}
                {currentRoom && (
                    <CurrentRoomPanel
                        room={currentRoom}
                        currentUid={currentUid}
                        onLeave={handleLeaveRoom}
                        onToggleReady={handleToggleReady}
                        onStart={handleStartGame}
                    />
                )}

                {/* ── Chọn chế độ ── */}
                {!currentRoom && lobbyMode === 'select' && (
                    <div className="flex flex-col gap-3">
                        <p className="text-white/50 text-sm text-center">Chọn chế độ chơi</p>
                        <button onClick={() => setLobbyMode('loanDau')}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/40
                                rounded-2xl p-5 flex items-center gap-4 text-left transition-all active:scale-[0.98]">
                            <span className="text-4xl">💥</span>
                            <div>
                                <h3 className="text-white font-bold text-base">Loạn Đấu</h3>
                                <p className="text-gray-400 text-sm mt-0.5">2–5 người · Tự do · 5 phút</p>
                            </div>
                            <span className="ml-auto text-white/30">›</span>
                        </button>
                        <button onClick={handleSelectDauCap}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-500/40
                                rounded-2xl p-5 flex items-center gap-4 text-left transition-all active:scale-[0.98]">
                            <span className="text-4xl">🏆</span>
                            <div>
                                <h3 className="text-white font-bold text-base">Đấu Cặp</h3>
                                <p className="text-gray-400 text-sm mt-0.5">Giải đấu 1v1 · 90 giây · Ngôi sao</p>
                            </div>
                            <span className="ml-auto text-white/30">›</span>
                        </button>
                    </div>
                )}

                {/* ── Loạn Đấu ── */}
                {!currentRoom && lobbyMode === 'loanDau' && (
                    <>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setLobbyMode('select')}
                                className="text-white/40 hover:text-white text-sm transition-colors">← Chế độ</button>
                            <span className="text-white/20">|</span>
                            <h2 className="text-white font-semibold text-sm">💥 Loạn Đấu</h2>
                        </div>

                        {/* Queue section */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white/70 text-sm font-semibold">Hàng chờ tự động</h3>
                                <span className="text-xs text-white/30">{loandauQueue?.count ?? 0} người</span>
                            </div>
                            {loandauQueue?.players?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {loandauQueue.players.map(p => (
                                        <span key={p.uid} className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                                            {p.uid === currentUid ? '★ ' : ''}{p.name}
                                            {p.uid === loandauQueue.hostUid ? ' 👑' : ''}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                {!inQueue ? (
                                    <button onClick={handleJoinQueue}
                                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white
                                            bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all">
                                        Vào hàng chờ
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={handleLeaveQueue}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60
                                                border border-white/10 hover:bg-white/5 active:scale-95 transition-all">
                                            Rời hàng chờ
                                        </button>
                                        {loandauQueue?.hostUid === currentUid && (loandauQueue?.count ?? 0) >= 2 && (
                                            <button onClick={handleStartSplit}
                                                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white
                                                    bg-gradient-to-r from-orange-500 to-red-500
                                                    hover:from-orange-400 hover:to-red-400
                                                    active:scale-95 transition-all">
                                                🚀 Phân phòng ({loandauQueue.count} người)
                                            </button>
                                        )}
                                        {loandauQueue?.hostUid === currentUid && (loandauQueue?.count ?? 0) < 2 && (
                                            <span className="flex-1 text-center text-white/30 text-sm py-2.5">Chờ thêm người...</span>
                                        )}
                                        {loandauQueue?.hostUid !== currentUid && (
                                            <span className="flex-1 text-center text-white/30 text-sm py-2.5">Chờ host bắt đầu...</span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Hoặc tự tạo phòng */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
                                <h2 className="text-white font-semibold text-sm">
                                    Phòng thủ công
                                    <span className="text-gray-500 font-normal ml-2">({rooms.filter(r => !r.tournamentId).length})</span>
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => socket.emit('rooms:refresh')}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white
                                            bg-gradient-to-r from-emerald-600 to-teal-600
                                            hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all">
                                        <span>🔄</span>
                                    </button>
                                    <button onClick={() => setShowCreateModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white
                                            bg-gradient-to-r from-indigo-600 to-purple-600
                                            hover:from-indigo-500 hover:to-purple-500 active:scale-95 transition-all">
                                        <span>+ Tạo</span>
                                    </button>
                                </div>
                            </div>
                            {rooms.filter(r => !r.tournamentId).length === 0 ? (
                                <div className="py-10 flex flex-col items-center gap-3 text-gray-600">
                                    <span className="text-3xl">🏜️</span>
                                    <p className="text-sm">Chưa có phòng nào.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 p-3">
                                    {rooms.filter(r => !r.tournamentId).map(room => (
                                        <RoomCard key={room.id} room={room} currentUid={currentUid} onJoin={handleJoinRoom} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ── Đấu Cặp ── */}
                {!currentRoom && lobbyMode === 'dauCap' && (
                    <>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setLobbyMode('select')}
                                className="text-white/40 hover:text-white text-sm transition-colors">← Chế độ</button>
                            <span className="text-white/20">|</span>
                            <h2 className="text-white font-semibold text-sm">🏆 Đấu Cặp</h2>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
                                <h2 className="text-white font-semibold text-sm">
                                    Giải đấu
                                    <span className="text-gray-500 font-normal ml-2">({tournaments.length})</span>
                                </h2>
                                <div className="flex gap-2">
                                    <button onClick={fetchTournamentList}
                                        className="px-3 py-2 rounded-xl text-sm font-bold text-white
                                            bg-gradient-to-r from-emerald-600 to-teal-600
                                            hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all">
                                        🔄
                                    </button>
                                    <button onClick={() => setShowCreateTournament(true)}
                                        className="px-3 py-2 rounded-xl text-sm font-semibold text-white
                                            bg-gradient-to-r from-yellow-600 to-orange-600
                                            hover:from-yellow-500 hover:to-orange-500 active:scale-95 transition-all">
                                        + Tạo giải
                                    </button>
                                </div>
                            </div>
                            {tournaments.length === 0 ? (
                                <div className="py-10 flex flex-col items-center gap-3 text-gray-600">
                                    <span className="text-3xl">🏆</span>
                                    <p className="text-sm text-center">Chưa có giải đấu nào.<br />Hãy tạo giải đầu tiên!</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 p-3">
                                    {tournaments.map(t => (
                                        <div key={t.id}
                                            className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                                            <span className="text-2xl">🏆</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-semibold text-sm truncate">{t.name}</p>
                                                <p className="text-gray-500 text-xs">
                                                    {t.playerCount} người · {t.status === 'lobby' ? 'Đang chờ' : 'Đang đấu'}
                                                </p>
                                            </div>
                                            <button onClick={() => handleJoinTournament(t.id)}
                                                disabled={t.status !== 'lobby'}
                                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white
                                                    bg-yellow-600 hover:bg-yellow-500 active:scale-95 transition-all
                                                    disabled:opacity-30 disabled:cursor-not-allowed">
                                                {t.status === 'lobby' ? 'Vào' : 'Đang đấu'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ── Modal Tạo Giải Đấu ── */}
            {showCreateTournament && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={e => { if (e.target === e.currentTarget) { setShowCreateTournament(false); setNewTournamentName(''); } }}>
                    <div className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg">🏆 Tạo giải đấu</h3>
                            <button onClick={() => { setShowCreateTournament(false); setNewTournamentName(''); }}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white">✕</button>
                        </div>
                        <input
                            type="text"
                            value={newTournamentName}
                            onChange={e => setNewTournamentName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateTournament()}
                            placeholder="Tên giải đấu..."
                            autoFocus
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5
                                text-white placeholder-gray-600 text-sm outline-none
                                focus:border-yellow-500/50 transition-all"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowCreateTournament(false); setNewTournamentName(''); }}
                                className="flex-1 py-3 rounded-xl font-semibold text-sm text-gray-400
                                    border border-white/10 hover:bg-white/5 transition-all active:scale-95">
                                Hủy
                            </button>
                            <button onClick={handleCreateTournament} disabled={!newTournamentName.trim()}
                                className="flex-1 py-3 rounded-xl font-bold text-sm text-white
                                    bg-gradient-to-r from-yellow-600 to-orange-600
                                    hover:from-yellow-500 hover:to-orange-500
                                    disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all">
                                Tạo giải
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Tạo Phòng ── */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateModal(false); setNewRoomName(''); } }}
                >
                    <div className="w-full max-w-sm bg-gray-900 border border-white/10
                        rounded-2xl p-6 flex flex-col gap-5 shadow-2xl
                        max-h-[85vh] overflow-y-auto">

                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg">Tạo phòng mới</h3>
                            {/* Nút đóng modal nhanh trên mobile */}
                            <button
                                onClick={() => { setShowCreateModal(false); setNewRoomName(''); }}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center
                                    text-gray-400 hover:text-white transition-colors"
                            >✕</button>
                        </div>

                        <input
                            id="input-room-name"
                            type="text"
                            value={newRoomName}
                            onChange={e => setNewRoomName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
                            placeholder="Nhập tên phòng..."
                            autoFocus
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5
                                text-white placeholder-gray-600 text-sm outline-none
                                focus:border-indigo-500/50 focus:bg-white/8 transition-all"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowCreateModal(false); setNewRoomName(''); }}
                                className="flex-1 py-3.5 rounded-xl font-semibold text-sm text-gray-400
                                    border border-white/10 hover:bg-white/5 transition-all active:scale-95"
                            >
                                Hủy
                            </button>
                            <button
                                id="btn-confirm-create-room"
                                onClick={handleCreateRoom}
                                disabled={!newRoomName.trim()}
                                className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white
                                    bg-gradient-to-r from-indigo-600 to-purple-600
                                    hover:from-indigo-500 hover:to-purple-500
                                    disabled:opacity-40 disabled:cursor-not-allowed
                                    active:scale-95 transition-all duration-200"
                            >
                                Tạo phòng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GameLobby;
