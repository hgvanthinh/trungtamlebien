// game-server/gameEngine.js
// ─── Core Game Logic Functions ─────────────────────────────

import {
    MAP_H, MAP_W, CELL_WALL, CELL_EMPTY, CELL_BLOCK,
    SPAWN_POSITIONS, PLAYER_COLORS, PLAYER_INIT_LIVES, BOMB_RANGE, GAME_DURATION_MS
} from './constants.js';

/** Generate a Bomberman-style map */
export function generateMap() {
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
export function calcExplosion(map, row, col, range) {
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

/** Ẩn items ngẫu nhiên dưới các ô gạch */
export function generateHiddenItems(blockPositions, playerCount, itemTypes) {
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
export function initGameState(room, options = {}) {
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
export function publicState(gs) {
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
