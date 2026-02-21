import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import admin from 'firebase-admin';



// ─────────────────────────────────────────────
// 1. Express + HTTP Server
// ─────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
// Allow cả localhost và IP LAN để điện thoại trên cùng mạng kết nối được
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    /^http:\/\/192\.168\.\d+\.\d+:5173$/,   // bất kỳ IP 192.168.x.x
    /^http:\/\/10\.\d+\.\d+\.\d+:5173$/,    // bất kỳ IP 10.x.x.x
];

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'], credentials: true },
});

// ─────────────────────────────────────────────
// 2. Firebase Admin
// ─────────────────────────────────────────────
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Railway / production: đọc từ biến môi trường
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
    // Local: đọc từ file (git-ignored)
    const { readFileSync } = await import('fs');
    serviceAccount = JSON.parse(
        readFileSync(new URL('./serviceAccountKey.json', import.meta.url))
    );
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
console.log('🔥 [Firebase Admin] Initialized successfully.');


// ─────────────────────────────────────────────
// 3. Game Constants
// ─────────────────────────────────────────────
const MAP_W = 29;          // must be odd — wider map with camera tracking
const MAP_H = 13;          // must be odd
const CELL_EMPTY = 0;
const CELL_WALL = 1;      // indestructible
const CELL_BLOCK = 2;      // destructible
const BOMB_TIMER = 3000;  // ms
const EXPLOSION_DUR = 700;   // ms
const BOMB_RANGE = 3;
const MOVE_COOLDOWN = 130;   // ms/player
const ENTRY_COST = 10;    // Xu deducted to play
const WIN_REWARD = 100;   // Xu awarded to winner

const PLAYER_COLORS = [
    '#4ade80', '#f87171', '#60a5fa', '#facc15',
    '#c084fc', '#fb923c', '#34d399', '#f472b6',
    '#a78bfa', '#38bdf8', '#fb7185', '#86efac',
];

// Spawn positions trải đều trên map rộng (safe zone 2 ô xung quanh)
const SPAWN_POSITIONS = [
    // 4 góc
    [1, 1], [1, MAP_W - 2],
    [MAP_H - 2, 1], [MAP_H - 2, MAP_W - 2],
    // Giữa các cạnh trên/dưới
    [1, Math.floor(MAP_W * 0.25)],
    [1, Math.floor(MAP_W * 0.5)],
    [1, Math.floor(MAP_W * 0.75)],
    [MAP_H - 2, Math.floor(MAP_W * 0.25)],
    [MAP_H - 2, Math.floor(MAP_W * 0.5)],
    [MAP_H - 2, Math.floor(MAP_W * 0.75)],
    // Cạnh trái/phải giữa
    [Math.floor(MAP_H / 2), 1],
    [Math.floor(MAP_H / 2), MAP_W - 2],
];

const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

// ─────────────────────────────────────────────
// 4. Auth Middleware
// ─────────────────────────────────────────────
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized: No token'));
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        const photoURL = socket.handshake.auth?.photoURL || '';
        const fullName = socket.handshake.auth?.fullName || '';
        // ưu tiên: fullName (Firestore) > decoded.name (Firebase Auth) > email
        const name = fullName || decoded.name || decoded.email;
        socket.user = { uid: decoded.uid, email: decoded.email, name, photoURL };
        next();
    } catch (e) {
        next(new Error('Unauthorized: Invalid token'));
    }
});

// ─────────────────────────────────────────────
// 5. Room Manager
// ─────────────────────────────────────────────
const rooms = new Map();        // roomId → RoomObject
const gameStates = new Map();   // roomId → GameState

function buildRoomSummary(room) {
    return {
        id: room.id, name: room.name, host: room.host,
        playerCount: room.players.length, maxPlayers: room.maxPlayers,
        status: room.status,
    };
}
function getAllRooms() {
    return [...rooms.values()].map(r => buildRoomSummary(r));
}
function createRoom(hostUid, hostName, hostPhotoURL, roomName) {
    const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const room = {
        id, name: roomName, host: hostUid,
        players: [{ uid: hostUid, name: hostName, photoURL: hostPhotoURL, isReady: false, isHost: true }],
        status: 'waiting', maxPlayers: 99, createdAt: Date.now(),
    };
    rooms.set(id, room);
    return room;
}

// ─────────────────────────────────────────────
// 6. Game Engine
// ─────────────────────────────────────────────

/** Generate a Bomberman-style map */
function generateMap() {
    const map = Array.from({ length: MAP_H }, (_, r) =>
        Array.from({ length: MAP_W }, (_, c) => {
            if (r === 0 || r === MAP_H - 1 || c === 0 || c === MAP_W - 1) return CELL_WALL;
            if (r % 2 === 0 && c % 2 === 0) return CELL_WALL;
            const isSafe = SPAWN_POSITIONS.some(([sr, sc]) =>
                Math.abs(r - sr) + Math.abs(c - sc) <= 2
            );
            return isSafe ? CELL_EMPTY : (Math.random() < 0.45 ? CELL_BLOCK : CELL_EMPTY);
        })
    );
    return map;
}

