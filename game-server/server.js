import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import admin from 'firebase-admin';
import os from 'os';



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
    'https://toanthaybien.vn',       // Thêm dòng này
    'https://www.toanthaybien.vn'    // Thêm cả có www cho chắc chắn
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
const PLAYER_INIT_LIVES = 2;    // số mạng mặc định
const MOVE_COOLDOWN = 130;   // ms/player
const ENTRY_COST = 20;    // ← Xu mỗi người phải bỏ ra để chơi
// Phần thưởng người thắng = max(tổng xu thu được, 100)
// → ít người: đảm bảo tối thiểu 100 xu; nhiều người: được cả Pool
// Công thức: Math.max(playerCount * ENTRY_COST, 100)

// ─────────────────────────────────────────────
// ←← CHỈNH THỜI GIAN GIỚI HẠN VÁN CHƠI TẠI ĐÂY →→
// Mặc định: 5 phút (300 000 ms). Đổi số bên dưới để tăng/giảm.
// Ví dụ: 3 phút = 180_000 | 10 phút = 600_000
const GAME_DURATION_MS = 5 * 60 * 1000; // ← Sửa con số này (phút * 60 * 1000)

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
    console.log(`[Xu] deductEntryFees called for ${players.length} players: ${players.map(p => p.uid).join(', ')}`);
    const promises = players.map(async (p) => {
        try {
            const ref = db.collection('users').doc(p.uid);
            const snap = await ref.get();
            if (!snap.exists) {
                console.warn(`[Xu] User doc NOT FOUND for uid: ${p.uid}`);
                return;
            }
            const before = snap.data()?.coins ?? 0;
            const newCoins = Math.max(0, before - ENTRY_COST);
            await ref.update({ coins: newCoins });
            console.log(`[Xu] Deducted ${ENTRY_COST} from ${p.uid}: ${before} → ${newCoins}`);
        } catch (e) {
            console.error(`[Xu] FAILED deduct from ${p.uid}:`, e.message, e.code);
        }
    });
    await Promise.all(promises);
    console.log('[Xu] deductEntryFees done.');
}

/** Hoàn trả ENTRY_COST cho những người còn sống (dùng khi hết giờ mà hòa) */
async function refundSurvivors(players, survivorUids) {
    const set = new Set(survivorUids);
    console.log(`[Xu] refundSurvivors: hoàn trả ${ENTRY_COST} Xu cho ${survivorUids.length} người sống`);
    const promises = players.map(async (p) => {
        try {
            const ref = db.collection('users').doc(p.uid);
            const snap = await ref.get();
            if (!snap.exists) return;
            const before = snap.data()?.coins ?? 0;
            if (set.has(p.uid)) {
                // Người còn sống: hoàn lại xu đã trừ trước đó
                await ref.update({ coins: before + ENTRY_COST });
                console.log(`[Xu] Hoàn trả ${ENTRY_COST} cho ${p.uid}: ${before} → ${before + ENTRY_COST}`);
            } else {
                // Người đã chết: không hoàn (xu đã hoàn toàn bị trừ từ deductEntryFees)
                console.log(`[Xu] ${p.uid} đã bị loại - không hoàn xu`);
            }
        } catch (e) {
            console.error(`[Xu] FAILED refund ${p.uid}:`, e.message);
        }
    });
    await Promise.all(promises);
    console.log('[Xu] refundSurvivors done.');
}

/** Award winner with max(pool, 100) xu */
async function rewardWinner(uid, playerCount) {
    try {
        const pool = playerCount * ENTRY_COST; // tổng xu thu được từ người chơi
        const reward = Math.max(pool, 100);    // đảm bảo tối thiểu 100 xu
        console.log(`[Xu] rewardWinner uid=${uid} | pool=${pool} | reward=${reward}`);
        const ref = db.collection('users').doc(uid);
        const snap = await ref.get();
        if (!snap.exists) {
            console.warn(`[Xu] Winner doc NOT FOUND for uid: ${uid}`);
            return;
        }
        const before = snap.data()?.coins ?? 0;
        await ref.update({ coins: before + reward });
        console.log(`[Xu] Awarded ${reward} to ${uid}: ${before} → ${before + reward}`);
    } catch (e) {
        console.error(`[Xu] FAILED reward uid ${uid}:`, e.message, e.code);
    }
}

