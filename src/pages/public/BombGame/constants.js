// src/pages/public/BombGame/constants.js
// ─── Game Constants ────────────────────────────────────────────

export const MAP_W = 29;
export const MAP_H = 13;
export const VP_COLS = 15;
export const VP_ROWS = 13;

// ─── Movement Speed ────────────────────────────────────────────
// ↓↓ CHỈNH TỐC ĐỘ DI CHUYỂN TẠI ĐÂY ↓↓
// Tăng số để đi CHẬM hơn, giảm để đi NHANH hơn.
// Giá trị tối thiểu: 130 (= server cooldown). Khuyến nghị: 160–250.
export const MOVE_INTERVAL_MS = 160;
export const MOVE_ANIM_MS = MOVE_INTERVAL_MS;

export const CELL_EMPTY = 0;
export const CELL_WALL = 1;
export const CELL_BLOCK = 2;

export const CAM_LERP = 0.25; // hệ số lerp camera
export const DPAD_H = 190;    // chiều cao D-pad mobile (px)
export const HUD_H_MOBILE = 75;
export const HUD_H_DESKTOP = 50;
