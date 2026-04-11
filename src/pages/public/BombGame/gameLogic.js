// src/pages/public/BombGame/gameLogic.js
// ─── Pure Game Logic (no React, no DOM) ────────────────────────

import { CELL_WALL, CELL_BLOCK, CELL_EMPTY } from './constants';

/**
 * Tính toán những ô nào bị ảnh hưởng bởi vụ nổ.
 * @param {number} bombRow  - hàng của bom
 * @param {number} bombCol  - cột của bom
 * @param {number} power    - độ dài tối đa của tia lửa
 * @param {number[][]} mapData - mảng 2D chứa loại ô
 * @returns {{ row: number, col: number, type: 'center'|'ray' }[]}
 */
export function calculateExplosion(bombRow, bombCol, power, mapData) {
    const cells = [{ row: bombRow, col: bombCol, type: 'center' }];
    const rows = mapData.length;
    const cols = mapData[0]?.length || 0;

    const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of DIRECTIONS) {
        for (let i = 1; i <= power; i++) {
            const r = bombRow + dr * i;
            const c = bombCol + dc * i;

            if (r < 0 || r >= rows || c < 0 || c >= cols) break;

            const cell = mapData[r][c];
            if (cell === CELL_WALL) break;

            cells.push({ row: r, col: c, type: 'ray' });
            if (cell === CELL_BLOCK) break;
        }
    }

    return cells;
}

/** linear: constant-speed interpolation */
export function linear(t) { return t; }

/**
 * Tính explosion map từ danh sách explosions của server.
 * Trả về object: { 'r,c' → 'center'|'horizontal'|'vertical'|'end-left'|'end-right'|'end-up'|'end-down' }
 * @param {Array} explosions - mảng explosions từ gameState
 * @returns {Object}
 */
export function buildExplosionMap(explosions) {
    const map = {};
    if (!explosions?.length) return map;

    for (const exp of explosions) {
        if (!exp.cells?.length) continue;
        const center = exp.cells[0];

        const arms = { left: [], right: [], up: [], down: [] };
        exp.cells.forEach((cell, idx) => {
            if (idx === 0) return;
            if (cell.row === center.row) {
                if (cell.col < center.col) arms.left.push(cell);
                else arms.right.push(cell);
            } else {
                if (cell.row < center.row) arms.up.push(cell);
                else arms.down.push(cell);
            }
        });

        const farthest = {
            left: arms.left.length ? arms.left.reduce((a, b) => b.col < a.col ? b : a) : null,
            right: arms.right.length ? arms.right.reduce((a, b) => b.col > a.col ? b : a) : null,
            up: arms.up.length ? arms.up.reduce((a, b) => b.row < a.row ? b : a) : null,
            down: arms.down.length ? arms.down.reduce((a, b) => b.row > a.row ? b : a) : null,
        };

        const endKeys = new Set(
            Object.values(farthest).filter(Boolean).map(c => `${c.row},${c.col}`)
        );

        exp.cells.forEach((cell, idx) => {
            const key = `${cell.row},${cell.col}`;
            if (idx === 0) {
                map[key] = 'center';
            } else if (endKeys.has(key)) {
                if (cell.row === center.row) {
                    map[key] = cell.col < center.col ? 'end-left' : 'end-right';
                } else {
                    map[key] = cell.row < center.row ? 'end-up' : 'end-down';
                }
            } else if (cell.row === center.row) {
                map[key] = 'horizontal';
            } else {
                map[key] = 'vertical';
            }
        });
    }

    return map;
}
