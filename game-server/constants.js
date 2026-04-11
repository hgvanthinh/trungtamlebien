// game-server/constants.js
// ─── Game Constants ────────────────────────────────────────

export const MAP_W = 29;          // must be odd — wider map with camera tracking
export const MAP_H = 13;          // must be odd
export const CELL_EMPTY = 0;
export const CELL_WALL = 1;      // indestructible
export const CELL_BLOCK = 2;      // destructible
export const BOMB_TIMER = 3000;  // ms
export const EXPLOSION_DUR = 700;   // ms
export const BOMB_RANGE = 3;
export const PLAYER_INIT_LIVES = 1;    // số mạng mặc định
export const MOVE_COOLDOWN = 130;   // ms/player
export const ENTRY_COST = 20;    // ← Xu mỗi người phải bỏ ra để chơi
// Phần thưởng người thắng = số người × ENTRY_COST (toàn bộ pool).
// Không có sàn cố định để tránh gian lận khi ít người chơi.
/** Tính xu thưởng cho người thắng (toàn bộ pool không floor) */
export function calcReward(playerCount) { return playerCount * ENTRY_COST; }

// ─────────────────────────────────────────────
// ←← CHỈNH THỜI GIAN GIỚI HẠN VÁN CHƠI TẠI ĐÂY →→
// Mặc định: 5 phút (300 000 ms). Đổi số bên dưới để tăng/giảm.
// Ví dụ: 3 phút = 180_000 | 10 phút = 600_000
export const GAME_DURATION_MS = 5 * 60 * 1000; // ← Sửa con số này (phút * 60 * 1000)

export const PLAYER_COLORS = [
    '#4ade80', '#f87171', '#60a5fa', '#facc15',
    '#c084fc', '#fb923c', '#34d399', '#f472b6',
    '#a78bfa', '#38bdf8', '#fb7185', '#86efac',
];

// Spawn positions trải đều trên map rộng (safe zone 2 ô xung quanh)
export const SPAWN_POSITIONS = [
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

export const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
export const LOANDAU_QUEUE_ID = 'loandau_main';
