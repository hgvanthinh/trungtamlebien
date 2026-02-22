// src/pages/public/PhaserBombGame.jsx
import Phaser from 'phaser';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket, movePlayer, placeBomb, leaveRoom, leaveGame } from '../../services/api/socket';
import { auth } from '../../config/firebase';
import { playSound, toggleMute, isMuted, playBGM, stopBGM } from '../../utils/audioManager';

const MAP_W = 29, MAP_H = 13, VP_COLS = 15, VP_ROWS = 13;
const MOVE_INTERVAL_MS = 160;
const CELL_EMPTY = 0, CELL_WALL = 1, CELL_BLOCK = 2;
const TILE = 32;
const DPAD_H = 190, HUD_H_MOBILE = 75, HUD_H_DESKTOP = 50;

//  React sub-components 
function PlayerPill({ player, isMe, compact = false }) {
  const [err, setErr] = useState(false);
  return (
    <div className={`flex items-center rounded-lg border flex-shrink-0
        ${compact ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'}
        ${player.alive ? 'bg-white/5 border-white/10' : 'opacity-40 bg-white/2 border-white/5'}`}
      style={isMe ? { borderColor: 'rgba(165,180,252,0.4)', background: 'rgba(99,102,241,0.1)' } : {}}>
      <div className="rounded-full overflow-hidden flex-shrink-0 border border-white/30 w-5 h-5"
        style={{ backgroundColor: player.color }}>
        {player.photoURL && !err
          ? <img src={player.photoURL} alt="" onError={() => setErr(true)} className="w-full h-full object-cover" draggable={false} />
          : <span className="text-white font-bold flex items-center justify-center h-full" style={{ fontSize: 10 }}>{player.name?.[0]?.toUpperCase()}</span>}
      </div>
      {!compact && <span className={`text-xs font-medium truncate max-w-[70px] ${player.alive ? 'text-white' : 'text-gray-600 line-through'}`}>{player.name}{isMe ? ' ' : ''}</span>}
      <span className="flex items-center gap-px flex-shrink-0" style={{ fontSize: 11 }}>
        <span style={{ color: '#ef4444' }}>❤️</span>
        <span className="text-white/80 font-bold" style={{ fontSize: 10, lineHeight: 1 }}>{player.lives ?? 0}</span>
      </span>
      {player.bombCount !== undefined && (
        <span className="flex items-center gap-px flex-shrink-0" style={{ fontSize: 10 }}>
          <span className="text-[10px]">💣</span><span className="text-white/70 font-bold" style={{ fontSize: 10, lineHeight: 1 }}>{player.bombCount}</span>
        </span>
      )}
      {player.range !== undefined && !compact && (
        <span className="flex items-center gap-px flex-shrink-0" style={{ fontSize: 10 }}>
          <span className="text-[10px]">🔥</span><span className="text-white/70 font-bold" style={{ fontSize: 10, lineHeight: 1 }}>{player.range}</span>
        </span>
      )}
    </div>
  );
}

function MiniMap({ map, players, currentUid, camCol, camRow }) {
  const S = 4;
  return (
    <div className="relative rounded-lg overflow-hidden border border-white/20 flex-shrink-0"
      style={{ width: MAP_W * S, height: MAP_H * S, background: '#0f172a' }}>
      {map.map((row, r) => row.map((cell, c) => (
        <div key={`${r}-${c}`} className="absolute" style={{
          left: c * S, top: r * S, width: S, height: S,
          background: cell === CELL_WALL ? '#4b5563' : cell === CELL_BLOCK ? '#92400e' : '#1a1a2e',
        }} />
      )))}
      {players.filter(p => p.alive).map(p => (
        <div key={p.uid} className="absolute rounded-full" style={{
          left: p.col * S, top: p.row * S, width: S, height: S,
          background: p.uid === currentUid ? 'white' : p.color, zIndex: 2,
        }} />
      ))}
      <div className="absolute border border-green-400/80 bg-green-400/10 pointer-events-none" style={{
        left: camCol * S, top: camRow * S, width: VP_COLS * S, height: VP_ROWS * S, zIndex: 3,
      }} />
    </div>
  );
}

