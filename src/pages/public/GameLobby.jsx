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
} from '../../services/api/socket';
import { auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

// ─────────────────────────────────────────────
// Sub-component: Badge trạng thái kết nối
// ─────────────────────────────────────────────
function ConnectionBadge({ connected }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border
      ${connected
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-gray-500/10 border-gray-500/30 text-gray-400'
            }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-500'}`} />
            {connected ? 'Đang kết nối' : 'Chưa kết nối'}
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
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4
      hover:bg-white/8 hover:border-white/20 transition-all duration-200">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20
          border border-white/10 flex items-center justify-center text-xl flex-shrink-0">
                    🏠
                </div>
                <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{room.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                        {room.playerCount} người chơi
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
                {/* Badge trạng thái phòng */}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium
          ${isPlaying
                        ? 'bg-red-500/15 text-red-400'
                        : isFull
                            ? 'bg-yellow-500/15 text-yellow-400'
                            : 'bg-blue-500/15 text-blue-400'
                    }`}>
                    {isPlaying ? '🎮 Đang chơi' : isFull ? '🔒 Đầy' : '⏳ Chờ'}
                </span>

                <button
                    id={`btn-join-room-${room.id}`}
                    onClick={() => onJoin(room.id)}
                    disabled={!canJoin}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
            bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95
            disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
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
        <div className="bg-white/5 border border-indigo-500/30 rounded-2xl p-5 flex flex-col gap-4">
            {/* Header phòng */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-1">Phòng của bạn</p>
                    <h3 className="text-white font-bold text-lg">{room.name}</h3>
                    <p className="text-gray-500 text-xs mt-0.5 font-mono">{room.id}</p>
                </div>
                <button
                    id="btn-leave-room"
                    onClick={onLeave}
                    className="text-gray-500 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg
            border border-white/10 hover:border-red-500/30 transition-all"
                >
                    Rời phòng
                </button>
            </div>

            {/* Danh sách người chơi */}
            <div className="flex flex-col gap-2">
                {room.players.map((player) => (
                    <div key={player.uid}
                        className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{player.isHost ? '👑' : '🧑'}</span>
                            <span className="text-white text-sm font-medium">
                                {player.name}
                                {player.uid === currentUid && (
                                    <span className="text-gray-500 text-xs ml-1">(bạn)</span>
                                )}
                            </span>
                        </div>
                        {player.isHost ? (
                            <span className="text-yellow-400 text-xs font-medium">Chủ phòng</span>
                        ) : (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                ${player.isReady
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                {player.isReady ? 'Sẵn sàng ✓' : 'Chưa sẵn sàng'}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
                {!isHost && (
                    <button
                        id="btn-toggle-ready"
                        onClick={onToggleReady}
                        className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95
              ${me?.isReady
                                ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                : 'bg-green-600 hover:bg-green-500 text-white'
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
                        className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200
              bg-gradient-to-r from-orange-500 to-red-500
              hover:from-orange-400 hover:to-red-400
              text-white active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
              shadow-lg shadow-orange-500/20"
                    >
                        {room.players.length < 2
                            ? '⏳ Cần thêm người chơi'
                            : !allNonHostReady
                                ? '⏳ Chờ người chơi sẵn sàng'
                                : '🚀 Bắt đầu Game'}
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
    const [currentRoom, setCurrentRoom] = useState(null); // Room đang ở
    const [roomError, setRoomError] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');

    const currentUid = auth.currentUser?.uid;
    const { userProfile } = useAuth();

    // ── Đăng ký socket events ─────────────────
    useEffect(() => {
        function onConnect() { setConnected(true); setConnecting(false); }
        function onDisconnect() { setConnected(false); setCurrentRoom(null); }
        function onRoomsList(data) { setRooms(data); }
        function onRoomJoined(room) { setCurrentRoom(room); setRoomError(''); }
        function onRoomUpdated(room) {
            setCurrentRoom(prev => prev?.id === room.id ? room : prev);
        }
        function onRoomError({ message }) { setRoomError(message); }
        function onGameStart({ roomId }) {
            navigate(`/game/${roomId}`);
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('rooms:list', onRoomsList);
        socket.on('room:joined', onRoomJoined);
        socket.on('room:updated', onRoomUpdated);
        socket.on('room:error', onRoomError);
        socket.on('game:start', onGameStart);

        // Nếu socket đã kết nối từ trước
        if (socket.connected) setConnected(true);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('rooms:list', onRoomsList);
            socket.off('room:joined', onRoomJoined);
            socket.off('room:updated', onRoomUpdated);
            socket.off('room:error', onRoomError);
            socket.off('game:start', onGameStart);
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

    const handleDisconnect = () => {
        disconnectFromGameServer();
    };

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

    // ─────────────────────────────────────────
    // Render: Chưa kết nối
    // ─────────────────────────────────────────
    if (!connected) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 flex items-center justify-center p-6">
                <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-10 flex flex-col items-center gap-8">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-4xl">
                            💣
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Đặt Bom</h1>
                        <p className="text-gray-400 text-sm text-center">Trò chơi multiplayer theo thời gian thực</p>
                    </div>

                    {connectError && (
                        <div className="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm text-center">
                            ⚠️ {connectError}
                        </div>
                    )}

                    <button
                        id="btn-connect-game-server"
                        onClick={handleConnect}
                        disabled={connecting}
                        className="w-full py-4 rounded-2xl font-semibold text-lg text-white
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
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 p-4 md:p-8">
            <div className="max-w-2xl mx-auto flex flex-col gap-5">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">💣</span>
                        <div>
                            <h1 className="text-white font-bold text-xl">Sảnh Chờ — Đặt Bom - CHẾ ĐỘ THỬ NGHIỆM</h1>
                            <p className="text-gray-500 text-xs font-mono">{auth.currentUser?.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ConnectionBadge connected={connected} />
                        <button
                            onClick={handleDisconnect}
                            className="text-gray-500 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg
                border border-white/10 hover:border-red-500/30 transition-all"
                        >
                            Thoát
                        </button>
                    </div>
                </div>

                {/* ── Lỗi phòng ── */}
                {roomError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm text-center">
                        ⚠️ {roomError}
                        <button onClick={() => setRoomError('')} className="ml-3 text-red-400 hover:text-red-300">✕</button>
                    </div>
                )}

                {/* ── Phòng đang ở (nếu có) ── */}
                {currentRoom && (
                    <CurrentRoomPanel
                        room={currentRoom}
                        currentUid={currentUid}
                        onLeave={handleLeaveRoom}
                        onToggleReady={handleToggleReady}
                        onStart={handleStartGame}
                    />
                )}

                {/* ── Danh sách phòng (ẩn khi đang ở phòng) ── */}
                {!currentRoom && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-white font-semibold">
                                Danh sách phòng
                                <span className="text-gray-500 text-sm font-normal ml-2">({rooms.length} phòng)</span>
                            </h2>
                            <button
                                id="btn-create-room"
                                onClick={() => setShowCreateModal(true)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white
                  bg-gradient-to-r from-indigo-600 to-purple-600
                  hover:from-indigo-500 hover:to-purple-500
                  active:scale-95 transition-all duration-200"
                            >
                                + Tạo phòng
                            </button>
                        </div>

                        {rooms.length === 0 ? (
                            <div className="py-12 flex flex-col items-center gap-3 text-gray-600">
                                <span className="text-4xl">🏜️</span>
                                <p className="text-sm">Chưa có phòng nào. Hãy tạo phòng đầu tiên!</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {rooms.map(room => (
                                    <RoomCard
                                        key={room.id}
                                        room={room}
                                        currentUid={currentUid}
                                        onJoin={handleJoinRoom}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Modal Tạo Phòng ── */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
                        <h3 className="text-white font-bold text-lg">Tạo phòng mới</h3>
                        <input
                            id="input-room-name"
                            type="text"
                            value={newRoomName}
                            onChange={e => setNewRoomName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
                            placeholder="Nhập tên phòng..."
                            autoFocus
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                text-white placeholder-gray-600 text-sm outline-none
                focus:border-indigo-500/50 focus:bg-white/8 transition-all"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowCreateModal(false); setNewRoomName(''); }}
                                className="flex-1 py-3 rounded-xl font-semibold text-sm text-gray-400
                  border border-white/10 hover:bg-white/5 transition-all"
                            >
                                Hủy
                            </button>
                            <button
                                id="btn-confirm-create-room"
                                onClick={handleCreateRoom}
                                disabled={!newRoomName.trim()}
                                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white
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
