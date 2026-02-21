// src/services/api/socket.js

import { io } from 'socket.io-client';
import { auth } from '../../config/firebase';

const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || 'http://localhost:3001';

export const socket = io(GAME_SERVER_URL, { autoConnect: false });

/** Kết nối đến Game Server với Firebase ID Token + avatar */
export async function connectToGameServer(photoURL = '', fullName = '') {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User chưa đăng nhập.');
    if (socket.connected) socket.disconnect();
    const idToken = await currentUser.getIdToken(true);
    socket.auth = { token: idToken, photoURL, fullName };   // gửi kèm avatar + tên
    return new Promise((resolve, reject) => {
        socket.connect();
        socket.once('connect', () => { console.log(`✅ [Socket] Connected | ${socket.id}`); resolve(); });
        socket.once('connect_error', (err) => { console.error(`❌ [Socket] Error: ${err.message}`); reject(new Error(err.message)); });
    });
}

export function disconnectFromGameServer() {
    if (socket.connected) { socket.disconnect(); console.log('🔌 [Socket] Disconnected.'); }
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