function GameOverOverlay({ winner, winnerName, currentUid, reward, reason, refundedUids = [] }) {
  const isWinner = winner === currentUid;
  const isTimeoutDraw = !winner && reason === 'timeout';
  const isSurvivor = isTimeoutDraw && refundedUids.includes(currentUid);
  const [secs, setSecs] = useState(8);
  useEffect(() => {
    const iv = setInterval(() => setSecs(s => { if (s <= 1) { clearInterval(iv); window.location.reload(); return 0; } return s - 1; }), 1000);
    return () => clearInterval(iv);
  }, []);
  const rewardDisplay = reward ?? (winner ? 100 : 0);
  let icon, title, subtitle;
  if (winner) {
    icon = isWinner ? '🏆' : '💀'; title = isWinner ? 'Bạn thắng!' : 'Bạn thua!';
    subtitle = isWinner ? <span className="text-yellow-400 font-semibold">+{rewardDisplay} Xu!</span>
      : <span>{winnerName} thắng  <span className="text-red-400">-20 Xu</span></span>;
  } else if (isTimeoutDraw) {
    icon = isSurvivor ? '🤝' : '💀'; title = isSurvivor ? 'Hết giờ  Còn sống!' : 'Hết giờ  Bị loại';
    subtitle = isSurvivor ? <span className="text-green-400 font-semibold">Hoàn trả +20 Xu</span>
      : <span className="text-red-400">-20 Xu</span>;
  } else { icon = '⚖️'; title = 'Hòa!'; subtitle = <span className="text-red-400">-20 Xu</span>; }
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-30">
      <div className="flex flex-col items-center gap-5 p-8 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl text-center min-w-[280px]">
        <span className="text-6xl">{icon}</span>
        <div><p className="text-white font-bold text-2xl">{title}</p><p className="text-gray-400 text-sm mt-1">{subtitle}</p></div>
        <div className="w-full">
          <p className="text-gray-500 text-xs mb-1.5">Tự động tải lại sau {secs}s...</p>
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${(secs / 8) * 100}%` }} />
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all active:scale-95 w-full">Tải lại ngay</button>
      </div>
    </div>
  );
}

//  buildExplosionMap helper 
function buildExplosionMap(explosions) {
  const map = {};
  if (!explosions?.length) return map;
  for (const exp of explosions) {
    if (!exp.cells?.length) continue;
    const center = exp.cells[0];
    const arms = { left: [], right: [], up: [], down: [] };
    exp.cells.forEach((cell, idx) => {
      if (idx === 0) return;
      if (cell.row === center.row) { (cell.col < center.col ? arms.left : arms.right).push(cell); }
      else { (cell.row < center.row ? arms.up : arms.down).push(cell); }
    });
    const farthest = {
      left: arms.left.length ? arms.left.reduce((a, b) => b.col < a.col ? b : a) : null,
      right: arms.right.length ? arms.right.reduce((a, b) => b.col > a.col ? b : a) : null,
      up: arms.up.length ? arms.up.reduce((a, b) => b.row < a.row ? b : a) : null,
      down: arms.down.length ? arms.down.reduce((a, b) => b.row > a.row ? b : a) : null,
    };
    const endKeys = new Set(Object.values(farthest).filter(Boolean).map(c => `${c.row},${c.col}`));
    exp.cells.forEach((cell, idx) => {
      const key = `${cell.row},${cell.col}`;
      if (idx === 0) map[key] = 'center';
      else if (endKeys.has(key)) map[key] = cell.row === center.row ? (cell.col < center.col ? 'end-left' : 'end-right') : (cell.row < center.row ? 'end-up' : 'end-down');
      else map[key] = cell.row === center.row ? 'horizontal' : 'vertical';
    });
  }
  return map;
}

//  Phaser MainScene 
// Bridge: React -> Scene via window.__phaserBridge
// Scene -> React via bridge.onCamUpdate callback
class MainScene extends Phaser.Scene {
  constructor() { super({ key: 'MainScene' }); }

  //  Generate all textures via Graphics (no SVG loading needed) 
  _genTextures() {
    const g = this.make.graphics({ add: false });

    // floor (checkerboard)
    g.clear(); g.fillStyle(0x1a1a2e); g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x1e1e38, 0.5); g.fillRect(0, 0, TILE / 2, TILE / 2); g.fillRect(TILE / 2, TILE / 2, TILE / 2, TILE / 2);
    g.generateTexture('floor', TILE, TILE); g.clear();

    // wall (brick pattern)
    g.fillStyle(0x374151); g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x4b5563); g.fillRect(1, 1, TILE - 2, TILE - 2);
    g.fillStyle(0x6b7280);
    g.fillRoundedRect(2, 2, 28, 5, 1); g.fillRoundedRect(2, 10, 12, 5, 1);
    g.fillRoundedRect(18, 10, 12, 5, 1); g.fillRoundedRect(2, 18, 28, 5, 1);
    g.fillRoundedRect(2, 26, 12, 4, 1); g.fillRoundedRect(18, 26, 12, 4, 1);
    g.generateTexture('wall', TILE, TILE); g.clear();

    // block (soft crate)
    g.fillStyle(0x92400e); g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0xb45309); g.fillRoundedRect(1, 1, TILE - 2, TILE - 2, 2);
    g.lineStyle(2, 0x78350f); g.strokeRect(2, 2, TILE - 4, TILE - 4);
    g.lineStyle(1.5, 0x78350f); g.beginPath(); g.moveTo(TILE / 2, 2); g.lineTo(TILE / 2, TILE - 2); g.strokePath();
    g.beginPath(); g.moveTo(2, TILE / 2); g.lineTo(TILE - 2, TILE / 2); g.strokePath();
    g.fillStyle(0xd97706, 0.5); g.fillRect(2, 2, TILE - 4, 3); g.fillRect(2, 2, 3, TILE - 4);
    g.generateTexture('block', TILE, TILE); g.clear();

    // bomb
    g.fillStyle(0x111827); g.fillCircle(TILE / 2, TILE * 0.56, TILE * 0.34);
    g.lineStyle(1.5, 0x374151); g.strokeCircle(TILE / 2, TILE * 0.56, TILE * 0.34);
    g.lineStyle(2, 0x78350f); g.beginPath(); g.moveTo(TILE / 2, TILE * 0.22); g.lineTo(TILE * 0.62, TILE * 0.09); g.strokePath();
    g.fillStyle(0xf97316); g.fillCircle(TILE * 0.66, TILE * 0.06, TILE * 0.1);
    g.fillStyle(0xfbbf24); g.fillCircle(TILE * 0.66, TILE * 0.06, TILE * 0.05);
    g.generateTexture('bomb', TILE, TILE); g.clear();

    // explosion center (cross)
    const drawCross = (c1, c2, c3) => {
      g.fillStyle(c1); g.fillRect(-2, 2, TILE + 4, TILE - 4); g.fillRect(2, -2, TILE - 4, TILE + 4);
      g.fillStyle(c2); g.fillRect(-2, 6, TILE + 4, TILE - 12); g.fillRect(6, -2, TILE - 12, TILE + 4);
      g.fillStyle(c3); g.fillRect(-2, 10, TILE + 4, TILE - 20); g.fillRect(10, -2, TILE - 20, TILE + 4);
    };
    drawCross(0xdc2626, 0xfacc15, 0xffffff); g.generateTexture('expCenter', TILE, TILE); g.clear();

    // explosion H
    g.fillStyle(0xdc2626); g.fillRect(-2, 2, TILE + 4, TILE - 4);
    g.fillStyle(0xfacc15); g.fillRect(-2, 6, TILE + 4, TILE - 12);
    g.fillStyle(0xffffff); g.fillRect(-2, 10, TILE + 4, TILE - 20);
    g.generateTexture('expH', TILE, TILE); g.clear();

    // explosion V
    g.fillStyle(0xdc2626); g.fillRect(2, -2, TILE - 4, TILE + 4);
    g.fillStyle(0xfacc15); g.fillRect(6, -2, TILE - 12, TILE + 4);
    g.fillStyle(0xffffff); g.fillRect(10, -2, TILE - 20, TILE + 4);
    g.generateTexture('expV', TILE, TILE); g.clear();

    // end caps - reuse H/V with tinting at render time
    // endL (cap on right, ray goes left)
    g.fillStyle(0xdc2626); g.fillRect(0, 2, TILE, TILE - 4);
    g.fillStyle(0xfacc15); g.fillRect(0, 6, TILE, TILE - 12);
    g.fillStyle(0xffffff); g.fillRect(0, 10, TILE, TILE - 20);
    g.generateTexture('expEndL', TILE, TILE); g.clear();

    g.fillStyle(0xdc2626); g.fillRect(0, 2, TILE, TILE - 4);
    g.fillStyle(0xfacc15); g.fillRect(0, 6, TILE, TILE - 12);
    g.fillStyle(0xffffff); g.fillRect(0, 10, TILE, TILE - 20);
    g.generateTexture('expEndR', TILE, TILE); g.clear();

    g.fillStyle(0xdc2626); g.fillRect(2, 0, TILE - 4, TILE);
    g.fillStyle(0xfacc15); g.fillRect(6, 0, TILE - 12, TILE);
    g.fillStyle(0xffffff); g.fillRect(10, 0, TILE - 20, TILE);
    g.generateTexture('expEndU', TILE, TILE); g.clear();

    g.fillStyle(0xdc2626); g.fillRect(2, 0, TILE - 4, TILE);
    g.fillStyle(0xfacc15); g.fillRect(6, 0, TILE - 12, TILE);
    g.fillStyle(0xffffff); g.fillRect(10, 0, TILE - 20, TILE);
    g.generateTexture('expEndD', TILE, TILE); g.clear();

    // debris (scattered squares)
    g.fillStyle(0x92400e); g.fillRoundedRect(2, 2, 10, 6, 1);
    g.fillStyle(0xb45309); g.fillRoundedRect(3, 3, 8, 4, 1);
    g.fillStyle(0x78350f); g.fillRoundedRect(20, 2, 9, 5, 1);
    g.fillStyle(0x92400e); g.fillRoundedRect(1, 22, 8, 7, 1);
    g.fillStyle(0x78350f); g.fillRoundedRect(21, 23, 9, 6, 1);
    g.fillStyle(0x92400e); g.fillRoundedRect(13, 12, 5, 5, 1);
    g.generateTexture('debris', TILE, TILE); g.clear();

    // item life (heart)
    g.fillStyle(0x0f172a); g.fillRoundedRect(0, 0, TILE, TILE, 3);
    g.fillStyle(0xef4444);
    g.fillCircle(10, 12, 7); g.fillCircle(22, 12, 7); g.fillTriangle(3, 14, 29, 14, 16, 26);
    g.fillStyle(0xf87171);
    g.fillCircle(10, 12, 4); g.fillCircle(22, 12, 4);
    g.generateTexture('itemLife', TILE, TILE); g.clear();

    // item range (lightning bolt)
    g.fillStyle(0x0f172a); g.fillRoundedRect(0, 0, TILE, TILE, 3);
    g.fillStyle(0xf97316); g.fillTriangle(20, 3, 10, 18, 16, 18); g.fillTriangle(16, 18, 12, 29, 22, 14); g.fillTriangle(22, 14, 16, 14, 20, 3);
    g.fillStyle(0xfbbf24); g.fillTriangle(19, 5, 11, 17, 17, 17); g.fillTriangle(17, 17, 13, 27, 21, 13);
    g.generateTexture('itemRange', TILE, TILE); g.clear();

    // item bomb+
    g.fillStyle(0x0f172a); g.fillRoundedRect(0, 0, TILE, TILE, 3);
    g.fillStyle(0x111827); g.fillCircle(13, 20, 8);
    g.lineStyle(1.5, 0x374151); g.strokeCircle(13, 20, 8);
    g.lineStyle(2, 0x78350f); g.beginPath(); g.moveTo(13, 12); g.lineTo(17, 8); g.strokePath();
    g.fillStyle(0xf97316); g.fillCircle(18, 7, 2.5);
    g.fillStyle(0xa78bfa); g.fillRoundedRect(22, 14, 8, 2.5, 1); g.fillRoundedRect(24.75, 11.5, 2.5, 8, 1);
    g.generateTexture('itemBomb', TILE, TILE); g.clear();

    g.destroy();
  }

  preload() { /* textures generated in create via Graphics */ }

  create() {
    // Generate all textures via Graphics API (reliable, no network/SVG issues)
    this._genTextures();

    // Read bridge set by React
    const bridge = window.__phaserBridge;
    this._bridge = bridge;
    if (bridge) { bridge.scene = this; bridge.ready = true; }

    // Tile / object sprite pools
    this._tiles = {};   // `r,c` -> Image
    this._bombs = {};   // `r,c` -> Image
    this._exps = {};   // `r,c` -> Image
    this._items = {};   // id   -> Image
    this._players = {};   // uid  -> { img }
    this._playerTextures = {};
    this._loadingAvatars = new Set(); // uids đang fetch avatar
    this._lastMap = null;

    // Camera
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this._camInit = false;

    // If state already waiting, apply it now
    if (bridge?.pendingState) {
      const gs = bridge.pendingState;
      bridge.pendingState = null;
      this._initMap(gs.map);
      this._applyState(gs);
    }
  }

  // React calls this; scene applies it
  applyState(gs) {
    if (!this._lastMap) this._initMap(gs.map);
    this._applyState(gs);
  }

  predictMove(dir, gs) {
    const uid = this._bridge?.currentUid;
    if (!uid || !gs) return;
    const me = gs.players[uid];
    if (!me?.alive) return;
    const deltas = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
    const [dr, dc] = deltas[dir];
    const nRow = me.row + dr, nCol = me.col + dc;
    if (gs.map?.[nRow]?.[nCol] !== CELL_EMPTY) return;
    if ((gs.bombs || []).some(b => b.row === nRow && b.col === nCol)) return;
    if (Object.values(gs.players || {}).some(p => p.alive && p.uid !== uid && p.row === nRow && p.col === nCol)) return;
    this._tweenPlayer(uid, nRow, nCol);
    // Camera: pan to predicted position
    const halfC = Math.floor(VP_COLS / 2), halfR = Math.floor(VP_ROWS / 2);
    const cc = Math.max(0, Math.min(nCol - halfC, MAP_W - VP_COLS));
    const cr = Math.max(0, Math.min(nRow - halfR, MAP_H - VP_ROWS));
    this.cameras.main.pan(cc * TILE + VP_COLS * TILE / 2, cr * TILE + VP_ROWS * TILE / 2, 130, 'Linear', false);
  }

  _initMap(mapData) {
    for (let r = 0; r < mapData.length; r++) {
      for (let c = 0; c < mapData[r].length; c++) {
        const key = `${r},${c}`;
        const tex = mapData[r][c] === CELL_WALL ? 'wall' : mapData[r][c] === CELL_BLOCK ? 'block' : 'floor';
        const img = this.add.image(c * TILE + TILE / 2, r * TILE + TILE / 2, tex).setDepth(0);
        this._tiles[key] = { img, cell: mapData[r][c] };
      }
    }
    this._lastMap = mapData.map(r => [...r]);
  }

  _applyState(gs) {
    this._updateMap(gs.map);
    this._updateBombs(gs.bombs || [], gs.explosions || []);
    this._updateExplosions(gs.explosions || []);
    this._updateItems(gs.items || []);
    this._updatePlayers(gs.players || {});
  }

  _updateMap(mapData) {
    if (!mapData || !this._lastMap) return;
    for (let r = 0; r < mapData.length; r++) {
      for (let c = 0; c < mapData[r].length; c++) {
        const prev = this._lastMap[r]?.[c];
        const cur = mapData[r][c];
        if (cur === prev) continue;
        const key = `${r},${c}`;
        if (this._tiles[key]) { this._tiles[key].img.destroy(); delete this._tiles[key]; }
        const tex = cur === CELL_WALL ? 'wall' : cur === CELL_BLOCK ? 'block' : 'floor';
        const img = this.add.image(c * TILE + TILE / 2, r * TILE + TILE / 2, tex).setDepth(0);
        this._tiles[key] = { img, cell: cur };
        if (prev === CELL_BLOCK && cur === CELL_EMPTY) this._spawnDebris(r, c);
      }
    }
    this._lastMap = mapData.map(r => [...r]);
  }

  _spawnDebris(r, c) {
    const d = this.add.image(c * TILE + TILE / 2, r * TILE + TILE / 2, 'debris').setDepth(4);
    this.tweens.add({ targets: d, y: d.y + 12, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 400, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
  }

  _updateBombs(bombs, explosions) {
    const expSet = new Set((explosions || []).flatMap(e => (e.cells || []).map(c => `${c.row},${c.col}`)));
    const newKeys = new Set(bombs.map(b => `${b.row},${b.col}`));
    for (const k of Object.keys(this._bombs)) {
      if (!newKeys.has(k)) { this._bombs[k].destroy(); delete this._bombs[k]; }
    }
    for (const b of bombs) {
      const k = `${b.row},${b.col}`;
      if (this._bombs[k] || expSet.has(k)) continue;
      const img = this.add.image(b.col * TILE + TILE / 2, b.row * TILE + TILE / 2, 'bomb').setDepth(2);
      this.tweens.add({ targets: img, scaleX: 1.1, scaleY: 1.1, duration: 280, yoyo: true, repeat: -1 });
      this._bombs[k] = img;
    }
  }

  _updateExplosions(explosions) {
    const expMap = buildExplosionMap(explosions);
    const texMap = { center: 'expCenter', horizontal: 'expH', vertical: 'expV', 'end-left': 'expEndL', 'end-right': 'expEndR', 'end-up': 'expEndU', 'end-down': 'expEndD' };
    const newKeys = new Set(Object.keys(expMap));
    for (const k of Object.keys(this._exps)) {
      if (!newKeys.has(k)) { this._exps[k].destroy(); delete this._exps[k]; }
    }
    for (const [k, type] of Object.entries(expMap)) {
      if (this._exps[k]) continue;
      const [r, c] = k.split(',').map(Number);
      const tex = texMap[type] || 'expCenter';
      const img = this.add.image(c * TILE + TILE / 2, r * TILE + TILE / 2, tex).setDepth(5);
      this.tweens.add({ targets: img, alpha: 0.7, duration: 80, yoyo: true, repeat: -1 });
      this._exps[k] = img;
    }
  }

  _updateItems(items) {
    const ids = new Set(items.map(i => i.id));
    for (const id of Object.keys(this._items)) {
      if (!ids.has(id)) { this._items[id].destroy(); delete this._items[id]; }
    }
    for (const item of items) {
      if (this._items[item.id]) continue;
      const tex = item.type === 'life' ? 'itemLife' : item.type === 'range' ? 'itemRange' : 'itemBomb';
      const img = this.add.image(item.col * TILE + TILE / 2, item.row * TILE + TILE / 2, tex).setDepth(3).setDisplaySize(TILE * 0.7, TILE * 0.7);
      this.tweens.add({ targets: img, y: img.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this._items[item.id] = img;
    }
  }

  // Tạo texture fallback (hình tròn màu)
  _getFallbackTex(uid, color) {
    const key = `pl_${uid}`;
    if (this.textures.exists(key)) return key;
    const hex = parseInt((color || '#6366f1').replace('#', ''), 16);
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x000000, 0.4); g.fillCircle(TILE / 2 + 1, TILE / 2 + 1, TILE / 2 - 2);
    g.fillStyle(hex, 1); g.fillCircle(TILE / 2, TILE / 2, TILE / 2 - 2);
    g.fillStyle(0xffffff, 0.25); g.fillCircle(TILE / 2 - 4, TILE / 2 - 4, TILE / 4);
    g.generateTexture(key, TILE, TILE);
    g.destroy();
    return key;
  }

  // Trả về key texture hiện tại (avatar hoặc fallback), kích hoạt load async nếu cần
  _getPlayerTex(uid, color, photoURL) {
    const avatarKey = `av_${uid}`;
    // Avatar đã load xong → dùng luôn
    if (this.textures.exists(avatarKey)) return avatarKey;
    // Có URL nhưng chưa load → trigger async, tạm dùng fallback
    if (photoURL && !this._loadingAvatars.has(uid)) {
      this._loadAvatarTexture(uid, color, photoURL);
    }
    return this._getFallbackTex(uid, color);
  }

  // Load ảnh avatar từ URL, vẽ hình tròn lên Canvas, rồi thêm vào Phaser textures
  _loadAvatarTexture(uid, color, photoURL) {
    this._loadingAvatars.add(uid);
    const avatarKey = `av_${uid}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!this.textures || this.textures.exists(avatarKey)) return;
      const canvas = document.createElement('canvas');
      canvas.width = TILE; canvas.height = TILE;
      const ctx = canvas.getContext('2d');
      const cx = TILE / 2, cy = TILE / 2, r = TILE / 2 - 1;
      // Viền màu của người chơi
      const hex = parseInt((color || '#6366f1').replace('#', ''), 16);
      const rr = (hex >> 16) & 0xff, gg = (hex >> 8) & 0xff, bb = hex & 0xff;
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      // Shadow nhỏ
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(cx + 1, cy + 1, r - 1, 0, Math.PI * 2); ctx.fill();
      // Clip ảnh avatar vào hình tròn bên trong
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, 2, 2, TILE - 4, TILE - 4);
      ctx.restore();
      // Viền trắng nhỏ ở trên để tạo chiều sâu
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2); ctx.stroke();
      // Đưa vào Phaser texture
      if (this.textures && !this.textures.exists(avatarKey)) {
        this.textures.addCanvas(avatarKey, canvas);
      }
      // Cập nhật sprite ngay nếu đã tồn tại
      const sp = this._players[uid];
      if (sp?.img && this.textures.exists(avatarKey)) {
        sp.img.setTexture(avatarKey);
      }
    };
    img.onerror = () => {
      // Load thất bại (có thể do CORS) → giữ fallback, không retry vô hạn
      this._loadingAvatars.delete(uid);
      // Không set lại vào Set → sẽ không retry nữa (tránh spam request)
    };
    img.src = photoURL;
  }

  _updatePlayers(players) {
    const uid = this._bridge?.currentUid;
    // Remove dead/gone
    for (const id of Object.keys(this._players)) {
      if (!players[id]?.alive) { this._players[id].img?.destroy(); delete this._players[id]; }
    }
    for (const [id, p] of Object.entries(players)) {
      if (!p.alive) continue;
      const tex = this._getPlayerTex(id, p.color, p.photoURL);
      if (!this._players[id]) {
        const img = this.add.image(p.col * TILE + TILE / 2, p.row * TILE + TILE / 2, tex).setDepth(10);
        if (id === uid) { img.setScale(1.0); img.setTint(0xffffff); }
        this._players[id] = { img, targetRow: p.row, targetCol: p.col };
        // First time: setup camera follow on my sprite
        if (id === uid && !this._camInit) {
          this._camInit = true;
          const halfC = Math.floor(VP_COLS / 2), halfR = Math.floor(VP_ROWS / 2);
          const cc = Math.max(0, Math.min(p.col - halfC, MAP_W - VP_COLS));
          const cr = Math.max(0, Math.min(p.row - halfR, MAP_H - VP_ROWS));
          this.cameras.main.scrollX = cc * TILE;
          this.cameras.main.scrollY = cr * TILE;
          this.cameras.main.startFollow(img, true, 0.12, 0.12);
        }
      } else {
        const sp = this._players[id];
        // Skip stale server echoes for current player (already predicted)
        if (id === uid && (sp.targetRow !== p.row || sp.targetCol !== p.col)) {
          // Only snap if server says something different from prediction
          if (Math.abs(sp.targetRow - p.row) > 1 || Math.abs(sp.targetCol - p.col) > 1) {
            this._tweenPlayer(id, p.row, p.col);
          }
          return;
        }
        if (id !== uid && (sp.targetRow !== p.row || sp.targetCol !== p.col)) {
          this._tweenPlayer(id, p.row, p.col);
        }
      }
      // Cập nhật texture: ưu tiên avatar đã load, sau đó fallback
      if (this._players[id]) {
        const avatarKey = `av_${id}`;
        const bestTex = this.textures.exists(avatarKey) ? avatarKey : tex;
        this._players[id].img.setTexture(bestTex);
      }
    }
    // Minimap cam
    const me = players[uid];
    if (me && this._bridge?.onCamUpdate) {
      const halfC = Math.floor(VP_COLS / 2), halfR = Math.floor(VP_ROWS / 2);
      this._bridge.onCamUpdate(
        Math.max(0, Math.min(me.col - halfC, MAP_W - VP_COLS)),
        Math.max(0, Math.min(me.row - halfR, MAP_H - VP_ROWS))
      );
    }
  }

  _tweenPlayer(uid, toRow, toCol) {
    const sp = this._players[uid];
    if (!sp?.img) return;
    sp.targetRow = toRow; sp.targetCol = toCol;
    this.tweens.add({ targets: sp.img, x: toCol * TILE + TILE / 2, y: toRow * TILE + TILE / 2, duration: 130, ease: 'Linear' });
  }
}