/** Initialize game state for a room */
function initGameState(room) {
    const map = generateMap();
    const playerCount = room.players.length;

    // ── Ẩn vật phẩm ngẫu nhiên dưới các ô gạch ──
    const blockPositions = [];
    for (let r = 0; r < MAP_H; r++)
        for (let c = 0; c < MAP_W; c++)
            if (map[r][c] === CELL_BLOCK) blockPositions.push([r, c]);

    // Fisher-Yates shuffle
    for (let i = blockPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [blockPositions[i], blockPositions[j]] = [blockPositions[j], blockPositions[i]];
    }

    // Mỗi loại item: số lượng = số người chơi
    const ITEM_TYPES = ['life', 'range', 'bomb'];
    const hiddenItems = {};
    let idx = 0;
    for (const type of ITEM_TYPES) {
        for (let k = 0; k < playerCount && idx < blockPositions.length; k++, idx++) {
            const [r, c] = blockPositions[idx];
            hiddenItems[`${r},${c}`] = type;
        }
    }

    const players = {};
    room.players.forEach((p, i) => {
        const [row, col] = SPAWN_POSITIONS[i % SPAWN_POSITIONS.length];
        players[p.uid] = {
            uid: p.uid, name: p.name, photoURL: p.photoURL || '',
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            row, col, alive: true,
            lives: PLAYER_INIT_LIVES,
            bombRange: BOMB_RANGE,
            maxBombs: 2,
            lastMove: 0,
        };
    });
    return { map, players, bombs: [], explosions: [], items: [], hiddenItems, status: 'playing', winner: null, startedAt: Date.now() };
}

/** Public (serializable) game state sent to clients */
function publicState(gs) {
    const elapsed = Date.now() - (gs.startedAt ?? Date.now());
    const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
    return {
        map: gs.map,
        players: gs.players,
        bombs: gs.bombs.map(b => ({ id: b.id, row: b.row, col: b.col, ownerUid: b.ownerUid, expiresAt: b.expiresAt })),
        explosions: gs.explosions,
        items: gs.items,
        timeRemaining: remaining,   // ms còn lại — client dùng để hiển thị đồng hồ
        status: gs.status,
        winner: gs.winner,
        winnerName: gs.winner ? gs.players[gs.winner]?.name : null,
    };
}

