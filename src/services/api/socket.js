// src/services/api/socket.js

import { io } from 'socket.io-client';
import { auth } from '../../config/firebase';

// Môi trường dev (.env.local): trỏ về localhost:3001
// Môi trường production (Railway): không có .env.local → fallback Railway URL
const PRODUCTION_URL = 'https://trungtamlebien-production.up.railway.app/';
const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || PRODUCTION_URL;

const IS_LOCAL = GAME_SERVER_URL.includes('localhost') || GAME_SERVER_URL.includes('192.168.');

console.log(
    `🎮 [Socket] Game Server URL: ${GAME_SERVER_URL}`,
    IS_LOCAL ? '(LOCAL)' : '(PRODUCTION)'
);

export const socket = io(GAME_SERVER_URL, {
    autoConnect: false,
    // Khi chạy local, tăng timeout để tránh lỗi do server khởi động chậm
    timeout: IS_LOCAL ? 10000 : 5000,
});

/** Kết nối đến Game Server với Firebase ID Token + avatar */
export async function connectToGameServer(photoURL = '', fullName = '') {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User chưa đăng nhập.');
    if (socket.connected) socket.disconnect();

    const idToken = await currentUser.getIdToken(true);
    socket.auth = { token: idToken, photoURL, fullName };   // gửi kèm avatar + tên

    return new Promise((resolve, reject) => {
        socket.connect();
        socket.once('connect', () => {
            console.log(`✅ [Socket] Connected | ${socket.id} → ${GAME_SERVER_URL}`);
            resolve();
        });
        socket.once('connect_error', (err) => {
            const hint = IS_LOCAL
                ? ' (Đã khởi động game-server chưa? → cd game-server && npm run dev)'
                : '';
            console.error(`❌ [Socket] Error: ${err.message}${hint}`);
            reject(new Error(err.message));
        });
    });
}

export function disconnectFromGameServer() {
    if (socket.connected) {
        socket.disconnect();
        console.log('🔌 [Socket] Disconnected.');
    }
}

// ── Lobby ────────────────────────────────────
export const createRoom = (roomName) => socket.emit('room:create', { roomName });
export const joinRoom = (roomId) => socket.emit('room:join', { roomId });
export const leaveRoom = (roomId) => socket.emit('room:leave', { roomId });
export const toggleReady = (roomId) => socket.emit('room:ready', { roomId });
export const startGame = (roomId) => socket.emit('room:start', { roomId });

// ── In-Game ──────────────────────────────────
/** direction: 'up' | 'down' | 'left' | 'right' */
export const movePlayer = (roomId, direction) => socket.emit('game:move', { roomId, direction });
export const placeBomb = (roomId) => socket.emit('game:bomb', { roomId });
/** Thoát khỏi game đang diễn ra (nhấn X trong game) — server sẽ xử lý thua + kết thúc game */
export const leaveGame = (roomId) => socket.emit('game:leave', { roomId });

// ── Loạn Đấu Queue ───────────────────────────
export const joinLoandauQueue = () => socket.emit('loandau:join_queue');
export const leaveLoandauQueue = () => socket.emit('loandau:leave_queue');
export const startLoandauSplit = () => socket.emit('loandau:start_split');

// ── Tournament ───────────────────────────────
export const createTournament = (name) => socket.emit('tournament:create', { name });
export const joinTournament = (tournamentId) => socket.emit('tournament:join', { tournamentId });
export const leaveTournament = (tournamentId) => socket.emit('tournament:leave', { tournamentId });
export const sendChallenge = (tournamentId, targetUid) => socket.emit('tournament:challenge', { tournamentId, targetUid });
export const respondChallenge = (tournamentId, challengerUid, accepted) => socket.emit('tournament:challenge_respond', { tournamentId, challengerUid, accepted });
export const startTournament = (tournamentId) => socket.emit('tournament:start', { tournamentId });
export const fetchTournamentList = () => socket.emit('tournament:list');
export const spectateTournamentMatch = (tournamentId, matchId) => socket.emit('tournament:spectate', { tournamentId, matchId });
export const unspectateTournamentMatch = (tournamentId, matchId) => socket.emit('tournament:unspectate', { tournamentId, matchId });
export const sendTournamentEmoji = (tournamentId, matchId, emoji) => socket.emit('tournament:emoji', { tournamentId, matchId, emoji });