/** Cells hit by a bomb explosion */
function calcExplosion(map, row, col, range) {
    const cells = [{ row, col }];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        for (let i = 1; i <= range; i++) {
            const r = row + dr * i, c = col + dc * i;
            if (r < 0 || r >= MAP_H || c < 0 || c >= MAP_W) break;
            if (map[r][c] === CELL_WALL) break;          // wall: stop but don't include
            cells.push({ row: r, col: c });
            if (map[r][c] === CELL_BLOCK) break;          // block: include, then stop
        }
    }
    return cells;
}

/** Deduct ENTRY_COST from all players, catch errors silently */
async function deductEntryFees(players) {
    const promises = players.map(async (p) => {
        try {
            const ref = db.collection('users').doc(p.uid);
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                const coins = (snap.data()?.coins || 0) - ENTRY_COST;
                tx.update(ref, { coins: Math.max(0, coins) });
            });
        } catch (e) {
            console.error(`[Xu] Failed to deduct from ${p.uid}:`, e.message);
        }
    });
    await Promise.all(promises);
}

/** Award WIN_REWARD to winner */
async function rewardWinner(uid) {
    try {
        const ref = db.collection('users').doc(uid);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const coins = (snap.data()?.coins || 0) + WIN_REWARD;
            tx.update(ref, { coins });
        });
        console.log(`💰 [Xu] Awarded ${WIN_REWARD} coins to ${uid}`);
    } catch (e) {
        console.error(`[Xu] Failed to reward ${uid}:`, e.message);
    }
}

/** Initialize game state for a room */
function initGameState(room) {
    const map = generateMap();
    const players = {};
    room.players.forEach((p, i) => {
        const [row, col] = SPAWN_POSITIONS[i % SPAWN_POSITIONS.length];
        players[p.uid] = {
            uid: p.uid,
            name: p.name,
            photoURL: p.photoURL || '',
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            row, col,
            alive: true,
            maxBombs: 1,
            lastMove: 0,
        };
    });
    return { map, players, bombs: [], explosions: [], status: 'playing', winner: null };
}

/** Public (serializable) game state sent to clients */
function publicState(gs) {
    return {
        map: gs.map,
        players: gs.players,
        bombs: gs.bombs.map(b => ({ id: b.id, row: b.row, col: b.col, ownerUid: b.ownerUid, expiresAt: b.expiresAt })),
        explosions: gs.explosions,
        status: gs.status,
        winner: gs.winner,
        winnerName: gs.winner ? gs.players[gs.winner]?.name : null,
    };
}

/** Explode a bomb and handle chain reactions + player deaths */
function explodeBomb(roomId, bombId) {
    const gs = gameStates.get(roomId);
    if (!gs || gs.status !== 'playing') return;

    const idx = gs.bombs.findIndex(b => b.id === bombId);
    if (idx === -1) return;
    const bomb = gs.bombs.splice(idx, 1)[0];

    const cells = calcExplosion(gs.map, bomb.row, bomb.col, BOMB_RANGE);

    // Destroy blocks & collect cells
    for (const { row, col } of cells) {
        if (gs.map[row][col] === CELL_BLOCK) gs.map[row][col] = CELL_EMPTY;
    }

    // Chain: trigger other bombs in explosion cells
    for (const { row, col } of cells) {
        const chainBomb = gs.bombs.find(b => b.row === row && b.col === col);
        if (chainBomb) {
            clearTimeout(chainBomb._timer);
            explodeBomb(roomId, chainBomb.id);
        }
    }

    // Kill players in blast
    let someoneDied = false;
    for (const p of Object.values(gs.players)) {
        if (p.alive && cells.some(c => c.row === p.row && c.col === p.col)) {
            p.alive = false;
            someoneDied = true;
        }
    }

    // Add explosion visual
    const expEntry = { id: `exp_${Date.now()}`, cells, expiresAt: Date.now() + EXPLOSION_DUR };
    gs.explosions.push(expEntry);
    setTimeout(() => {
        const gs2 = gameStates.get(roomId);
        if (gs2) {
            gs2.explosions = gs2.explosions.filter(e => e.id !== expEntry.id);
            broadcastState(roomId);
        }
    }, EXPLOSION_DUR);

    // Check win condition
    if (someoneDied) {
        const alive = Object.values(gs.players).filter(p => p.alive);
        if (alive.length <= 1) {
            gs.status = 'finished';
            gs.winner = alive.length === 1 ? alive[0].uid : null;

            const winnerName = gs.winner ? gs.players[gs.winner]?.name : null;
            io.to(roomId).emit('game:over', { winner: gs.winner, winnerName });

            // Xu transactions
            const room = rooms.get(roomId);
            if (room) {
                deductEntryFees(room.players);
                if (gs.winner) rewardWinner(gs.winner);
            }

            // Clean up after 15s
            setTimeout(() => {
                gameStates.delete(roomId);
                const r = rooms.get(roomId);
                if (r) { r.status = 'waiting'; r.players.forEach(p => p.isReady = false); io.emit('rooms:list', getAllRooms()); }
            }, 15000);
        }
    }

    broadcastState(roomId);
}