/** Explode a bomb and handle chain reactions + player deaths */
async function explodeBomb(roomId, bombId) {
    const gs = gameStates.get(roomId);
    if (!gs || gs.status !== 'playing') return;

    const idx = gs.bombs.findIndex(b => b.id === bombId);
    if (idx === -1) return;
    const bomb = gs.bombs.splice(idx, 1)[0];

    // Dùng range ghi vào bom lúc đặt (để tôn trọng buff nhận được)
    const cells = calcExplosion(gs.map, bomb.row, bomb.col, bomb.range ?? BOMB_RANGE);

    // Destroy blocks & reveal hidden items
    for (const { row, col } of cells) {
        if (gs.map[row][col] === CELL_BLOCK) {
            gs.map[row][col] = CELL_EMPTY;
            const key = `${row},${col}`;
            if (gs.hiddenItems?.[key]) {
                gs.items.push({
                    id: `item_${Date.now()}_${row}_${col}_${Math.random().toString(36).slice(2, 5)}`,
                    row, col, type: gs.hiddenItems[key],
                });
                delete gs.hiddenItems[key];
            }
        }
    }

    // Chain: trigger other bombs in explosion cells
    for (const { row, col } of cells) {
        const chainBomb = gs.bombs.find(b => b.row === row && b.col === col);
        if (chainBomb) {
            clearTimeout(chainBomb._timer);
            explodeBomb(roomId, chainBomb.id);
        }
    }

    // Damage players in blast (lives system)
    let someoneDied = false;
    for (const p of Object.values(gs.players)) {
        if (p.alive && cells.some(c => c.row === p.row && c.col === p.col)) {
            p.lives = (p.lives ?? 1) - 1;
            if (p.lives <= 0) {
                p.alive = false;
                someoneDied = true;
            }
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
            clearTimeout(gs._gameTimer); // hủy bộ đếm 5 phút vì game đã xong sớm
            gs.winner = alive.length === 1 ? alive[0].uid : null;

            const winnerName = gs.winner ? gs.players[gs.winner]?.name : null;
            // Tính trước để gửi cho client biết trước khi Firebase cập nhật xong
            const room = rooms.get(roomId);
            const reward = room ? Math.max(room.players.length * ENTRY_COST, 100) : 100;
            io.to(roomId).emit('game:over', { winner: gs.winner, winnerName, reward });

            // Xu transactions — await để bắt lỗi đúng cách
            if (room) {
                try {
                    await deductEntryFees(room.players);
                    if (gs.winner) await rewardWinner(gs.winner, room.players.length);
                } catch (e) {
                    console.error('[Xu] Transaction error (explodeBomb):', e.message);
                }
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

// Test endpoint: ghi thẳng vào Firestore để xác nhận Admin SDK có hoạt động
// GET /test-xu?uid=<firebase_uid>
app.get('/test-xu', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'Missing ?uid=...' });
    try {
        const ref = db.collection('users').doc(uid);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'User not found', uid });
        const before = snap.data()?.coins ?? 0;
        await ref.update({ coins: before + 1 }); // cộng thử 1 xu
        res.json({ ok: true, uid, before, after: before + 1, msg: '+1 xu test thành công' });
    } catch (e) {
        res.status(500).json({ error: e.message, code: e.code });
    }
});

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

    // Client yêu cầu làm mới danh sách phòng
    socket.on('rooms:refresh', () => {
        socket.emit('rooms:list', getAllRooms());
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

        // ── Bộ đếm thời gian tối đa (GAME_DURATION_MS) ──
        // Khi hết giờ: người còn nhiều mạng nhất thắng. Nếu bằng nhau → hòa.
        const gameTimer = setTimeout(async () => {
            const gs2 = gameStates.get(roomId);
            if (!gs2 || gs2.status !== 'playing') return;

            gs2.status = 'finished';

            const alive = Object.values(gs2.players).filter(p => p.alive);
            const maxLives = Math.max(...alive.map(p => p.lives ?? 0), 0);
            const topPlayers = alive.filter(p => (p.lives ?? 0) === maxLives);

            gs2.winner = topPlayers.length === 1 ? topPlayers[0].uid : null;
            const winnerName = gs2.winner ? gs2.players[gs2.winner]?.name : null;
            const isDraw = gs2.winner === null; // hòa: không ai thắng rõ ràng

            // Lấy room trước khi emit
            const room2 = rooms.get(roomId);

            io.to(roomId).emit('game:over', {
                winner: gs2.winner,
                winnerName,
                reason: 'timeout',
                reward: (!isDraw && room2) ? Math.max(room2.players.length * ENTRY_COST, 100) : 0,
                // Hòa hết giờ → hoàn xu cho người còn sống
                refundedUids: isDraw ? alive.map(p => p.uid) : [],
            });
            console.log(`⏰ [Game] Timeout | ${isDraw ? 'HÒA — hoàn xu người sống' : `Thắng: ${winnerName}`} | room: ${roomId}`);

            if (room2) {
                try {
                    // Trừ xu tất cả người chơi trước
                    await deductEntryFees(room2.players);

                    if (isDraw) {
                        // Hòa hết giờ: hoàn lại 20 xu cho người còn sống
                        await refundSurvivors(room2.players, alive.map(p => p.uid));
                    } else {
                        // Có người thắng rõ ràng: thưởng bình thường
                        await rewardWinner(gs2.winner, room2.players.length);
                    }
                } catch (e) {
                    console.error('[Xu] Transaction error (gameTimer):', e.message);
                }
            }

            // Dọn sau 15s
            setTimeout(() => {
                gameStates.delete(roomId);
                const r = rooms.get(roomId);
                if (r) { r.status = 'waiting'; r.players.forEach(p => p.isReady = false); io.emit('rooms:list', getAllRooms()); }
            }, 15000);
        }, GAME_DURATION_MS);



        // Lưu timer vào game state để có thể clearTimeout khi game kết thúc sớm
        gs._gameTimer = gameTimer;
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

        // Thu thập vật phẩm nếu có trên ô vừa đến
        const itemIdx = gs.items.findIndex(item => item.row === nr && item.col === nc);
        if (itemIdx !== -1) {
            const item = gs.items.splice(itemIdx, 1)[0];
            if (item.type === 'life') player.lives = Math.min((player.lives ?? 0) + 1, 5);
            if (item.type === 'range') player.bombRange = Math.min((player.bombRange ?? BOMB_RANGE) + 1, 8);
            if (item.type === 'bomb') player.maxBombs = Math.min((player.maxBombs ?? 2) + 2, 6);
        }

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
            range: player.bombRange ?? BOMB_RANGE,  // lưu range lúc đặt
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

/** Lấy địa chỉ IPv4 LAN đầu tiên (bỏ qua loopback) */
function getLanIP() {
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const iface of (ifaces || [])) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return null;
}

httpServer.listen(PORT, '0.0.0.0', () => {
    const lanIP = getLanIP();
    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log(`║  💣 Đặt Bom Game Server  │  Port ${PORT}            ║`);
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log(`║  🖥️  Localhost : http://localhost:${PORT}             ║`);
    if (lanIP) {
        console.log(`║  📱 LAN (ĐT) : http://${lanIP}:${PORT}        ║`);
        console.log(`║     → .env.local: VITE_GAME_SERVER_URL=http://${lanIP}:${PORT} ║`);
    }
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');
});