// 
// PhaserBombGame  React Component
// 
export function PhaserBombGame() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const currentUid = auth.currentUser?.uid;

  const [gameState, setGameState] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [connState, setConnState] = useState('connected');
  const [miniCam, setMiniCam] = useState({ col: 0, row: 0 });
  const [soundMuted, setSoundMuted] = useState(isMuted);
  const [countdown, setCountdown] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pickupNotif, setPickupNotif] = useState(null); // { icon, text, color }

  const gameRef = useRef(null);
  const containerRef = useRef(null);   // div Phaser mountsto
  const gameStateRef = useRef(null);
  const keysHeld = useRef(new Set());
  const moveInterv = useRef(null);
  const touchInterv = useRef(null);
  const tapTarget = useRef(null);
  const tapActiveRef = useRef(false);
  const tapRafRef = useRef(null);
  const tapLastMove = useRef(0);
  const prevExpIds = useRef(new Set());
  const prevItems = useRef([]);
  const pickupTimerRef = useRef(null);
  const gameOverTimerRef = useRef(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  //  Fullscreen 
  useEffect(() => {
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.matchMedia('(max-width:768px)').matches;
    if (isMobile) { const h = () => { document.documentElement.requestFullscreen?.(); window.removeEventListener('touchstart', h); }; window.addEventListener('touchstart', h, { once: true }); }
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); };

  //  BGM 
  useEffect(() => {
    playBGM();
    const h = () => playBGM();
    window.addEventListener('click', h, { once: true }); window.addEventListener('keydown', h, { once: true });
    return () => { stopBGM(); window.removeEventListener('click', h); window.removeEventListener('keydown', h); };
  }, []);

  //  Countdown 
  useEffect(() => {
    if (!gameState?.timeRemaining) return;
    setCountdown(Math.ceil(gameState.timeRemaining / 1000));
    const iv = setInterval(() => setCountdown(p => p !== null && p > 0 ? p - 1 : p), 1000);
    return () => clearInterval(iv);
  }, [gameState?.timeRemaining]);

  //  Explosion sounds – chỉ phát khi là bom do mình đặt 
  useEffect(() => {
    const explosions = gameState?.explosions ?? [];
    for (const exp of explosions) {
      const expKey = exp.id ?? exp.bombId;
      if (!prevExpIds.current.has(expKey) && exp.ownerUid === currentUid) {
        playSound('explosion');
        break; // chỉ phát 1 lần dù nhiều bom nổ cùng lúc
      }
    }
    prevExpIds.current = new Set(explosions.map(e => e.id ?? e.bombId));
  }, [gameState?.explosions, currentUid]);

  //  PowerUp sound + Toast – phát khi items giảm (player vừa lượm vật phẩm) 
  useEffect(() => {
    const curItems = gameState?.items ?? [];
    const curIds = new Set(curItems.map(i => i.id));
    const me = gameState?.players?.[currentUid];
    if (me?.alive) {
      // Item biến mất VÀ vị trí của nó trùng với player hiện tại
      const pickedItem = prevItems.current.find(
        item => !curIds.has(item.id) && item.row === me.row && item.col === me.col
      );
      if (pickedItem) {
        playSound('powerup');
        // Hiện toast tương ứng loại item
        const notifMap = {
          life: { icon: '❤️', text: '+1 Mạng!', color: '#ef4444' },
          range: { icon: '🔥', text: '+1 Tầm bắn!', color: '#f97316' },
          bomb: { icon: '💣', text: '+1 Bom!', color: '#a78bfa' },
        };
        const notif = notifMap[pickedItem.type] ?? { icon: '⭐', text: 'Vật phẩm!', color: '#facc15' };
        clearTimeout(pickupTimerRef.current);
        setPickupNotif(notif);
        pickupTimerRef.current = setTimeout(() => setPickupNotif(null), 1500);
      }
    }
    prevItems.current = curItems;
  }, [gameState?.items, currentUid]);

  //  Compute Phaser canvas zoom so VP fits screen 
  const calcZoom = useCallback(() => {
    const isMobile = window.innerWidth < 768;
    const resH = isMobile ? HUD_H_MOBILE + DPAD_H : HUD_H_DESKTOP + 40;
    return Math.max(0.4, Math.min(1.6, Math.min(
      (window.innerWidth - 8) / (VP_COLS * TILE),
      (window.innerHeight - resH) / (VP_ROWS * TILE)
    )));
  }, []);

  // ── Phaser bootstrap ──
  useEffect(() => {
    // BẮT BUỘC: Nếu thẻ div chưa có HOẶC game đã chạy rồi thì bỏ qua
    if (!containerRef.current || gameRef.current) return;

    const zoom = calcZoom();

    // Bridge object shared with scene
    const bridge = {
      currentUid,
      onCamUpdate: (col, row) => setMiniCam({ col, row }),
      scene: null,
      ready: false,
      pendingState: gameStateRef.current || null,
    };
    window.__phaserBridge = bridge;

    const config = {
      type: Phaser.WEBGL,
      width: VP_COLS * TILE,
      height: VP_ROWS * TILE,
      zoom,
      parent: containerRef.current,
      backgroundColor: '#0f172a',
      pixelArt: true,
      scene: MainScene,
      scale: { mode: Phaser.Scale.NONE },
      render: { antialias: false, pixelArt: true },
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    const onResize = () => {
      if (gameRef.current) gameRef.current.scale.setZoom(calcZoom());
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.__phaserBridge = null;
      if (game) game.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Chỉ chạy 1 lần khi mount – KHÔNG phụ thuộc gameState/connState để tránh destroy/recreate Phaser mỗi khi có state mới

  //  Forward game state  Phaser scene 
  useEffect(() => {
    if (!gameState) return;
    const bridge = window.__phaserBridge;
    if (!bridge) return;
    bridge.currentUid = currentUid;
    if (bridge.ready && bridge.scene) {
      bridge.scene.applyState(gameState);
    } else {
      // Scene not ready yet: store for pending apply in scene.create()
      bridge.pendingState = gameState;
    }
  }, [gameState, currentUid]);

  //  Socket 
  useEffect(() => {
    const onStart = ({ gameState: gs }) => { if (gs) setGameState(gs); };
    const onState = (gs) => setGameState(gs);
    // Delay 900ms = EXPLOSION_DUR (700ms) + buffer (200ms) để animation nổ chạy xong
    const onOver = (data) => {
      clearTimeout(gameOverTimerRef.current);
      gameOverTimerRef.current = setTimeout(() => setGameOver(data), 1200);
    };
    const onSyncErr = () => navigate('/game-lobby', { replace: true, state: { toast: 'Game đã kết thúc.' } });
    const onDisconnect = (reason) => { if (reason === 'io server disconnect') navigate('/game-lobby', { replace: true }); else setConnState('reconnecting'); };
    const onReconnect = () => { setConnState('connected'); socket.emit('game:sync', { roomId }); };
    let lostTimer = null;
    const onReconnectAttempt = (n) => { if (n >= 8) { setConnState('lost'); lostTimer = setTimeout(() => navigate('/game-lobby', { replace: true }), 3000); } };

    socket.on('game:start', onStart); socket.on('game:state', onState); socket.on('game:over', onOver);
    socket.on('game:sync_error', onSyncErr); socket.on('disconnect', onDisconnect); socket.on('connect', onReconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    async function initAndSync() {
      if (!socket.connected) {
        try {
          const { auth: fa } = await import('../../config/firebase');
          const user = fa.currentUser;
          if (!user) { navigate('/', { replace: true }); return; }
          setConnState('reconnecting');
          const token = await user.getIdToken(true);
          const { getDoc, doc } = await import('firebase/firestore');
          const { db } = await import('../../config/firebase');
          let fullName = '', photoURL = user.photoURL || '';
          try { const snap = await getDoc(doc(db, 'users', user.uid)); if (snap.exists()) { fullName = snap.data().fullName || ''; photoURL = snap.data().avatar || photoURL; } } catch (_) { }
          socket.auth = { token, photoURL, fullName };
          await new Promise((res, rej) => { socket.once('connect', res); socket.once('connect_error', rej); socket.connect(); });
          setConnState('connected');
        } catch (e) { navigate('/game-lobby', { replace: true, state: { toast: 'Không thể kết nối.' } }); return; }
      }
      socket.emit('game:sync', { roomId });
    }
    initAndSync();
    const fallback = setTimeout(() => setGameState(p => { if (!p) navigate('/game-lobby', { replace: true }); return p; }), 8000);

    return () => {
      socket.off('game:start', onStart); socket.off('game:state', onState); socket.off('game:over', onOver);
      socket.off('game:sync_error', onSyncErr); socket.off('disconnect', onDisconnect); socket.off('connect', onReconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      clearTimeout(fallback); if (lostTimer) clearTimeout(lostTimer);
      clearTimeout(gameOverTimerRef.current);
    };
  }, [roomId, navigate]);

  //  Input 
  const handleMove = useCallback((dir) => movePlayer(roomId, dir), [roomId]);
  const handleBomb = useCallback(() => { playSound('placeBomb'); placeBomb(roomId); }, [roomId]);

  const doMove = useCallback((d) => {
    handleMove(d);
    const bridge = window.__phaserBridge;
    const gs = gameStateRef.current;
    if (bridge?.ready && bridge.scene && gs) bridge.scene.predictMove(d, gs);
  }, [handleMove]);

  useEffect(() => {
    const KEY = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    const startRepeat = () => { clearInterval(moveInterv.current); moveInterv.current = setInterval(() => { for (const d of ['up', 'down', 'left', 'right']) { if (!keysHeld.current.has(d)) continue; doMove(d); break; } }, MOVE_INTERVAL_MS); };
    const dn = (e) => { if (KEY[e.key]) { e.preventDefault(); const dir = KEY[e.key]; if (!keysHeld.current.has(dir)) { keysHeld.current.add(dir); doMove(dir); startRepeat(); } } if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleBomb(); } };
    const up = (e) => { if (KEY[e.key]) keysHeld.current.delete(KEY[e.key]); };
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up); startRepeat();
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); clearInterval(moveInterv.current); tapActiveRef.current = false; if (tapRafRef.current) cancelAnimationFrame(tapRafRef.current); };
  }, [doMove, handleBomb]);

  const handleBack = useCallback(() => { if (!gameOver) leaveGame(roomId); else leaveRoom(roomId); navigate('/game-lobby'); }, [roomId, navigate, gameOver]);

  //  Tap-to-Move 
  const calcTapTarget = useCallback((touch) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const zoom = gameRef.current?.scale?.zoom || 1;
    const scrollX = window.__phaserBridge?.scene?.cameras?.main?.scrollX || 0;
    const scrollY = window.__phaserBridge?.scene?.cameras?.main?.scrollY || 0;
    const relX = (touch.clientX - rect.left) / zoom + scrollX;
    const relY = (touch.clientY - rect.top) / zoom + scrollY;
    return { row: Math.max(0, Math.min(Math.floor(relY / TILE), MAP_H - 1)), col: Math.max(0, Math.min(Math.floor(relX / TILE), MAP_W - 1)) };
  }, []);

  const startTapRaf = useCallback(() => {
    if (tapRafRef.current) return;
    const loop = (now) => {
      if (!tapActiveRef.current) { tapRafRef.current = null; return; }
      const target = tapTarget.current;
      if (target && now - tapLastMove.current >= MOVE_INTERVAL_MS) {
        const gs = gameStateRef.current; const me = gs?.players[currentUid];
        if (me?.alive) { const dR = target.row - me.row, dC = target.col - me.col; if (dR || dC) { doMove(Math.abs(dR) >= Math.abs(dC) ? (dR > 0 ? 'down' : 'up') : (dC > 0 ? 'right' : 'left')); tapLastMove.current = now; } }
      }
      tapRafRef.current = requestAnimationFrame(loop);
    };
    tapRafRef.current = requestAnimationFrame(loop);
  }, [doMove, currentUid]);

  const stopTapRaf = useCallback(() => { tapActiveRef.current = false; if (tapRafRef.current) { cancelAnimationFrame(tapRafRef.current); tapRafRef.current = null; } tapTarget.current = null; }, []);
  const handleMapTouch = useCallback((e) => { if (e.cancelable) e.preventDefault(); const t = e.touches[0]; if (!t) return; const tg = calcTapTarget(t); if (!tg) return; tapTarget.current = tg; tapActiveRef.current = true; tapLastMove.current = 0; startTapRaf(); }, [calcTapTarget, startTapRaf]);
  const handleMapTouchMove = useCallback((e) => { if (e.cancelable) e.preventDefault(); const t = e.touches[0]; if (!t) return; const tg = calcTapTarget(t); if (tg) tapTarget.current = tg; }, [calcTapTarget]);
  const handleMapTouchEnd = useCallback((e) => { if (e.cancelable) e.preventDefault(); stopTapRaf(); }, [stopTapRaf]);

  // Không early-return ở đây – phải giữ containerRef trong DOM để Phaser mount được
  const players = gameState ? Object.values(gameState.players) : [];
  const me = gameState?.players?.[currentUid];
  const isLoading = !gameState;
  const isConnError = connState !== 'connected' && !gameOver;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col select-none overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center,#0f172a,#020617)', touchAction: 'none' }}>

      {/* HUD – chỉ hiện khi đã có gameState */}
      {gameState && (
        <div className="bg-gray-900/95 border-b border-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-1 px-2 pt-1.5 pb-1">
            <div className="flex gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none">
              <div className="hidden md:flex gap-1 flex-wrap">{players.map(p => <PlayerPill key={p.uid} player={p} isMe={p.uid === currentUid} compact={false} />)}</div>
              <div className="flex md:hidden gap-1">{players.map(p => <PlayerPill key={p.uid} player={p} isMe={p.uid === currentUid} compact={true} />)}</div>
            </div>
            {countdown !== null && (
              <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-lg font-mono font-bold text-xs border flex-shrink-0 ${countdown <= 30 ? 'text-red-400 border-red-500/40 bg-red-500/10 animate-pulse' : countdown <= 60 ? 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10' : 'text-white border-white/10 bg-white/5'}`}>
                ⏱️ {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              </div>
            )}
            <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
              <MiniMap map={gameState.map} players={players} currentUid={currentUid} camCol={miniCam.col} camRow={miniCam.row} />
              <button onClick={() => { const m = toggleMute(); setSoundMuted(m); }} className="text-lg w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 active:scale-90 transition-transform">{soundMuted ? '🔇' : '🔊'}</button>
              <button onClick={toggleFullscreen} className="text-sm w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 active:scale-90 transition-transform">{isFullscreen ? '🗗' : '⛶'}</button>
              <button onClick={handleBack} className="text-red-400/70 hover:text-red-400 text-xs px-2 h-8 rounded-lg border border-white/10 hover:border-red-500/40 transition-all flex items-center">Thoát</button>
            </div>
          </div>
          <div className="flex md:hidden items-center gap-1.5 px-2 pb-1.5">
            <MiniMap map={gameState.map} players={players} currentUid={currentUid} camCol={miniCam.col} camRow={miniCam.row} />
            <div className="flex-1" />
            <button onClick={() => { const m = toggleMute(); setSoundMuted(m); }} className="text-base w-8 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10 active:scale-90 transition-transform">{soundMuted ? '🔇' : '🔊'}</button>
            <button onClick={toggleFullscreen} className="text-xs w-8 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10 active:scale-90 transition-transform">{isFullscreen ? '🗗' : '⛶'}</button>
          </div>
        </div>
      )}

      {/* Game area */}
      <div className="flex-1 flex flex-col items-center justify-center p-2"
        style={{ paddingBottom: `max(${DPAD_H}px, calc(${DPAD_H}px + env(safe-area-inset-bottom)))` }}>
        <div style={{ position: 'relative', display: 'inline-block', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 40px rgba(99,102,241,.2), 0 25px 50px -12px rgba(0,0,0,.8)', minWidth: `${VP_COLS * TILE * 0.7}px`, minHeight: `${VP_ROWS * TILE * 0.7}px` }}>
          {/* Phaser canvas mount point – luôn có trong DOM */}
          <div
            ref={containerRef}
            onTouchStart={handleMapTouch} onTouchMove={handleMapTouchMove}
            onTouchEnd={handleMapTouchEnd} onTouchCancel={handleMapTouchEnd}
            style={{ display: 'block', touchAction: 'none', lineHeight: 0 }}
          />
          {/* Loading overlay – hiện đè lên canvas khi chưa có state */}
          {isLoading && !isConnError && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.95)', gap: 12 }}>
              <div style={{ fontSize: 48 }} className="animate-bounce">💣</div>
              <p style={{ color: 'white', fontSize: 14, fontWeight: 600 }} className="animate-pulse">Đang tải game...</p>
            </div>
          )}
          {/* Connection error overlay */}
          {isConnError && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.97)', gap: 16 }}>
              {connState === 'reconnecting'
                ? (<><div className="relative w-14 h-14"><div className="absolute inset-0 rounded-full border-4 border-indigo-500/30" /><div className="absolute inset-0 rounded-full border-4 border-t-indigo-400 animate-spin" /><span className="absolute inset-0 flex items-center justify-center text-2xl">📡</span></div><p style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Đang kết nối lại...</p></>)
                : (<><span style={{ fontSize: 48 }}>❌</span><p style={{ color: '#f87171', fontWeight: 700, fontSize: 16 }}>Mất kết nối</p></>)}
            </div>
          )}
          {/* HUD overlays on top */}
          {gameOver && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
              <GameOverOverlay winner={gameOver.winner} winnerName={gameOver.winnerName} reward={gameOver.reward} reason={gameOver.reason} refundedUids={gameOver.refundedUids ?? []} currentUid={currentUid} />
            </div>
          )}
          {me && !me.alive && !gameOver && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'grayscale(80%)', pointerEvents: 'none' }}>
              <div style={{ marginTop: 24, textAlign: 'center', background: 'rgba(0,0,0,.7)', padding: '8px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)' }}>
                <p style={{ fontSize: 28 }}>💀</p><p style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>Đã bị loại!</p><p style={{ color: '#9ca3af', fontSize: 12 }}>Spectator mode...</p>
              </div>
            </div>
          )}
          {/* Pickup notification toast */}
          {pickupNotif && (
            <div style={{
              position: 'absolute', top: '38%', left: '50%', zIndex: 25,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              animation: 'pickupPop 1.5s ease forwards',
            }}>
              <style>{`
                @keyframes pickupPop {
                  0%   { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.85); }
                  15%  { opacity: 1; transform: translateX(-50%) translateY(-4px) scale(1.1); }
                  30%  { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1); }
                  70%  { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1); }
                  100% { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(0.9); }
                }
              `}</style>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 18px', borderRadius: 999,
                background: 'rgba(15,23,42,0.92)',
                border: `2px solid ${pickupNotif.color}55`,
                boxShadow: `0 0 20px ${pickupNotif.color}55, 0 4px 20px rgba(0,0,0,0.6)`,
              }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>{pickupNotif.icon}</span>
                <span style={{ color: pickupNotif.color, fontWeight: 800, fontSize: 16, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>{pickupNotif.text}</span>
              </div>
            </div>
          )}

        </div>
        <p className="text-gray-700 text-xs hidden md:block tracking-wide pt-2">WASD   di chuyển &nbsp;&nbsp; Space / Enter đặt bom</p>
        <p className="text-gray-700/60 text-[10px] md:hidden tracking-wide pt-1 text-center">Chạm bản đồ để di chuyển  D-Pad hoặc chạm ô đích</p>
      </div>

      {/* Mobile D-Pad */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-end justify-between px-4 pb-4 pt-2 bg-gradient-to-t from-black/70 to-transparent" style={{ pointerEvents: 'none' }}>
        <div className="relative flex-shrink-0" style={{ width: 160, height: 160, pointerEvents: 'auto' }}>
          {[{ dir: 'up', top: 0, left: 55, label: '▲' }, { dir: 'left', top: 55, left: 0, label: '◀' }, { dir: 'right', top: 55, left: 110, label: '▶' }, { dir: 'down', top: 110, left: 55, label: '▼' }].map(({ dir, top, left, label }) => (
            <button key={dir}
              onTouchStart={(e) => { e.preventDefault(); clearInterval(touchInterv.current); doMove(dir); touchInterv.current = setInterval(() => doMove(dir), MOVE_INTERVAL_MS); }}
              onTouchEnd={(e) => { e.preventDefault(); clearInterval(touchInterv.current); }}
              onTouchCancel={(e) => { e.preventDefault(); clearInterval(touchInterv.current); }}
              style={{ position: 'absolute', top, left, width: 50, height: 50, touchAction: 'none' }}
              className="rounded-2xl bg-gray-800/85 active:bg-indigo-600 border-2 border-white/20 active:border-indigo-400 flex items-center justify-center text-white text-xl font-bold shadow-xl active:scale-90 transition-all">
              {label}
            </button>
          ))}
          <div className="absolute rounded-xl bg-gray-900/60 border border-white/10" style={{ top: 60, left: 60, width: 40, height: 40 }} />
        </div>
        <div className="flex flex-col items-center gap-2 flex-shrink-0" style={{ pointerEvents: 'auto' }}>
          <button onClick={toggleFullscreen} className="w-10 h-10 rounded-xl bg-gray-800/70 border border-white/15 flex items-center justify-center text-white/70 text-lg active:scale-90 transition-transform shadow-lg">{isFullscreen ? '' : ''}</button>
          <button onClick={handleBack} className="w-10 h-10 rounded-xl bg-red-900/50 border border-red-500/30 flex items-center justify-center text-red-400 text-sm font-bold active:scale-90 transition-transform shadow-lg"></button>
        </div>
        <div className="flex-shrink-0" style={{ pointerEvents: 'auto' }}>
          <button onTouchStart={(e) => { e.preventDefault(); handleBomb(); }} className="w-20 h-20 rounded-full active:scale-90 transition-transform flex items-center justify-center shadow-2xl text-4xl select-none"
            style={{ background: 'radial-gradient(circle at 35% 35%,#fb923c,#dc2626 60%,#7f1d1d)', border: '3px solid rgba(255,200,100,.35)', boxShadow: '0 0 30px rgba(239,68,68,.6),0 8px 24px rgba(0,0,0,.6)' }}>💣</button>
          <p className="text-white/40 text-[10px] text-center mt-1">BOM</p>
        </div>
      </div>
    </div>
  );
}

export default PhaserBombGame;