function broadcastState(roomId) {
    const gs = gameStates.get(roomId);
    if (gs) io.to(roomId).emit('game:state', publicState(gs));
}

// ─────────────────────────────────────────────
// 7. REST
// ─────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', message: '🎮 Game Server running' }));
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), rooms: rooms.size }));

// ─────────────────────────────────────────────
// 8. Socket Events
// ─────────────────────────────────────────────
io.on('connection', (socket) => {
    const { uid, name, email, photoURL } = socket.user;
    console.log(`✅ [Socket] Connected | ${socket.id} | ${email}`);

    socket.emit('rooms:list', getAllRooms());

    // ─── Lobby Events ────────────────────────────

    socket.on('room:create', ({ roomName } = {}) => {
        if (!roomName?.trim()) return socket.emit('room:error', { message: 'Tên phòng không được để trống.' });
        const inRoom = [...rooms.values()].find(r => r.players.some(p => p.uid === uid));
        if (inRoom) return socket.emit('room:error', { message: 'Bạn đang ở trong phòng khác.' });
        const room = createRoom(uid, name, photoURL, roomName.trim());
        socket.join(room.id);
        socket.emit('room:joined', room);
        io.emit('rooms:list', getAllRooms());
        console.log(`🏠 [Room] Created: "${room.name}" by ${email}`);
    });

    socket.on('room:join', ({ roomId } = {}) => {
        const room = rooms.get(roomId);
        if (!room) return socket.emit('room:error', { message: 'Phòng không tồn tại.' });
        if (room.status !== 'waiting') return socket.emit('room:error', { message: 'Phòng đang thi đấu.' });
        if (room.players.some(p => p.uid === uid)) return socket.emit('room:error', { message: 'Bạn đã trong phòng này.' });
        room.players.push({ uid, name, photoURL, isReady: false, isHost: false });
        socket.join(roomId);
        socket.emit('room:joined', room);
        io.to(roomId).emit('room:updated', room);
        io.emit('rooms:list', getAllRooms());
        console.log(`👤 [Room] ${email} joined "${room.name}"`);
    });

    socket.on('room:leave', ({ roomId } = {}) => {
        const room = rooms.get(roomId);
        if (!room) return;
        room.players = room.players.filter(p => p.uid !== uid);
        socket.leave(roomId);
        if (room.players.length === 0) {
            rooms.delete(roomId);
        } else {
            if (room.host === uid) { room.host = room.players[0].uid; room.players[0].isHost = true; }
            io.to(roomId).emit('room:updated', room);
        }
        io.emit('rooms:list', getAllRooms());
    });

    socket.on('room:ready', ({ roomId } = {}) => {
        const room = rooms.get(roomId);
        if (!room) return;
        const player = room.players.find(p => p.uid === uid);
        if (!player || player.isHost) return;
        player.isReady = !player.isReady;
        io.to(roomId).emit('room:updated', room);
    });

    socket.on('room:start', async ({ roomId } = {}) => {
        const room = rooms.get(roomId);
        if (!room) return;
        if (room.host !== uid) return socket.emit('room:error', { message: 'Chỉ chủ phòng mới có thể bắt đầu.' });
        if (room.players.length < 2) return socket.emit('room:error', { message: 'Cần ít nhất 2 người chơi.' });
        const nonHostReady = room.players.filter(p => !p.isHost).every(p => p.isReady);
        if (!nonHostReady) return socket.emit('room:error', { message: 'Vẫn còn người chơi chưa sẵn sàng.' });

        const gs = initGameState(room);
        gameStates.set(roomId, gs);
        room.status = 'playing';
        io.to(roomId).emit('game:start', { roomId, gameState: publicState(gs) });
        io.emit('rooms:list', getAllRooms());
        console.log(`🚀 [Game] Started in "${room.name}" (${room.players.length} players)`);
    });

    // ─── In-Game Events ───────────────────────────

    socket.on('game:move', ({ roomId, direction } = {}) => {
        const gs = gameStates.get(roomId);
        if (!gs || gs.status !== 'playing') return;
        const player = gs.players[uid];
        if (!player || !player.alive) return;

        // Throttle
        const now = Date.now();
        if (now - player.lastMove < MOVE_COOLDOWN) return;
        player.lastMove = now;

        const delta = DIRS[direction];
        if (!delta) return;
        const nr = player.row + delta[0];
        const nc = player.col + delta[1];

        if (nr < 0 || nr >= MAP_H || nc < 0 || nc >= MAP_W) return;
        if (gs.map[nr][nc] !== CELL_EMPTY) return;
        // Can't walk into a bomb (except the one you just placed — simplified: no pass-through)
        if (gs.bombs.some(b => b.row === nr && b.col === nc)) return;

        player.row = nr;
        player.col = nc;
        broadcastState(roomId);
    });

    socket.on('game:bomb', ({ roomId } = {}) => {
        const gs = gameStates.get(roomId);
        if (!gs || gs.status !== 'playing') return;
        const player = gs.players[uid];
        if (!player || !player.alive) return;

        // Check active bombs by this player
        const myBombs = gs.bombs.filter(b => b.ownerUid === uid).length;
        if (myBombs >= player.maxBombs) return;

        // No stacking on same cell
        if (gs.bombs.some(b => b.row === player.row && b.col === player.col)) return;

        const bombId = `bomb_${Date.now()}_${uid.slice(0, 6)}`;
        const timer = setTimeout(() => explodeBomb(roomId, bombId), BOMB_TIMER);
        gs.bombs.push({
            id: bombId, row: player.row, col: player.col,
            ownerUid: uid, expiresAt: Date.now() + BOMB_TIMER, _timer: timer,
        });
        broadcastState(roomId);
    });

    // ─── Sync: client requests current state after navigation ──
    socket.on('game:sync', ({ roomId } = {}) => {
        const gs = gameStates.get(roomId);
        if (gs) {
            socket.emit('game:state', publicState(gs));
            console.log(`🔄 [Sync] Sent state to ${email} for room ${roomId}`);
        } else {
            socket.emit('game:sync_error', { message: 'Không tìm thấy game state.' });
        }
    });

    // ─── Disconnect ───────────────────────────────

    socket.on('disconnect', (reason) => {
        console.log(`❌ [Socket] Disconnected | ${socket.id} | ${email} | ${reason}`);

        for (const [roomId, room] of rooms.entries()) {
            if (!room.players.some(p => p.uid === uid)) continue;

            const gs = gameStates.get(roomId);
            const wasPlaying = gs && gs.status === 'playing';

            // Remove from room
            room.players = room.players.filter(p => p.uid !== uid);

            if (room.players.length === 0) {
                // Phòng trống — dọn hết
                rooms.delete(roomId);
                gameStates.delete(roomId);
                io.emit('rooms:list', getAllRooms());
                return;
            }

            // Cập nhật host nếu cần
            if (room.host === uid) {
                room.host = room.players[0].uid;
                room.players[0].isHost = true;
            }

            if (wasPlaying && gs.players[uid]) {
                // ── Đang chơi: xử thua người disconnect ──
                gs.players[uid].alive = false;
                console.log(`⚠️  [Game] ${email} disconnected during game → eliminated`);

                const alivePlayers = Object.values(gs.players).filter(p => p.alive);

                if (alivePlayers.length <= 1) {
                    // Kết thúc game
                    gs.status = 'finished';
                    gs.winner = alivePlayers.length === 1 ? alivePlayers[0].uid : null;
                    const winnerName = gs.winner ? gs.players[gs.winner]?.name : null;

                    io.to(roomId).emit('game:over', {
                        winner: gs.winner,
                        winnerName,
                        reason: 'disconnect', // để client biết nguyên nhân
                    });
                    console.log(`🏆 [Game] Over | winner: ${winnerName || 'none'} | room: ${roomId}`);

                    // Xu
                    deductEntryFees(room.players);
                    if (gs.winner) rewardWinner(gs.winner);

                    // Dọn sau 15s
                    setTimeout(() => {
                        gameStates.delete(roomId);
                        const r = rooms.get(roomId);
                        if (r) {
                            r.status = 'waiting';
                            r.players.forEach(p => p.isReady = false);
                            io.emit('rooms:list', getAllRooms());
                        }
                    }, 15000);
                } else {
                    // Vẫn còn nhiều người → broadcast state mới (player dead)
                    broadcastState(roomId);
                }
            } else {
                // Đang ở lobby → cập nhật room
                io.to(roomId).emit('room:updated', room);
            }

            io.emit('rooms:list', getAllRooms());
        }
    });
});

// ─────────────────────────────────────────────
// 9. Start
// ─────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log(`║  💣 Đặt Bom Game Server  |  Port ${PORT}  ║`);
    console.log('║  🌐 CORS: localhost + LAN (192.168.x.x)  ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
