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
const PLAYER_INIT_LIVES = 1;    // số mạng mặc định
const MOVE_COOLDOWN = 130;   // ms/player
const ENTRY_COST = 20;    // ← Xu mỗi người phải bỏ ra để chơi
// Phần thưởng người thắng = số người × ENTRY_COST (toàn bộ pool).
// Không có sàn cố định để tránh gian lận khi ít người chơi.
/** Tính xu thưởng cho người thắng (toàn bộ pool không floor) */
function calcReward(playerCount) { return playerCount * ENTRY_COST; }

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
const tournaments = new Map();  // tournamentId → TournamentObject
const socketByUid = new Map();  // uid → socket (O(1) lookup)
// Loạn Đấu queue (single global queue)
const LOANDAU_QUEUE_ID = 'loandau_main';
const loandauQueue = new Map(); // LOANDAU_QUEUE_ID → { hostUid, players, createdAt }

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
function createRoom(hostUid, hostName, hostPhotoURL, roomName, options = {}) {
    const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const room = {
        id, name: roomName, host: hostUid,
        players: [{ uid: hostUid, name: hostName, photoURL: hostPhotoURL, isReady: false, isHost: true }],
        status: 'waiting',
        mode: options.mode ?? 'loanDau',       // 'loanDau' | 'dauCap'
        maxPlayers: options.maxPlayers ?? 5,   // Loạn Đấu default = 5
        tournamentId: options.tournamentId ?? null,
        matchId: options.matchId ?? null,
        createdAt: Date.now(),
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

/** Award winner with playerCount * ENTRY_COST xu (no artificial floor) */
async function rewardWinner(uid, playerCount) {
    try {
        const reward = calcReward(playerCount); // = playerCount × 20 Xu
        console.log(`[Xu] rewardWinner uid=${uid} | playerCount=${playerCount} | reward=${reward}`);
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

/** Ẩn items ngẫu nhiên dưới các ô gạch */
function generateHiddenItems(blockPositions, playerCount, itemTypes) {
    const hiddenItems = {};
    let idx = 0;
    for (const type of itemTypes) {
        for (let k = 0; k < playerCount + 1 && idx < blockPositions.length; k++, idx++) {
            const [r, c] = blockPositions[idx];
            hiddenItems[`${r},${c}`] = type;
        }
    }
    return hiddenItems;
}

/** Initialize game state for a room
 * @param {object} room
 * @param {object} [options]
 * @param {number} [options.durationMs]   - override game duration (default GAME_DURATION_MS)
 * @param {boolean} [options.noLifeItem]  - exclude 'life' items (Đấu Cặp mode)
 * @param {string} [options.tournamentId] - link to tournament
 * @param {string} [options.matchId]      - match ID within tournament
 */
function initGameState(room, options = {}) {
    const map = generateMap();
    const playerCount = room.players.length;
    const durationMs = options.durationMs ?? GAME_DURATION_MS;

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

    // Đấu Cặp: không có item 'life', thêm 'star' thay thế
    const itemTypes = options.noLifeItem
        ? ['range', 'bomb', 'star']
        : ['life', 'range', 'bomb'];
    const hiddenItems = generateHiddenItems(blockPositions, playerCount, itemTypes);

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
            stars: 0,  // dùng trong chế độ Đấu Cặp
        };
    });
    return {
        map, players, bombs: [], explosions: [], items: [], hiddenItems,
        status: 'playing', winner: null,
        startedAt: Date.now(),
        durationMs,
        mode: room.mode ?? 'loanDau',
        tournamentId: options.tournamentId ?? null,
        matchId: options.matchId ?? null,
    };
}

/** Public (serializable) game state sent to clients */
function publicState(gs) {
    const elapsed = Date.now() - (gs.startedAt ?? Date.now());
    const remaining = Math.max(0, (gs.durationMs ?? GAME_DURATION_MS) - elapsed);
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
        mode: gs.mode ?? 'loanDau',
        tournamentId: gs.tournamentId ?? null,
        matchId: gs.matchId ?? null,
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
    const expEntry = { id: `exp_${Date.now()}`, ownerUid: bomb.ownerUid, cells, expiresAt: Date.now() + EXPLOSION_DUR };
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
            const reward = room ? calcReward(room.players.length) : 0;
            io.to(roomId).emit('game:over', { winner: gs.winner, winnerName, reward: gs.tournamentId ? 0 : reward });

            // Xu transactions chỉ cho Loạn Đấu thường
            if (room && !gs.tournamentId) {
                try {
                    await deductEntryFees(room.players);
                    if (gs.winner) await rewardWinner(gs.winner, room.players.length);
                } catch (e) {
                    console.error('[Xu] Transaction error (explodeBomb):', e.message);
                }
            }

            // Nếu là tournament match → gọi handleMatchFinished
            if (gs.tournamentId) {
                await handleMatchFinished(roomId, gs.tournamentId, gs.matchId, gs.winner);
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
    if (!gs) return;
    const state = publicState(gs);
    io.to(roomId).emit('game:state', state);
    // Spectators trong chế độ Đấu Cặp cũng nhận state
    io.to(`spec_${roomId}`).emit('game:state', state);
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
    socketByUid.set(uid, socket);

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
        if (room.players.length >= room.maxPlayers) return socket.emit('room:error', { message: `Phòng đã đủ ${room.maxPlayers} người.` });
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

            // Đấu Cặp: winner = người có nhiều sao hơn (tiebreak random nếu bằng)
            let gs2Winner = null;
            if (gs2.mode === 'dauCap') {
                const allPlayers = Object.values(gs2.players);
                const maxStars = Math.max(...allPlayers.map(p => p.stars ?? 0));
                const topByStars = allPlayers.filter(p => (p.stars ?? 0) === maxStars);
                if (topByStars.length === 1) {
                    gs2Winner = topByStars[0].uid;
                } else if (alive.length === 1) {
                    gs2Winner = alive[0].uid; // người còn sống thắng dù sao ít hơn
                } else if (topByStars.length > 1) {
                    // random tiebreak
                    gs2Winner = topByStars[Math.floor(Math.random() * topByStars.length)].uid;
                }
            } else {
                // Loạn Đấu: winner = người nhiều mạng nhất
                const maxLives = Math.max(...alive.map(p => p.lives ?? 0), 0);
                const topPlayers = alive.filter(p => (p.lives ?? 0) === maxLives);
                gs2Winner = topPlayers.length === 1 ? topPlayers[0].uid : null;
            }

            gs2.winner = gs2Winner;
            const winnerName = gs2.winner ? gs2.players[gs2.winner]?.name : null;
            const isDraw = gs2.winner === null;

            // Lấy room trước khi emit
            const room2 = rooms.get(roomId);

            io.to(roomId).emit('game:over', {
                winner: gs2.winner,
                winnerName,
                reason: 'timeout',
                reward: (!isDraw && room2 && !gs2.tournamentId) ? calcReward(room2.players.length) : 0,
                refundedUids: isDraw ? alive.map(p => p.uid) : [],
            });
            console.log(`⏰ [Game] Timeout | ${isDraw ? 'HÒA — hoàn xu người sống' : `Thắng: ${winnerName}`} | room: ${roomId}`);

            // Xu transactions chỉ dành cho Loạn Đấu thường (không phải tournament)
            if (room2 && !gs2.tournamentId) {
                try {
                    await deductEntryFees(room2.players);
                    if (isDraw) {
                        await refundSurvivors(room2.players, alive.map(p => p.uid));
                    } else {
                        await rewardWinner(gs2.winner, room2.players.length);
                    }
                } catch (e) {
                    console.error('[Xu] Transaction error (gameTimer):', e.message);
                }
            }

            // Nếu là tournament match → gọi handleMatchFinished
            if (gs2.tournamentId) {
                await handleMatchFinished(roomId, gs2.tournamentId, gs2.matchId, gs2.winner);
            }

            // Dọn sau 15s
            setTimeout(() => {
                gameStates.delete(roomId);
                const r = rooms.get(roomId);
                if (r) { r.status = 'waiting'; r.players.forEach(p => p.isReady = false); io.emit('rooms:list', getAllRooms()); }
            }, 15000);
        }, gs.durationMs);

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
        // Can't walk into a bomb
        if (gs.bombs.some(b => b.row === nr && b.col === nc)) return;
        // Can't walk into another alive player
        if (Object.values(gs.players).some(p => p.alive && p.uid !== uid && p.row === nr && p.col === nc)) return;

        player.row = nr;
        player.col = nc;

        // Thu thập vật phẩm nếu có trên ô vừa đến
        const itemIdx = gs.items.findIndex(item => item.row === nr && item.col === nc);
        if (itemIdx !== -1) {
            const item = gs.items.splice(itemIdx, 1)[0];
            if (item.type === 'life') player.lives = Math.min((player.lives ?? 0) + 1, 5);
            if (item.type === 'range') player.bombRange = Math.min((player.bombRange ?? BOMB_RANGE) + 1, 8);
            if (item.type === 'bomb') player.maxBombs = Math.min((player.maxBombs ?? 2) + 2, 6);
            if (item.type === 'star') player.stars = (player.stars ?? 0) + 1;
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

    // ─── Rời game đang chơi (nhấn X trong game) ─────────────────
    socket.on('game:leave', async ({ roomId } = {}) => {
        const room = rooms.get(roomId);
        const gs = gameStates.get(roomId);
        if (!room || !gs || gs.status !== 'playing') {
            // Game không còn tồn tại hoặc đã kết thúc → chỉ rời phòng
            if (room) {
                room.players = room.players.filter(p => p.uid !== uid);
                socket.leave(roomId);
                if (room.players.length === 0) rooms.delete(roomId);
                else {
                    if (room.host === uid) { room.host = room.players[0].uid; room.players[0].isHost = true; }
                    io.to(roomId).emit('room:updated', room);
                }
                io.emit('rooms:list', getAllRooms());
            }
            return;
        }

        console.log(`🚪 [Game] ${email} voluntarily left game in room ${roomId}`);

        // 1. Loại người thoát khỏi game state
        if (gs.players[uid]) {
            gs.players[uid].alive = false;
        }

        // 2. Kiểm tra điều kiện kết thúc
        const alivePlayers = Object.values(gs.players).filter(p => p.alive);

        if (alivePlayers.length <= 1) {
            // Kết thúc game — người còn lại (nếu có) thắng
            gs.status = 'finished';
            clearTimeout(gs._gameTimer);
            gs.winner = alivePlayers.length === 1 ? alivePlayers[0].uid : null;
            const winnerName = gs.winner ? gs.players[gs.winner]?.name : null;
            const reward = room ? calcReward(room.players.length) : 0;

            io.to(roomId).emit('game:over', {
                winner: gs.winner,
                winnerName,
                reward,
                reason: 'forfeit', // người chơi chủ động thoát
            });
            console.log(`🏆 [Game] Over (forfeit) | winner: ${winnerName || 'none'} | room: ${roomId}`);

            // Xu transactions chỉ cho Loạn Đấu thường
            if (!gs.tournamentId) {
                try {
                    await deductEntryFees(room.players);
                    if (gs.winner) await rewardWinner(gs.winner, room.players.length);
                } catch (e) {
                    console.error('[Xu] Transaction error (game:leave):', e.message);
                }
            }

            // Tournament match
            if (gs.tournamentId) {
                await handleMatchFinished(roomId, gs.tournamentId, gs.matchId, gs.winner);
            }

            // Dọn sau 15s
            setTimeout(() => {
                gameStates.delete(roomId);
                const r = rooms.get(roomId);
                if (r) { r.status = 'waiting'; r.players.forEach(p => p.isReady = false); io.emit('rooms:list', getAllRooms()); }
            }, 15000);
        } else {
            // Vẫn còn nhiều người → broadcast state mới
            broadcastState(roomId);
        }

        // 3. Xóa người chơi khỏi danh sách phòng và socket room
        room.players = room.players.filter(p => p.uid !== uid);
        socket.leave(roomId);
        if (room.players.length === 0) {
            rooms.delete(roomId);
        } else {
            if (room.host === uid) { room.host = room.players[0].uid; room.players[0].isHost = true; }
        }
        io.emit('rooms:list', getAllRooms());
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

    socket.on('disconnect', async (reason) => {
        console.log(`❌ [Socket] Disconnected | ${socket.id} | ${email} | ${reason}`);
        socketByUid.delete(uid);

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
                        reward: gs.winner ? calcReward(room.players.length) : 0,
                    });
                    console.log(`🏆 [Game] Over | winner: ${winnerName || 'none'} | room: ${roomId}`);

                    // Xu (chỉ Loạn Đấu thường)
                    if (!gs.tournamentId) {
                        try {
                            await deductEntryFees(room.players);
                            if (gs.winner) await rewardWinner(gs.winner, room.players.length);
                        } catch (e) {
                            console.error('[Xu] Transaction error (disconnect):', e.message);
                        }
                    }

                    // Tournament match
                    if (gs.tournamentId) {
                        await handleMatchFinished(roomId, gs.tournamentId, gs.matchId, gs.winner);
                    }

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
// 8b. Tournament Engine
// ─────────────────────────────────────────────

/** Serialize tournament state for clients */
function publicTournamentState(t) {
    return {
        id: t.id, name: t.name, hostUid: t.hostUid, status: t.status,
        players: t.players,
        rounds: t.rounds.map(round =>
            round.map(m => ({
                matchId: m.matchId,
                player1Uid: m.player1Uid,
                player2Uid: m.player2Uid,
                player3Uid: m.player3Uid ?? null,
                roomId: m.roomId,
                status: m.status,
                winner: m.winner,
            }))
        ),
        currentRound: t.currentRound,
        champion: t.champion,
        pendingChallenges: [...(t.pendingChallenges?.entries() ?? [])].map(
            ([challengerUid, targetUid]) => ({ challengerUid, targetUid })
        ),
        acceptedPairs: t.acceptedPairs ?? [],
    };
}

/** Tạo bracket từ danh sách người chơi + các cặp đã chấp nhận */
function createTournamentBracket(players, acceptedPairs = []) {
    const matches = [];
    const paired = new Set();

    // Ưu tiên cặp đã thách đấu
    for (const [uid1, uid2] of acceptedPairs) {
        if (!paired.has(uid1) && !paired.has(uid2)) {
            const p1 = players.find(p => p.uid === uid1);
            const p2 = players.find(p => p.uid === uid2);
            if (p1 && p2) {
                matches.push({
                    matchId: `match_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                    player1Uid: uid1, player2Uid: uid2, player3Uid: null,
                    roomId: null, status: 'pending', winner: null,
                });
                paired.add(uid1);
                paired.add(uid2);
            }
        }
    }

    // Ghép random phần còn lại
    const remaining = players.filter(p => !paired.has(p.uid));
    // Fisher-Yates shuffle
    for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }

    for (let i = 0; i < remaining.length; i += 2) {
        if (i + 1 < remaining.length) {
            matches.push({
                matchId: `match_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                player1Uid: remaining[i].uid, player2Uid: remaining[i + 1].uid, player3Uid: null,
                roomId: null, status: 'pending', winner: null,
            });
        } else {
            // Số lẻ: ghép 3 người vào cặp trận cuối
            if (matches.length > 0) {
                matches[matches.length - 1].player3Uid = remaining[i].uid;
            } else {
                // Chỉ có 1 người duy nhất → bye (thắng luôn)
                matches.push({
                    matchId: `match_${Date.now()}_bye`,
                    player1Uid: remaining[i].uid, player2Uid: null, player3Uid: null,
                    roomId: null, status: 'finished', winner: remaining[i].uid,
                });
            }
        }
    }

    return matches;
}

/** Bắt đầu một vòng tournament */
async function startTournamentRound(tournamentId) {
    const t = tournaments.get(tournamentId);
    if (!t) return;

    const round = t.rounds[t.currentRound];
    console.log(`🏆 [Tournament] Starting round ${t.currentRound + 1} for "${t.name}" (${round.length} matches)`);

    for (let i = 0; i < round.length; i++) {
        const match = round[i];
        if (match.status === 'finished') continue; // bye match

        // Gom danh sách player cho trận này
        const matchPlayerUids = [match.player1Uid, match.player2Uid, match.player3Uid].filter(Boolean);
        const matchPlayers = matchPlayerUids.map(uid => t.players.find(p => p.uid === uid)).filter(Boolean);

        // Tạo room riêng cho trận
        const hostPlayer = matchPlayers[0];
        const matchRoom = createRoom(
            hostPlayer.uid, hostPlayer.name, hostPlayer.photoURL,
            `[Đấu Cặp] Vòng ${t.currentRound + 1} - Trận ${i + 1}`,
            {
                mode: 'dauCap',
                maxPlayers: matchPlayers.length,
                tournamentId,
                matchId: match.matchId,
            }
        );

        // Thêm các player vào room (host đã có, thêm phần còn lại)
        for (const p of matchPlayers.slice(1)) {
            matchRoom.players.push({ uid: p.uid, name: p.name, photoURL: p.photoURL, isReady: true, isHost: false });
        }
        matchRoom.players[0].isReady = true;
        matchRoom.status = 'playing';

        // Init game state (Đấu Cặp: 90s, không có life item)
        const gs = initGameState(matchRoom, {
            durationMs: 90_000,
            noLifeItem: true,
            tournamentId,
            matchId: match.matchId,
        });
        gameStates.set(matchRoom.id, gs);

        match.roomId = matchRoom.id;
        match.status = 'playing';

        // Join socket rooms + notify players
        for (const p of matchPlayers) {
            const s = socketByUid.get(p.uid);
            if (s) {
                s.join(matchRoom.id);
                s.emit('tournament:match_start', {
                    matchId: match.matchId,
                    roomId: matchRoom.id,
                    tournamentId,
                    opponentName: matchPlayers.filter(x => x.uid !== p.uid).map(x => x.name).join(' & '),
                });
                s.emit('game:start', { roomId: matchRoom.id, gameState: publicState(gs) });
            }
        }
    }

    io.to(`tournament_${tournamentId}`).emit('tournament:round_start', {
        tournamentId,
        round: t.currentRound,
        matches: round.map(m => ({
            matchId: m.matchId,
            player1Uid: m.player1Uid,
            player2Uid: m.player2Uid,
            player3Uid: m.player3Uid ?? null,
            roomId: m.roomId,
            status: m.status,
        })),
    });

    io.to(`tournament_${tournamentId}`).emit('tournament:updated', publicTournamentState(t));
}

/** Xử lý khi 1 trận trong tournament kết thúc */
async function handleMatchFinished(roomId, tournamentId, matchId, winnerUid) {
    const t = tournaments.get(tournamentId);
    if (!t) return;

    const round = t.rounds[t.currentRound];
    if (!round) return;
    const match = round.find(m => m.matchId === matchId);
    if (!match || match.status === 'finished') return;

    match.status = 'finished';
    match.winner = winnerUid;
    console.log(`🏆 [Tournament] Match ${matchId} finished | winner: ${winnerUid}`);

    io.to(`tournament_${tournamentId}`).emit('tournament:match_over', {
        matchId, winner: winnerUid,
        winnerName: t.players.find(p => p.uid === winnerUid)?.name ?? null,
        tournamentId,
    });

    io.to(`tournament_${tournamentId}`).emit('tournament:updated', publicTournamentState(t));

    // Dọn game state sau 15s
    setTimeout(() => {
        gameStates.delete(roomId);
        const r = rooms.get(roomId);
        if (r) { r.status = 'waiting'; }
    }, 15000);

    // Kiểm tra tất cả trận trong vòng đã xong chưa
    const allDone = round.every(m => m.status === 'finished');
    if (!allDone) return;

    const winners = round.map(m => m.winner).filter(Boolean);
    // Lọc unique (trường hợp bye có thể lặp)
    const uniqueWinners = [...new Set(winners)];

    io.to(`tournament_${tournamentId}`).emit('tournament:round_over', {
        tournamentId, round: t.currentRound,
    });

    if (uniqueWinners.length <= 1) {
        // Tournament kết thúc!
        t.status = 'finished';
        t.champion = uniqueWinners[0] ?? null;
        const championName = t.players.find(p => p.uid === t.champion)?.name ?? null;
        console.log(`🏆 [Tournament] Champion: ${championName}`);

        io.to(`tournament_${tournamentId}`).emit('tournament:champion', {
            tournamentId, champion: t.champion, championName,
        });

        // Thưởng xu cho nhà vô địch
        if (t.champion) {
            await rewardWinner(t.champion, t.players.length);
        }
        return;
    }

    // Tiếp tục vòng sau
    t.currentRound++;
    const nextPlayers = t.players.filter(p => uniqueWinners.includes(p.uid));
    const nextMatches = createTournamentBracket(nextPlayers, []);
    t.rounds.push(nextMatches);

    console.log(`🏆 [Tournament] Advancing to round ${t.currentRound + 1} with ${nextPlayers.length} players`);

    // Delay 5s cho người chơi xem kết quả
    setTimeout(() => startTournamentRound(tournamentId), 5000);
}

// ─────────────────────────────────────────────
// 8c. Tournament & Loạn Đấu Socket Events
// ─────────────────────────────────────────────

io.on('connection', (socket) => {
    const { uid, name, photoURL } = socket.user;

    // ─── Loạn Đấu Queue ──────────────────────────

    socket.on('loandau:join_queue', () => {
        let queue = loandauQueue.get(LOANDAU_QUEUE_ID);
        if (!queue) {
            queue = { hostUid: uid, players: [], createdAt: Date.now() };
            loandauQueue.set(LOANDAU_QUEUE_ID, queue);
        }
        if (!queue.players.some(p => p.uid === uid)) {
            queue.players.push({ uid, name, photoURL });
        }
        socket.join('loandau_queue');
        io.to('loandau_queue').emit('loandau:queue_update', {
            players: queue.players, count: queue.players.length, hostUid: queue.hostUid,
        });
        console.log(`📋 [Queue] ${name} joined Loạn Đấu queue (${queue.players.length} in queue)`);
    });

    socket.on('loandau:leave_queue', () => {
        const queue = loandauQueue.get(LOANDAU_QUEUE_ID);
        if (!queue) return;
        queue.players = queue.players.filter(p => p.uid !== uid);
        socket.leave('loandau_queue');
        if (queue.players.length === 0) {
            loandauQueue.delete(LOANDAU_QUEUE_ID);
        } else {
            if (queue.hostUid === uid) queue.hostUid = queue.players[0].uid;
            io.to('loandau_queue').emit('loandau:queue_update', {
                players: queue.players, count: queue.players.length, hostUid: queue.hostUid,
            });
        }
    });

    socket.on('loandau:start_split', () => {
        const queue = loandauQueue.get(LOANDAU_QUEUE_ID);
        if (!queue) return socket.emit('room:error', { message: 'Hàng chờ không tồn tại.' });
        if (queue.hostUid !== uid) return socket.emit('room:error', { message: 'Chỉ người tổ chức mới có thể bắt đầu.' });
        if (queue.players.length < 2) return socket.emit('room:error', { message: 'Cần ít nhất 2 người.' });

        // Shuffle
        const players = [...queue.players];
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }

        // Chia nhóm 5, nếu dư 1 → gộp vào nhóm áp chót
        const groups = [];
        for (let i = 0; i < players.length; i += 5) {
            groups.push(players.slice(i, i + 5));
        }
        if (groups.length > 1 && groups[groups.length - 1].length === 1) {
            const lone = groups.pop()[0];
            groups[groups.length - 1].push(lone);
        }

        const createdRoomIds = [];
        for (const group of groups) {
            const host = group[0];
            const room = createRoom(host.uid, host.name, host.photoURL,
                `Loạn Đấu #${Date.now().toString(36).slice(-4).toUpperCase()}`,
                { mode: 'loanDau', maxPlayers: group.length }
            );
            for (const p of group.slice(1)) {
                room.players.push({ uid: p.uid, name: p.name, photoURL: p.photoURL, isReady: true, isHost: false });
            }
            createdRoomIds.push(room.id);

            // Join socket cho từng player
            for (const p of group) {
                const s = socketByUid.get(p.uid);
                if (s) {
                    s.join(room.id);
                    s.emit('room:joined', room);
                    s.leave('loandau_queue');
                }
            }
        }

        loandauQueue.delete(LOANDAU_QUEUE_ID);
        io.emit('rooms:list', getAllRooms());
        console.log(`🎮 [Queue] Split into ${groups.length} rooms: ${createdRoomIds.join(', ')}`);
    });

    // ─── Tournament Events ────────────────────────

    socket.on('tournament:create', ({ name: tName } = {}) => {
        if (!tName?.trim()) return socket.emit('tournament:error', { message: 'Tên giải đấu không được để trống.' });
        const tid = `tourn_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const t = {
            id: tid, name: tName.trim(), hostUid: uid, status: 'lobby',
            players: [{ uid, name, photoURL }],
            rounds: [], currentRound: 0, champion: null,
            acceptedPairs: [],
            pendingChallenges: new Map(),
        };
        tournaments.set(tid, t);
        socket.join(`tournament_${tid}`);
        socket.emit('tournament:joined', publicTournamentState(t));
        // Broadcast updated list
        io.emit('tournament:list', getTournamentList());
        console.log(`🏆 [Tournament] Created: "${tName}" by ${name}`);
    });

    socket.on('tournament:join', ({ tournamentId } = {}) => {
        const t = tournaments.get(tournamentId);
        if (!t) return socket.emit('tournament:error', { message: 'Giải đấu không tồn tại.' });
        if (t.status !== 'lobby') return socket.emit('tournament:error', { message: 'Giải đấu đã bắt đầu.' });
        if (t.players.some(p => p.uid === uid)) {
            socket.join(`tournament_${tournamentId}`);
            return socket.emit('tournament:joined', publicTournamentState(t));
        }
        t.players.push({ uid, name, photoURL });
        socket.join(`tournament_${tournamentId}`);
        socket.emit('tournament:joined', publicTournamentState(t));
        io.to(`tournament_${tournamentId}`).emit('tournament:updated', publicTournamentState(t));
        io.emit('tournament:list', getTournamentList());
        console.log(`👤 [Tournament] ${name} joined "${t.name}"`);
    });

    socket.on('tournament:leave', ({ tournamentId } = {}) => {
        const t = tournaments.get(tournamentId);
        if (!t || t.status !== 'lobby') return;
        t.players = t.players.filter(p => p.uid !== uid);
        socket.leave(`tournament_${tournamentId}`);
        if (t.players.length === 0) {
            tournaments.delete(tournamentId);
        } else {
            if (t.hostUid === uid) t.hostUid = t.players[0].uid;
            io.to(`tournament_${tournamentId}`).emit('tournament:updated', publicTournamentState(t));
        }
        io.emit('tournament:list', getTournamentList());
    });

    socket.on('tournament:challenge', ({ tournamentId, targetUid } = {}) => {
        const t = tournaments.get(tournamentId);
        if (!t || t.status !== 'lobby') return;

        // Race condition: nếu target đã challenge mình → auto-accept
        if (t.pendingChallenges.get(targetUid) === uid) {
            t.pendingChallenges.delete(targetUid);
            // Xóa challenge ngược lại nếu có
            t.pendingChallenges.delete(uid);
            // Kiểm tra chưa được ghép
            const alreadyPaired = t.acceptedPairs.some(
                ([a, b]) => a === uid || b === uid || a === targetUid || b === targetUid
            );
            if (!alreadyPaired) {
                t.acceptedPairs.push([uid, targetUid]);
                // Notify cả 2
                const s1 = socketByUid.get(uid);
                const s2 = socketByUid.get(targetUid);
                s1?.emit('tournament:challenge_result', { targetUid, targetName: t.players.find(p => p.uid === targetUid)?.name, accepted: true });
                s2?.emit('tournament:challenge_result', { targetUid: uid, targetName: name, accepted: true });
                io.to(`tournament_${tournamentId}`).emit('tournament:updated', publicTournamentState(t));
            }
            return;
        }

        t.pendingChallenges.set(uid, targetUid);
        // Notify target
        const targetSocket = socketByUid.get(targetUid);
        targetSocket?.emit('tournament:challenge_received', {
            fromUid: uid, fromName: name, tournamentId,
        });
        io.to(`tournament_${tournamentId}`).emit('tournament:updated', publicTournamentState(t));
    });

    socket.on('tournament:challenge_respond', ({ tournamentId, challengerUid, accepted } = {}) => {
        const t = tournaments.get(tournamentId);
        if (!t || t.status !== 'lobby') return;

        const pending = t.pendingChallenges.get(challengerUid);
        if (pending !== uid) return; // không phải target của challenge này

        t.pendingChallenges.delete(challengerUid);

        const challengerSocket = socketByUid.get(challengerUid);
        challengerSocket?.emit('tournament:challenge_result', {
            targetUid: uid, targetName: name, accepted,
        });

        if (accepted) {
            const alreadyPaired = t.acceptedPairs.some(
                ([a, b]) => a === challengerUid || b === challengerUid || a === uid || b === uid
            );
            if (!alreadyPaired) {
                t.acceptedPairs.push([challengerUid, uid]);
            }
        }
        io.to(`tournament_${tournamentId}`).emit('tournament:updated', publicTournamentState(t));
    });

    socket.on('tournament:start', async ({ tournamentId } = {}) => {
        const t = tournaments.get(tournamentId);
        if (!t) return socket.emit('tournament:error', { message: 'Giải đấu không tồn tại.' });
        if (t.hostUid !== uid) return socket.emit('tournament:error', { message: 'Chỉ người tổ chức mới có thể bắt đầu.' });
        if (t.players.length < 2) return socket.emit('tournament:error', { message: 'Cần ít nhất 2 người.' });
        if (t.status !== 'lobby') return;

        t.status = 'round_active';
        const round0 = createTournamentBracket(t.players, t.acceptedPairs);
        t.rounds.push(round0);

        await startTournamentRound(tournamentId);
        io.emit('tournament:list', getTournamentList());
    });

    socket.on('tournament:spectate', ({ tournamentId, matchId } = {}) => {
        const t = tournaments.get(tournamentId);
        if (!t) return;
        const match = t.rounds[t.currentRound]?.find(m => m.matchId === matchId);
        if (!match || !match.roomId) return;

        const specRoom = `spec_${match.roomId}`;
        socket.join(specRoom);

        const gs = gameStates.get(match.roomId);
        if (gs) socket.emit('tournament:spectate_joined', { matchId, gameState: publicState(gs) });
    });

    socket.on('tournament:unspectate', ({ tournamentId, matchId } = {}) => {
        const t = tournaments.get(tournamentId);
        const match = t?.rounds[t.currentRound]?.find(m => m.matchId === matchId);
        if (match?.roomId) socket.leave(`spec_${match.roomId}`);
    });

    socket.on('tournament:emoji', ({ tournamentId, matchId, emoji } = {}) => {
        const t = tournaments.get(tournamentId);
        const match = t?.rounds[t.currentRound]?.find(m => m.matchId === matchId);
        if (!match?.roomId) return;
        // Broadcast đến spectators của trận đó
        io.to(`spec_${match.roomId}`).emit('tournament:emoji_broadcast', {
            matchId, fromName: name, emoji,
        });
    });

    // Lấy danh sách tournament đang mở
    socket.on('tournament:list', () => {
        socket.emit('tournament:list', getTournamentList());
    });
});

function getTournamentList() {
    return [...tournaments.values()]
        .filter(t => t.status === 'lobby' || t.status === 'round_active')
        .map(t => ({
            id: t.id, name: t.name,
            hostName: t.players.find(p => p.uid === t.hostUid)?.name ?? '',
            playerCount: t.players.length,
            status: t.status,
        }));
}

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
