// src/pages/public/BombGame.jsx
import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket, movePlayer, placeBomb, leaveRoom, leaveGame } from '../../services/api/socket';
import { auth } from '../../config/firebase';
import { playSound, toggleMute, isMuted, playBGM, stopBGM } from '../../utils/audioManager';

// ─── Constants ─────────────────────────────────────────────────
const MAP_W = 29;
const MAP_H = 13;
const VP_COLS = 15;
const VP_ROWS = 13;
// ─── Movement Speed ────────────────────────────────────────────
// ↓↓ CHỈNH TỐC ĐỘ DI CHUYỂN TẠI ĐÂY ↓↓
// Tăng số để đi CHẬM hơn, giảm để đi NHANH hơn.
// Giá trị tối thiểu: 130 (= server cooldown). Khuyến nghị: 160–250.
const MOVE_INTERVAL_MS = 160;   // ← khoảng cách giữa 2 bước khi giữ phím (ms)
const MOVE_ANIM_MS = MOVE_INTERVAL_MS; // animation = đúng 1 bước (không được đổi riêng cái này)

const CELL_EMPTY = 0, CELL_WALL = 1, CELL_BLOCK = 2;
const CAM_LERP = 0.25; // hệ số lerp camera (tăng để camera bám mượt hơn trên mobile)
const DPAD_H = 190;    // chiều cao D-pad mobile (px) — dùng để tính cellSize
const HUD_H_MOBILE = 75;  // HUD mobile: 2 hàng (~75px)
const HUD_H_DESKTOP = 50; // HUD desktop: 1 hàng

// ─── Explosion Logic (client-side mirror of server calcExplosion) ──────────
/**
 * Tính toán những ô nào bị ảnh hưởng bởi vụ nổ.
 * @param {number} bombRow  - hàng (row) của bom
 * @param {number} bombCol  - cột (col) của bom
 * @param {number} power    - độ dài tối đa của tia lửa
 * @param {number[][]} mapData - mảng 2D chứa loại ô (CELL_EMPTY/WALL/BLOCK)
 * @returns {{ row: number, col: number, type: 'center'|'ray' }[]} Mảng các ô bị lửa bao phủ
 */
function calculateExplosion(bombRow, bombCol, power, mapData) {
    const cells = [{ row: bombRow, col: bombCol, type: 'center' }];
    const rows = mapData.length;
    const cols = mapData[0]?.length || 0;

    // 4 hướng: Lên, Xuống, Trái, Phải
    const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of DIRECTIONS) {
        for (let i = 1; i <= power; i++) {
            const r = bombRow + dr * i;
            const c = bombCol + dc * i;

            // Vượt biên map → dừng
            if (r < 0 || r >= rows || c < 0 || c >= cols) break;

            const cell = mapData[r][c];

            // Tường cứng (CELL_WALL) → tia lửa dừng NGAY TRƯỚC, không ghi nhận ô này
            if (cell === CELL_WALL) break;

            // Gạch mềm (CELL_BLOCK) → phá vỡ (tính ô này), rồi DỪNG
            cells.push({ row: r, col: c, type: 'ray' });
            if (cell === CELL_BLOCK) break;
        }
    }

    return cells;
}

// ─── Easing ────────────────────────────────────────────────────
/** linear: constant-speed interpolation — no deceleration snap at step boundary */
function linear(t) { return t; }

// ─── SVG Assets ────────────────────────────────────────────────
const SVG = {
    floor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#1a1a2e"/>
      <rect x="0" y="0" width="16" height="16" fill="#1e1e38" opacity=".5"/>
      <rect x="16" y="16" width="16" height="16" fill="#1e1e38" opacity=".5"/>
    </svg>`,
    wall: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#374151"/>
      <rect x="1" y="1" width="30" height="30" fill="#4b5563"/>
      <rect x="2" y="2" width="28" height="5" fill="#6b7280" rx="1"/>
      <rect x="2" y="10" width="12" height="5" fill="#6b7280" rx="1"/>
      <rect x="18" y="10" width="12" height="5" fill="#6b7280" rx="1"/>
      <rect x="2" y="18" width="28" height="5" fill="#6b7280" rx="1"/>
      <rect x="2" y="26" width="12" height="4" fill="#6b7280" rx="1"/>
      <rect x="18" y="26" width="12" height="4" fill="#6b7280" rx="1"/>
      <rect x="1" y="1" width="30" height="30" fill="none" stroke="#1f2937" stroke-width="1"/>
    </svg>`,
    block: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#92400e"/>
      <rect x="1" y="1" width="30" height="30" fill="#b45309" rx="2"/>
      <rect x="2" y="2" width="28" height="28" fill="none" stroke="#78350f" stroke-width="2" rx="1"/>
      <line x1="16" y1="2" x2="16" y2="30" stroke="#78350f" stroke-width="1.5"/>
      <line x1="2" y1="16" x2="30" y2="16" stroke="#78350f" stroke-width="1.5"/>
      <line x1="2" y1="2" x2="30" y2="30" stroke="#78350f" stroke-width="1" opacity=".4"/>
      <line x1="30" y1="2" x2="2" y2="30" stroke="#78350f" stroke-width="1" opacity=".4"/>
      <rect x="2" y="2" width="28" height="3" fill="#d97706" opacity=".5" rx="1"/>
      <rect x="2" y="2" width="3" height="28" fill="#d97706" opacity=".5" rx="1"/>
    </svg>`,
    bomb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="18" r="11" fill="#111827"/>
      <circle cx="16" cy="18" r="11" fill="none" stroke="#374151" stroke-width="1.5"/>
      <ellipse cx="12" cy="13" rx="4" ry="3" fill="#1f2937" opacity=".6"/>
      <circle cx="13" cy="13" r="2" fill="white" opacity=".15"/>
      <line x1="16" y1="7" x2="20" y2="3" stroke="#78350f" stroke-width="2" stroke-linecap="round"/>
      <circle cx="21" cy="2" r="3" fill="#f97316"/>
      <circle cx="21" cy="2" r="1.5" fill="#fbbf24"/>
      <circle cx="21" cy="1" r="1" fill="white" opacity=".8"/>
    </svg>`,
    explosionCenter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M-1,1 h18 v14 h-18 z M1,-1 h14 v18 h-14 z"/><path fill="#facc15" d="M-1,3 h18 v10 h-18 z M3,-1 h10 v18 h-10 z"/><path fill="#ffffff" d="M-1,5 h18 v6 h-18 z M5,-1 h6 v18 h-6 z"/></svg>`,
    explosionH: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M-1,1 h18 v14 h-18 z"/><path fill="#facc15" d="M-1,3 h18 v10 h-18 z"/><path fill="#ffffff" d="M-1,5 h18 v6 h-18 z"/></svg>`,
    explosionV: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M1,-1 h14 v18 h-14 z"/><path fill="#facc15" d="M3,-1 h10 v18 h-10 z"/><path fill="#ffffff" d="M5,-1 h6 v18 h-6 z"/></svg>`,
    explosionEndL: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M16,1 h-10 v2 h-2 v2 h-2 v6 h2 v2 h2 v2 h10 z"/><path fill="#facc15" d="M16,3 h-8 v2 h-2 v6 h2 v2 h8 z"/><path fill="#ffffff" d="M16,5 h-6 v6 h6 z"/></svg>`,
    explosionEndR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M0,1 h10 v2 h2 v2 h2 v6 h-2 v2 h-2 v2 h-10 z"/><path fill="#facc15" d="M0,3 h8 v2 h2 v6 h-2 v2 h-8 z"/><path fill="#ffffff" d="M0,5 h6 v6 h-6 z"/></svg>`,
    explosionEndU: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M1,16 v-10 h2 v-2 h2 v-2 h6 v2 h2 v2 h2 v10 z"/><path fill="#facc15" d="M3,16 v-8 h2 v-2 h6 v2 h2 v8 z"/><path fill="#ffffff" d="M5,16 v-6 h6 v6 z"/></svg>`,
    explosionEndD: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M1,0 v10 h2 v2 h2 v2 h6 v-2 h2 v-2 h2 v-10 z"/><path fill="#facc15" d="M3,0 v8 h2 v2 h6 v-2 h2 v-8 z"/><path fill="#ffffff" d="M5,0 v6 h6 v-6 z"/></svg>`,
    blockDebris: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="10" height="6" fill="#92400e" rx="1" transform="rotate(-15 7 5)"/>
      <rect x="3" y="3" width="8" height="4" fill="#b45309" rx="1" transform="rotate(-15 7 5)"/>
      <rect x="20" y="2" width="9" height="5" fill="#78350f" rx="1" transform="rotate(20 24 4)"/>
      <rect x="21" y="3" width="7" height="3" fill="#a16207" rx="1" transform="rotate(20 24 4)"/>
      <rect x="1" y="22" width="8" height="7" fill="#92400e" rx="1" transform="rotate(10 5 25)"/>
      <rect x="2" y="23" width="6" height="5" fill="#b45309" rx="1" transform="rotate(10 5 25)"/>
      <rect x="21" y="23" width="9" height="6" fill="#78350f" rx="1" transform="rotate(-12 25 26)"/>
      <rect x="22" y="24" width="7" height="4" fill="#a16207" rx="1" transform="rotate(-12 25 26)"/>
      <rect x="13" y="12" width="5" height="5" fill="#92400e" rx="1" transform="rotate(30 15 14)"/>
    </svg>`,
    itemLife: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#0f172a" rx="3"/>
      <path d="M16 26 C8 21 4 16 4 11 C4 7 7 4 11 4 C13.5 4 15.5 5.5 16 7 C16.5 5.5 18.5 4 21 4 C25 4 28 7 28 11 C28 16 24 21 16 26Z" fill="#ef4444"/>
      <path d="M16 23 C9 19 6 15 6 11 C6 8.5 8.2 6.5 11 6.5 C13 6.5 14.5 8 16 10 C17.5 8 19 6.5 21 6.5 C23.8 6.5 26 8.5 26 11 C26 15 23 19 16 23Z" fill="#f87171"/>
    </svg>`,
    itemRange: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#0f172a" rx="3"/>
      <polygon points="20,3 10,18 16,18 12,29 22,14 16,14" fill="#f97316"/>
      <polygon points="20,3 11,17 17,17 13,27 21,13 15.5,13" fill="#fbbf24"/>
    </svg>`,
    itemBomb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#0f172a" rx="3"/>
      <circle cx="13" cy="20" r="8" fill="#111827"/>
      <circle cx="13" cy="20" r="8" fill="none" stroke="#374151" stroke-width="1.5"/>
      <line x1="13" y1="12" x2="17" y2="8" stroke="#78350f" stroke-width="2" stroke-linecap="round"/>
      <circle cx="18" cy="7" r="2.5" fill="#f97316"/>
      <rect x="22" y="14" width="8" height="2.5" fill="#a78bfa" rx="1"/>
      <rect x="24.75" y="11.5" width="2.5" height="8" fill="#a78bfa" rx="1"/>
    </svg>`,
};
const svgUrl = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

// ─── Sub: Player Avatar (pure display) ─────────────────────────
function PlayerAvatar({ player, size, isMe }) {
    const [err, setErr] = useState(false);
    return (
        <div style={{
            width: size, height: size,
            borderRadius: '50%',
            overflow: 'hidden',
            border: isMe ? '2.5px solid white' : `2px solid ${player.color}`,
            backgroundColor: player.color,
            boxShadow: isMe
                ? `0 0 14px white, 0 0 6px ${player.color}`
                : `0 0 8px ${player.color}aa`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
        }}>
            {player.photoURL && !err ? (
                <img src={player.photoURL} alt={player.name}
                    onError={() => setErr(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    draggable={false} />
            ) : (
                <span style={{ color: 'white', fontWeight: 700, fontSize: size * 0.42, userSelect: 'none' }}>
                    {player.name?.[0]?.toUpperCase() || '?'}
                </span>
            )}
        </div>
    );
}

// ─── Sub: HUD Pill ─────────────────────────────────────────────
// compact=true: chế độ rút gọn cho mobile (không hiện tên)
function PlayerPill({ player, isMe, compact = false }) {
    const [err, setErr] = useState(false);
    return (
        <div className={`flex items-center rounded-lg border flex-shrink-0
            ${compact ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'}
            ${player.alive ? 'bg-white/5 border-white/10' : 'opacity-40 bg-white/2 border-white/5'}`}
            style={isMe ? { borderColor: 'rgba(165,180,252,0.4)', background: 'rgba(99,102,241,0.1)' } : {}}>
            {/* Avatar */}
            <div className={`rounded-full overflow-hidden flex-shrink-0 border border-white/30 ${compact ? 'w-5 h-5' : 'w-5 h-5'}`}
                style={{ backgroundColor: player.color }}>
                {player.photoURL && !err ? (
                    <img src={player.photoURL} alt="" onError={() => setErr(true)}
                        className="w-full h-full object-cover" draggable={false} />
                ) : (
                    <span className="text-white font-bold flex items-center justify-center h-full"
                        style={{ fontSize: 10 }}>
                        {player.name?.[0]?.toUpperCase()}
                    </span>
                )}
            </div>
            {/* Tên — ẩn trên compact mode */}
            {!compact && (
                <span className={`text-xs font-medium truncate max-w-[70px] ${player.alive ? 'text-white' : 'text-gray-600 line-through'}`}>
                    {player.name}{isMe ? ' ★' : ''}
                </span>
            )}
            {/* Thông số: tim ♥ + bom 💣 */}
            <span className="flex items-center gap-px flex-shrink-0" style={{ fontSize: 11 }}>
                <span style={{ color: '#ef4444' }}>♥</span>
                <span className="text-white/80 font-bold" style={{ fontSize: 10, lineHeight: 1 }}>{player.lives ?? 0}</span>
            </span>
            {player.bombCount !== undefined && (
                <span className="flex items-center gap-px flex-shrink-0" style={{ fontSize: 10 }}>
                    <span>💣</span>
                    <span className="text-white/70 font-bold" style={{ fontSize: 10, lineHeight: 1 }}>{player.bombCount}</span>
                </span>
            )}
            {player.range !== undefined && !compact && (
                <span className="flex items-center gap-px flex-shrink-0" style={{ fontSize: 10 }}>
                    <span>🔥</span>
                    <span className="text-white/70 font-bold" style={{ fontSize: 10, lineHeight: 1 }}>{player.range}</span>
                </span>
            )}
        </div>
    );
}

// ─── Sub: Mini-map ─────────────────────────────────────────────
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
                    background: p.uid === currentUid ? 'white' : p.color,
                    zIndex: 2,
                }} />
            ))}
            <div className="absolute border border-green-400/80 bg-green-400/10 pointer-events-none" style={{
                left: camCol * S, top: camRow * S,
                width: VP_COLS * S, height: VP_ROWS * S,
                zIndex: 3,
            }} />
        </div>
    );
}

// ─── Sub: Game Over ────────────────────────────────────────────
function GameOverOverlay({ winner, winnerName, currentUid, reward, reason, refundedUids = [], onBack }) {
    const isWinner = winner === currentUid;
    const isTimeoutDraw = !winner && reason === 'timeout'; // hết giờ, hòa
    const isSurvivor = isTimeoutDraw && refundedUids.includes(currentUid); // còn sống khi hết giờ hòa
    const [secs, setSecs] = useState(8);

    useEffect(() => {
        const iv = setInterval(() => {
            setSecs(s => {
                if (s <= 1) { clearInterval(iv); window.location.reload(); return 0; }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(iv);
    }, []);

    const rewardDisplay = reward ?? (winner ? 100 : 0);

    // Chọn icon và nội dung theo từng kết quả
    let icon, title, subtitle;
    if (winner) {
        icon = isWinner ? '🏆' : '💀';
        title = isWinner ? 'Bạn thắng!' : 'Bạn thua!';
        subtitle = isWinner
            ? <span className="text-yellow-400 font-semibold">+{rewardDisplay} Xu đã được cộng!</span>
            : <span>{winnerName} thắng &mdash; <span className="text-red-400">-20 Xu</span></span>;
    } else if (isTimeoutDraw) {
        // Hết giờ, không ai thắng hơn hẳn
        icon = isSurvivor ? '⏱️' : '☠️';
        title = isSurvivor ? 'Hết giờ — Bạn còn sống!' : 'Hết giờ — Bạn đã bị loại';
        subtitle = isSurvivor
            ? <span className="text-green-400 font-semibold">Hoàn trả +20 Xu (còn sống khi hết giờ)</span>
            : <span className="text-red-400">-20 Xu (đã bị loại trước khi hết giờ)</span>;
    } else {
        icon = '🤝';
        title = 'Hòa!';
        subtitle = <span className="text-red-400">-20 Xu</span>;
    }

    return (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="flex flex-col items-center gap-5 p-8 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl text-center min-w-[300px]">
                <span className="text-6xl">{icon}</span>
                <div>
                    <p className="text-white font-bold text-2xl">{title}</p>
                    <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
                    {reason === 'timeout' && (
                        <p className="text-gray-600 text-xs mt-2">⏰ Hết 5 phút</p>
                    )}
                </div>

                {/* Countdown bar */}
                <div className="w-full">
                    <p className="text-gray-500 text-xs mb-1.5">Tự động tải lại sau {secs}s...</p>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-linear"
                            style={{ width: `${(secs / 8) * 100}%` }}
                        />
                    </div>
                </div>

                <button onClick={() => window.location.reload()}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all active:scale-95 w-full">
                    Tải lại ngay
                </button>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════
export function BombGame() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const currentUid = auth.currentUser?.uid;

    const [gameState, setGameState] = useState(null);
    const [gameOver, setGameOver] = useState(null);
    const [showNames, setShowNames] = useState(false);
    const [connState, setConnState] = useState('connected'); // 'connected' | 'reconnecting' | 'lost'
    const [cellSize, setCellSize] = useState(34);
    const [miniCam, setMiniCam] = useState({ col: 0, row: 0 });
    const [debrisList, setDebrisList] = useState([]); // hiệu ứng mảnh vụn sau khi gạch vỡ
    const [soundMuted, setSoundMuted] = useState(isMuted); // đồng bộ với audioManager
    const [hitFlash, setHitFlash] = useState({}); // uid → timestamp kết thúc flash (ảnhưởng trúng bom)
    const [countdown, setCountdown] = useState(null); // số giây còn lại
    const [isFullscreen, setIsFullscreen] = useState(false); // fullscreen state

    // ── Auto fullscreen trên mobile ────────────────────────
    useEffect(() => {
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
            || window.matchMedia('(max-width: 768px)').matches;
        const el = document.documentElement;

        const requestFS = () => {
            if (el.requestFullscreen) el.requestFullscreen();
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        };

        if (isMobile) {
            // Chờ tương tác đầu tiên rồi mới fullscreen (browser policy)
            const onInteract = () => { requestFS(); window.removeEventListener('touchstart', onInteract); };
            window.addEventListener('touchstart', onInteract, { once: true });
        }

        const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFSChange);
        document.addEventListener('webkitfullscreenchange', onFSChange);

        return () => {
            document.removeEventListener('fullscreenchange', onFSChange);
            document.removeEventListener('webkitfullscreenchange', onFSChange);
        };
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.() ?? document.documentElement.webkitRequestFullscreen?.();
        } else {
            document.exitFullscreen?.() ?? document.webkitExitFullscreen?.();
        }
    };

    // ── Phát nhạc nền khi vào game ──
    useEffect(() => {
        // Vì người chơi đã click nút "Vào phòng" ở sảnh, trình duyệt thường sẽ cho phép phát âm thanh luôn
        playBGM();

        // Backup: Nếu user vào trực tiếp bằng link (f5), trình duyệt có thể chặn autoplay.
        // Ta lắng nghe click đầu tiên để ép phát nhạc nếu nó chưa chạy.
        const handleFirstInteraction = () => { playBGM(); };
        window.addEventListener('click', handleFirstInteraction, { once: true });
        window.addEventListener('keydown', handleFirstInteraction, { once: true });

        // Tắt nhạc nền khi thoát khỏi component này (về sảnh)
        return () => {
            stopBGM();
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
        };
    }, []);

    // ── Refs (RAF-managed, no React state) ─────────────────────
    const cellSizeRef = useRef(34);
    const mapDivRef = useRef(null);        // full map div (camera transform)
    const playerLayer = useRef(null);        // player overlay div
    const targetCam = useRef({ x: 0, y: 0 });
    const currentCam = useRef({ x: 0, y: 0 });
    const rafRef = useRef(null);

    // Player animation state: uid → { fromX, fromY, toX, toY, startTime }
    const playerAnim = useRef({});
    // Current rendered pixel position: uid → { x, y }
    const playerVis = useRef({});
    // DOM refs for each player: uid → HTMLElement
    const playerRefs = useRef({});

    const keysHeld = useRef(new Set());
    const moveInterv = useRef(null);      // keyboard repeat interval
    const touchInterv = useRef(null);     // touch d-pad repeat interval (riêng để không xung đột keyboard)
    // Tap-to-move refs (dùng RAF + throttle thay vì setInterval)
    const tapTarget = useRef(null);       // { row, col } — ô đích hiện tại
    const tapActiveRef = useRef(false);   // ngón tay đang giữ xuống?
    const tapRafRef = useRef(null);       // RAF id của loop tap-to-move
    const tapLastMove = useRef(0);        // timestamp lần doMove() gần nhất
    const viewportRef = useRef(null);     // ref tới div viewport game
    const prevMapRef = useRef(null); // lưu bản đồ trước để phát hiện BLOCK→EMPTY
    const gameStateRef = useRef(null); // mirror cho interval callback (tránh stale closure)
    const camInitialized = useRef(false); // đã snap camera lần đầu chưa
    const prevLivesRef = useRef({}); // lưu lives cũ để phát hiện người bị giảm mạng

    // ── Cell size (based on VP_COLS, not MAP_W) ───────────────
    useEffect(() => {
        const calc = () => {
            const isMobile = window.innerWidth < 768;
            // Trên mobile: trừ HUD 2 hàng + D-pad cố định bên dưới
            const reservedH = isMobile ? HUD_H_MOBILE + DPAD_H : HUD_H_DESKTOP + 40;
            const s = Math.max(20, Math.min(44,
                Math.floor((window.innerWidth - 16) / VP_COLS),
                Math.floor((window.innerHeight - reservedH) / VP_ROWS)
            ));
            setCellSize(s);
            cellSizeRef.current = s;
        };
        calc();
        window.addEventListener('resize', calc);
        return () => window.removeEventListener('resize', calc);
    }, []);

    // ── Sync gameStateRef (dùng cho client-side prediction trong setInterval) ──
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    // ── Countdown timer (cập nhật mỗi giây từ timeRemaining của server) ──
    useEffect(() => {
        if (!gameState?.timeRemaining) return;
        setCountdown(Math.ceil(gameState.timeRemaining / 1000));
        const iv = setInterval(() => {
            setCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
        }, 1000);
        return () => clearInterval(iv);
    }, [gameState?.timeRemaining]); // reset interval khi server gửi timeRemaining mới

    // ── Phát hiện lives giảm → trigger hit flash ──
    useEffect(() => {
        if (!gameState?.players) return;
        const newFlashes = {};
        for (const [uid, p] of Object.entries(gameState.players)) {
            const prev = prevLivesRef.current[uid];
            // Nếu lives giảm so với lần trước → bật flash
            if (prev !== undefined && p.lives < prev) {
                newFlashes[uid] = Date.now() + 600; // flash kéo dài 600ms
            }
            prevLivesRef.current[uid] = p.lives;
        }
        if (Object.keys(newFlashes).length > 0) {
            setHitFlash(prev => ({ ...prev, ...newFlashes }));
        }
    }, [gameState?.players]);

    // ── Theo dõi explosion MỚI → phát tiếng nổ ───────────────
    // Dùng ref lưu Set<bombId> của các explosion đã phát âm thanh
    // để tránh phát lại khi server vẫn giữ explosion cũ trong state
    const prevExplosionIds = useRef(new Set());
    useEffect(() => {
        const currentExplosions = gameState?.explosions ?? [];
        const currentIds = new Set(currentExplosions.map(e => e.bombId ?? e.id));
        let hasNew = false;
        for (const id of currentIds) {
            if (!prevExplosionIds.current.has(id)) {
                hasNew = true;
                break;
            }
        }
        if (hasNew) playSound('explosion');
        prevExplosionIds.current = currentIds;
    }, [gameState?.explosions]);

    // ── Debris System: phát hiện gạch mềm bị phá → sinh hiệu ứng vỡ ───────────
    useEffect(() => {
        const cur = gameState?.map;
        const prev = prevMapRef.current;
        if (cur && prev) {
            const newDebris = [];
            for (let r = 0; r < cur.length; r++) {
                for (let c = 0; c < cur[r].length; c++) {
                    if (prev[r]?.[c] === CELL_BLOCK && cur[r][c] === CELL_EMPTY) {
                        const id = `debris_${Date.now()}_${r}_${c}`;
                        newDebris.push({ id, row: r, col: c });
                    }
                }
            }
            if (newDebris.length > 0) {
                setDebrisList(prev => [...prev, ...newDebris]);
                // Tự dọn sau 400ms (khớp với animation shatter)
                setTimeout(() => {
                    const ids = new Set(newDebris.map(d => d.id));
                    setDebrisList(prev => prev.filter(d => !ids.has(d.id)));
                }, 420);
            }
        }
        prevMapRef.current = cur ?? null;
    }, [gameState?.map]);

    // ── Master RAF loop: camera + all player animations ───────
    useEffect(() => {
        function tick() {
            const now = performance.now();

            // ── Camera lerp ──
            const dx = targetCam.current.x - currentCam.current.x;
            const dy = targetCam.current.y - currentCam.current.y;
            currentCam.current.x += dx * CAM_LERP;
            currentCam.current.y += dy * CAM_LERP;
            if (Math.abs(dx) < 0.3) currentCam.current.x = targetCam.current.x;
            if (Math.abs(dy) < 0.3) currentCam.current.y = targetCam.current.y;
            if (mapDivRef.current) {
                mapDivRef.current.style.transform =
                    `translate3d(${-currentCam.current.x}px, ${-currentCam.current.y}px, 0)`;
            }

            // ── Player animations ──
            for (const [uid, anim] of Object.entries(playerAnim.current)) {
                const t = Math.min(1, (now - anim.startTime) / anim.duration);
                const e = linear(t);
                const x = anim.fromX + (anim.toX - anim.fromX) * e;
                const y = anim.fromY + (anim.toY - anim.fromY) * e;
                playerVis.current[uid] = { x, y };

                const el = playerRefs.current[uid];
                if (el) {
                    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
                }
            }

            rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, []); // runs once, reads refs

    // ── When game state updates → update animation targets ────
    useEffect(() => {
        if (!gameState) return;
        const cs = cellSizeRef.current;

        // Update player animations
        Object.values(gameState.players).forEach(p => {
            const toX = p.col * cs;
            const toY = p.row * cs;
            const existing = playerAnim.current[p.uid];

            // ── Bỏ qua stale-state cho current player ──
            // Server có thể broadcast state cũ (trigger bởi player khác) trước khi xử lý move của ta.
            // Nếu server báo vị trí chính là fromX/fromY của animation hiện tại
            // (tức là vị trí ta vừa rời) → bỏ qua, không tạo animation ngược.
            if (p.uid === currentUid && existing) {
                if (Math.round(toX) === Math.round(existing.fromX) &&
                    Math.round(toY) === Math.round(existing.fromY)) {
                    return; // stale state — đang animate được lên, không giật lại
                }
            }

            // Skip if target hasn't changed
            if (existing && existing.toX === toX && existing.toY === toY) return;

            // Current visual position (or snap to target if first time)
            const curVis = playerVis.current[p.uid];
            const fromX = curVis ? curVis.x : toX;
            const fromY = curVis ? curVis.y : toY;

            playerAnim.current[p.uid] = {
                fromX, fromY, toX, toY,
                startTime: performance.now(),
                duration: curVis ? MOVE_ANIM_MS : 0, // snap on first appearance
            };
        });

        // ── Camera: chỉ dùng server state để snap lần đầu + cập nhật minimap ──
        // targetCam được drive bởi doMove (client prediction) → camera không bị
        // giật do server state cũ xung đột với prediction đang chạy.
        const me = gameState.players[currentUid];
        if (me) {
            const halfCol = Math.floor(VP_COLS / 2);
            const halfRow = Math.floor(VP_ROWS / 2);
            const camCol = Math.max(0, Math.min(me.col - halfCol, MAP_W - VP_COLS));
            const camRow = Math.max(0, Math.min(me.row - halfRow, MAP_H - VP_ROWS));
            const camX = camCol * cs;
            const camY = camRow * cs;

            // Snap camera ngay lập tức lần đầu (không lerp từ góc 0,0)
            if (!camInitialized.current) {
                currentCam.current = { x: camX, y: camY };
                targetCam.current = { x: camX, y: camY };
                if (mapDivRef.current) {
                    mapDivRef.current.style.transform = `translate3d(${-camX}px, ${-camY}px, 0)`;
                }
                camInitialized.current = true;
            }

            // Minimap luôn theo server (accurate, không cần smooth)
            setMiniCam({ col: camCol, row: camRow });
        }
    }, [gameState, currentUid]);

    // ── Update player DOM refs when they mount/unmount ────────
    const setPlayerRef = useCallback((uid) => (el) => {
        if (el) {
            playerRefs.current[uid] = el;
            // Set initial position immediately on mount
            const vis = playerVis.current[uid];
            if (vis) {
                el.style.transform = `translate3d(${vis.x}px, ${vis.y}px, 0)`;
            }
        } else {
            delete playerRefs.current[uid];
        }
    }, []);

    // ── Socket: auto-reauth nếu F5 / trực tiếp vào URL ──────
    useEffect(() => {
        const onStart = ({ gameState: gs }) => { if (gs) setGameState(gs); };
        const onState = (gs) => setGameState(gs);
        const onOver = (data) => setGameOver(data);

        // Game đã xóa (disconnect rồi reconnect sau khi server cleanup)
        const onSyncErr = () => {
            navigate('/game-lobby', {
                replace: true,
                state: { toast: 'Game đã kết thúc. Bạn bị đưa về sảnh chờ.' }
            });
        };

        // Socket mất kết nối (network flicker, không phải F5)
        const onDisconnect = (reason) => {
            if (reason === 'io server disconnect') {
                navigate('/game-lobby', {
                    replace: true,
                    state: { toast: 'Bạn đã bị ngắt khỏi game.' }
                });
            } else {
                setConnState('reconnecting');
            }
        };

        // Reconnect thành công → sync lại
        const onReconnect = () => {
            setConnState('connected');
            socket.emit('game:sync', { roomId });
        };

        // Quá nhiều lần thất bại → về lobby
        let lostTimer = null;
        const onReconnectAttempt = (attempt) => {
            if (attempt >= 8) {
                setConnState('lost');
                lostTimer = setTimeout(() => {
                    navigate('/game-lobby', {
                        replace: true,
                        state: { toast: 'Mất kết nối quá lâu. Bạn bị xử thua.' }
                    });
                }, 3000);
            }
        };

        socket.on('game:start', onStart);
        socket.on('game:state', onState);
        socket.on('game:over', onOver);
        socket.on('game:sync_error', onSyncErr);
        socket.on('disconnect', onDisconnect);
        socket.on('connect', onReconnect);
        socket.io.on('reconnect_attempt', onReconnectAttempt);

        // ── Khởi động: kết nối lại nếu cần (F5 / direct URL) ─
        async function initAndSync() {
            if (!socket.connected) {
                try {
                    // Lấy lại auth token từ Firebase (user vẫn đang login)
                    const { auth: firebaseAuth } = await import('../../config/firebase');
                    const user = firebaseAuth.currentUser;
                    if (!user) {
                        navigate('/', { replace: true });
                        return;
                    }
                    setConnState('reconnecting');
                    const idToken = await user.getIdToken(true);

                    // Lấy fullName + avatar từ Firestore (AuthContext đã load sẵn)
                    // Import dynamic để tránh circular dependency
                    const { getDoc, doc } = await import('firebase/firestore');
                    const { db } = await import('../../config/firebase');
                    let fullName = '';
                    let photoURL = user.photoURL || '';
                    try {
                        const snap = await getDoc(doc(db, 'users', user.uid));
                        if (snap.exists()) {
                            fullName = snap.data().fullName || '';
                            photoURL = snap.data().avatar || photoURL;
                        }
                    } catch (_) { /* dùng fallback nếu lỗi */ }

                    socket.auth = { token: idToken, photoURL, fullName };
                    await new Promise((resolve, reject) => {
                        socket.once('connect', resolve);
                        socket.once('connect_error', reject);
                        socket.connect();
                    });
                    setConnState('connected');
                } catch (err) {
                    console.error('[BombGame] Reconnect failed:', err);
                    navigate('/game-lobby', {
                        replace: true,
                        state: { toast: 'Không thể kết nối server game.' }
                    });
                    return;
                }
            }
            socket.emit('game:sync', { roomId });
        }

        initAndSync();

        // ── Fallback: nếu 8s vẫn chưa có game state → về lobby ─
        const fallbackTimer = setTimeout(() => {
            setGameState(prev => {
                if (!prev) {
                    navigate('/game-lobby', {
                        replace: true,
                        state: { toast: 'Không tìm thấy game. Có thể game đã kết thúc.' }
                    });
                }
                return prev;
            });
        }, 8000);

        return () => {
            socket.off('game:start', onStart);
            socket.off('game:state', onState);
            socket.off('game:over', onOver);
            socket.off('game:sync_error', onSyncErr);
            socket.off('disconnect', onDisconnect);
            socket.off('connect', onReconnect);
            socket.io.off('reconnect_attempt', onReconnectAttempt);
            clearTimeout(fallbackTimer);
            if (lostTimer) clearTimeout(lostTimer);
        };
    }, [roomId, navigate]);

    // ── Keyboard ──────────────────────────────────────────────
    const handleMove = useCallback((dir) => movePlayer(roomId, dir), [roomId]);
    const handleBomb = useCallback(() => { playSound('placeBomb'); placeBomb(roomId); }, [roomId]);

    // Hàm thực hiện 1 bước di chuyển (dùng chung cho keydown ngay lập tức và interval repeat)
    const doMove = useCallback((d) => {
        // 1. Gửi lệnh lên server (authoritative)
        handleMove(d);

        // 2. Client-side prediction: animate NGAY, không chờ RTT server
        const gs = gameStateRef.current;
        const me = gs?.players[currentUid];
        if (me?.alive) {
            const deltas = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
            const [dr, dc] = deltas[d];
            const nRow = me.row + dr;
            const nCol = me.col + dc;
            const cell = gs.map?.[nRow]?.[nCol];

            // Chỉ predict nếu ô đích đi được (CELL_EMPTY = 0)
            // Và không có bom trên ô đích (mirror server logic)
            // Và không có nhân vật khác đang đứng trên ô đó
            const hasBomb = gs.bombs?.some(b => b.row === nRow && b.col === nCol);
            const hasPlayer = Object.values(gs.players || {}).some(
                p => p.alive && p.uid !== currentUid && p.row === nRow && p.col === nCol
            );

            if (cell === CELL_EMPTY && !hasBomb && !hasPlayer) {
                const cs = cellSizeRef.current;
                const toX = nCol * cs;
                const toY = nRow * cs;
                const curVis = playerVis.current[currentUid];
                const fromX = curVis ? curVis.x : toX;
                const fromY = curVis ? curVis.y : toY;
                playerAnim.current[currentUid] = {
                    fromX, fromY, toX, toY,
                    startTime: performance.now(),
                    duration: MOVE_ANIM_MS,
                };

                // Predict camera target ngay (không chờ server RTT)
                const halfCol = Math.floor(VP_COLS / 2);
                const halfRow = Math.floor(VP_ROWS / 2);
                const camCol = Math.max(0, Math.min(nCol - halfCol, MAP_W - VP_COLS));
                const camRow = Math.max(0, Math.min(nRow - halfRow, MAP_H - VP_ROWS));
                targetCam.current = { x: camCol * cs, y: camRow * cs };
            }
        }
    }, [handleMove, currentUid]);

    useEffect(() => {
        const KEY = {
            ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
            w: 'up', s: 'down', a: 'left', d: 'right',
        };

        const startRepeat = () => {
            clearInterval(moveInterv.current);
            moveInterv.current = setInterval(() => {
                for (const d of ['up', 'down', 'left', 'right']) {
                    if (!keysHeld.current.has(d)) continue;
                    doMove(d);
                    break;
                }
            }, MOVE_INTERVAL_MS);
        };

        const dn = (e) => {
            if (KEY[e.key]) {
                e.preventDefault();
                const dir = KEY[e.key];
                if (!keysHeld.current.has(dir)) {
                    keysHeld.current.add(dir);
                    // Fire ngay lập tức, rồi restart interval từ đây
                    // → interval tiếp theo luôn cách đúng MOVE_INTERVAL_MS
                    // → không bao giờ fire sớm hơn animation đang chạy
                    doMove(dir);
                    startRepeat();
                }
            }
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleBomb(); }
        };
        const up = (e) => { if (KEY[e.key]) keysHeld.current.delete(KEY[e.key]); };
        window.addEventListener('keydown', dn);
        window.addEventListener('keyup', up);
        startRepeat(); // khởi động interval ban đầu (phòng khi phím đang giữ trước khi mount)
        return () => {
            window.removeEventListener('keydown', dn);
            window.removeEventListener('keyup', up);
            clearInterval(moveInterv.current);
            // Cleanup tap-to-move RAF khi unmount
            tapActiveRef.current = false;
            if (tapRafRef.current) cancelAnimationFrame(tapRafRef.current);
        };
    }, [doMove, handleBomb]);

    const handleBack = useCallback(() => {
        // Nếu game đang diễn ra → emit game:leave để server xử lý thua/thắng
        // Nếu game đã kết thúc (gameOver) → chỉ emit room:leave (rời phòng bình thường)
        if (!gameOver) {
            leaveGame(roomId);
        } else {
            leaveRoom(roomId);
        }
        navigate('/game-lobby');
    }, [roomId, navigate, gameOver]);

    // ── Tap-to-Move: chạm vào viewport để di chuyển nhân vật ────
    // Dùng RAF loop + throttle timestamp để đảm bảo tốc độ đúng MOVE_INTERVAL_MS,
    // tránh lag và burst khi tap liên tục.

    // Hàm cương-convert tọa độ chạm → ô đích (dùng cả ba handler)
    const calcTapTarget = useCallback((touch) => {
        if (!viewportRef.current) return null;
        const rect = viewportRef.current.getBoundingClientRect();
        const cs = cellSizeRef.current;
        const relX = touch.clientX - rect.left + currentCam.current.x;
        const relY = touch.clientY - rect.top + currentCam.current.y;
        return {
            row: Math.max(0, Math.min(Math.floor(relY / cs), MAP_H - 1)),
            col: Math.max(0, Math.min(Math.floor(relX / cs), MAP_W - 1)),
        };
    }, []);

    // RAF loop: chạy khi tapActiveRef = true, thực hiện doMove() theo đúng nhịp MOVE_INTERVAL_MS
    const startTapRaf = useCallback(() => {
        if (tapRafRef.current) return; // đã đang chạy
        const loop = (now) => {
            if (!tapActiveRef.current) {
                tapRafRef.current = null;
                return;
            }
            const target = tapTarget.current;
            if (target) {
                const elapsed = now - tapLastMove.current;
                if (elapsed >= MOVE_INTERVAL_MS) {
                    const gs = gameStateRef.current;
                    const me = gs?.players[currentUid];
                    if (me?.alive) {
                        const dRow = target.row - me.row;
                        const dCol = target.col - me.col;
                        if (dRow !== 0 || dCol !== 0) {
                            let dir;
                            if (Math.abs(dRow) >= Math.abs(dCol)) {
                                dir = dRow > 0 ? 'down' : 'up';
                            } else {
                                dir = dCol > 0 ? 'right' : 'left';
                            }
                            doMove(dir);
                            tapLastMove.current = now;
                        }
                    }
                }
            }
            tapRafRef.current = requestAnimationFrame(loop);
        };
        tapRafRef.current = requestAnimationFrame(loop);
    }, [doMove, currentUid]);

    const stopTapRaf = useCallback(() => {
        tapActiveRef.current = false;
        if (tapRafRef.current) {
            cancelAnimationFrame(tapRafRef.current);
            tapRafRef.current = null;
        }
        tapTarget.current = null;
    }, []);

    const handleMapTouch = useCallback((e) => {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        if (!touch) return;
        const target = calcTapTarget(touch);
        if (!target) return;
        tapTarget.current = target;
        tapActiveRef.current = true;
        // Đặt tapLastMove = 0 để bước đầu tiên xảy ra ngay lập tức
        tapLastMove.current = 0;
        startTapRaf();
    }, [calcTapTarget, startTapRaf]);

    const handleMapTouchMove = useCallback((e) => {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        if (!touch) return;
        const target = calcTapTarget(touch);
        if (target) tapTarget.current = target;
    }, [calcTapTarget]);

    const handleMapTouchEnd = useCallback((e) => {
        if (e.cancelable) e.preventDefault();
        stopTapRaf();
    }, [stopTapRaf]);

    // ── Explosion lookup (dùng calculateExplosion client-side) ────────────
    // Tập hợp tất cả ô đang bị lửa, được tính lại từ dữ liệu server
    // (server đã gửi cells[], ta dùng luôn để tránh tính trùng)
    const explosionMap = useCallback(() => {
        // explosionMap(): { 'r,c' → 'center'|'horizontal'|'vertical'|'end-left'|'end-right'|'end-up'|'end-down' }
        const map = {};
        if (!gameState?.explosions?.length) return map;
        for (const exp of gameState.explosions) {
            if (!exp.cells?.length) continue;
            const center = exp.cells[0]; // ô tâm nổ luôn là phần tử đầu tiên

            // Gom nhóm 4 hướng từ tâm
            const arms = { left: [], right: [], up: [], down: [] };
            exp.cells.forEach((cell, idx) => {
                if (idx === 0) return; // bỏ qua tâm
                if (cell.row === center.row) {
                    if (cell.col < center.col) arms.left.push(cell);
                    else arms.right.push(cell);
                } else {
                    if (cell.row < center.row) arms.up.push(cell);
                    else arms.down.push(cell);
                }
            });

            // Tìm ô xa tâm nhất trong từng hướng → đó là End Cap
            const farthest = {
                left: arms.left.length ? arms.left.reduce((a, b) => b.col < a.col ? b : a) : null,
                right: arms.right.length ? arms.right.reduce((a, b) => b.col > a.col ? b : a) : null,
                up: arms.up.length ? arms.up.reduce((a, b) => b.row < a.row ? b : a) : null,
                down: arms.down.length ? arms.down.reduce((a, b) => b.row > a.row ? b : a) : null,
            };
            const endKeys = new Set(
                Object.values(farthest).filter(Boolean).map(c => `${c.row},${c.col}`)
            );

            // Gán type cho từng ô
            exp.cells.forEach((cell, idx) => {
                const key = `${cell.row},${cell.col}`;
                if (idx === 0) {
                    map[key] = 'center';
                } else if (endKeys.has(key)) {
                    // Xác định chiều của end cap
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
    }, [gameState]);

    const getExpType = useCallback((r, c) => {
        return explosionMap()[`${r},${c}`] || null;
    }, [explosionMap]);

    // ── Connection Lost Overlay ────────────────────────────────
    if (connState !== 'connected' && !gameOver) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center"
                style={{ background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)' }}>
                <div className="flex flex-col items-center gap-5 p-8 bg-gray-900/90 border border-white/10 rounded-2xl shadow-2xl text-center max-w-xs">
                    {connState === 'reconnecting' ? (
                        <>
                            <div className="relative w-14 h-14">
                                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30" />
                                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-400 animate-spin" />
                                <span className="absolute inset-0 flex items-center justify-center text-2xl">📡</span>
                            </div>
                            <div>
                                <p className="text-white font-bold text-lg">Đang kết nối lại...</p>
                                <p className="text-gray-400 text-sm mt-1">Vui lòng chờ, đừng đóng tab</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="text-5xl">❌</span>
                            <div>
                                <p className="text-red-400 font-bold text-lg">Mất kết nối</p>
                                <p className="text-gray-400 text-sm mt-1">Quá thời gian chờ — đang về sảnh chờ...</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── Loading ───────────────────────────────────────────────
    if (!gameState) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="text-5xl animate-bounce">💣</div>
                    <p className="text-white text-lg font-medium animate-pulse">Đang tải game...</p>
                </div>
            </div>
        );
    }

    const players = Object.values(gameState.players);
    const me = gameState.players[currentUid];
    const avatarSize = Math.max(16, cellSize * 0.8);
    const vpW = VP_COLS * cellSize;
    const vpH = VP_ROWS * cellSize;
    // Center offset: so avatar is centered within its cell
    const avatarOffset = (cellSize - avatarSize) / 2;

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col select-none overflow-hidden"
            style={{
                background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)',
                // Trên mobile: để chỗ cho D-Pad fixed 180px ở dưới
                touchAction: 'none',
            }}>

            {/* ══ HUD ══ */}
            <div className="bg-gray-900/95 border-b border-white/10 backdrop-blur-sm">

                {/* ── Hàng 1 (mobile): Players + đồng hồ ── */}
                <div className="flex items-center gap-1 px-2 pt-1.5 pb-1">
                    {/* Players pills — compact trên mobile, đầy đủ trên desktop */}
                    <div className="flex gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none">
                        {/* Desktop: pill đầy đủ */}
                        <div className="hidden md:flex gap-1 flex-wrap">
                            {players.map(p => (
                                <PlayerPill key={p.uid} player={p} isMe={p.uid === currentUid} compact={false} />
                            ))}
                        </div>
                        {/* Mobile: pill rút gọn */}
                        <div className="flex md:hidden gap-1">
                            {players.map(p => (
                                <PlayerPill key={p.uid} player={p} isMe={p.uid === currentUid} compact={true} />
                            ))}
                        </div>
                    </div>

                    {/* Đồng hồ đếm ngược */}
                    {countdown !== null && (
                        <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-lg font-mono font-bold text-xs border flex-shrink-0
                            ${countdown <= 30
                                ? 'text-red-400 border-red-500/40 bg-red-500/10 animate-pulse'
                                : countdown <= 60
                                    ? 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
                                    : 'text-white border-white/10 bg-white/5'}`}
                        >
                            ⏱ {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                        </div>
                    )}

                    {/* Minimap + nút — chỉ desktop ở hàng này */}
                    <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                        <MiniMap map={gameState.map} players={players}
                            currentUid={currentUid}
                            camCol={miniCam.col} camRow={miniCam.row} />
                        <button
                            onClick={() => { const muted = toggleMute(); setSoundMuted(muted); }}
                            title={soundMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                            className="text-lg w-8 h-8 rounded-lg flex items-center justify-center
                                bg-white/5 border border-white/10 active:scale-90 transition-transform"
                        >
                            {soundMuted ? '🔇' : '🔊'}
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="text-sm w-8 h-8 rounded-lg flex items-center justify-center
                                bg-white/5 border border-white/10 active:scale-90 transition-transform"
                        >
                            {isFullscreen ? '⛶' : '⛶'}
                        </button>
                        <button onClick={handleBack}
                            className="text-red-400/70 hover:text-red-400 text-xs px-2 h-8 rounded-lg border border-white/10
                                hover:border-red-500/40 transition-all flex items-center">
                            Thoát
                        </button>
                    </div>
                </div>

                {/* ── Hàng 2 (chỉ mobile): Minimap + nút âm thanh + fullscreen ── */}
                <div className="flex md:hidden items-center gap-1.5 px-2 pb-1.5">
                    <MiniMap map={gameState.map} players={players}
                        currentUid={currentUid}
                        camCol={miniCam.col} camRow={miniCam.row} />
                    <div className="flex-1" />
                    <button
                        onClick={() => { const muted = toggleMute(); setSoundMuted(muted); }}
                        className="text-base w-8 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                            bg-white/5 border border-white/10 active:scale-90 transition-transform"
                    >
                        {soundMuted ? '🔇' : '🔊'}
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="text-xs w-8 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                            bg-white/5 border border-white/10 active:scale-90 transition-transform"
                    >
                        {isFullscreen ? '⛶' : '🔲'}
                    </button>
                </div>

            </div>

            {/* ── Game Viewport ── */}
            {/* paddingBottom trên mobile = DPAD_H để bản đồ không bị D-pad che */}
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-2"
                style={{ paddingBottom: `max(${DPAD_H}px, calc(${DPAD_H}px + env(safe-area-inset-bottom)))` }}
            >
                <div
                    ref={viewportRef}
                    className="relative rounded-xl border border-white/10"
                    onTouchStart={handleMapTouch}
                    onTouchMove={handleMapTouchMove}
                    onTouchEnd={handleMapTouchEnd}
                    onTouchCancel={handleMapTouchEnd}
                    style={{
                        width: vpW, height: vpH,
                        overflow: 'hidden',
                        touchAction: 'none',
                        boxShadow: '0 0 40px rgba(99,102,241,.15), 0 25px 50px -12px rgba(0,0,0,.8)',
                    }}
                >
                    {/* ── Full map div (moved by camera via RAF) ── */}
                    <div
                        ref={mapDivRef}
                        style={{
                            position: 'absolute',
                            width: MAP_W * cellSize,
                            height: MAP_H * cellSize,
                            willChange: 'transform',
                        }}
                    >
                        {/* Layer 1: Tiles (map, blocks, walls, bombs, explosions) */}
                        {gameState.map.map((rowArr, r) =>
                            rowArr.map((tile, c) => {
                                const expType = getExpType(r, c);
                                const bombHere = gameState.bombs?.some(b => b.row === r && b.col === c);

                                // ── Nền tile: dùng SVG cho floor/wall/block ──
                                let bg;
                                if (tile === CELL_WALL) bg = svgUrl(SVG.wall);
                                else if (tile === CELL_BLOCK) bg = svgUrl(SVG.block);
                                else bg = svgUrl(SVG.floor);

                                // ── Màu nổ (fill block) để debug ──
                                // Sẽ render overlay riêng bên dưới

                                return (
                                    <div key={`${r}-${c}`} style={{
                                        position: 'absolute',
                                        left: c * cellSize, top: r * cellSize,
                                        width: cellSize, height: cellSize,
                                        backgroundImage: bg, backgroundSize: 'cover',
                                    }}>
                                        {/* Bomb SVG */}
                                        {bombHere && !expType && (
                                            <div style={{
                                                position: 'absolute', inset: 0,
                                                backgroundImage: svgUrl(SVG.bomb),
                                                backgroundSize: '75%',
                                                backgroundRepeat: 'no-repeat',
                                                backgroundPosition: 'center',
                                            }} />
                                        )}
                                        {/* ── Explosion SVG overlay ── */}
                                        {expType && (() => {
                                            const svgMap = {
                                                'center': SVG.explosionCenter,
                                                'horizontal': SVG.explosionH,
                                                'vertical': SVG.explosionV,
                                                'end-left': SVG.explosionEndL,
                                                'end-right': SVG.explosionEndR,
                                                'end-up': SVG.explosionEndU,
                                                'end-down': SVG.explosionEndD,
                                            };
                                            const svg = svgMap[expType];
                                            if (!svg) return null;
                                            return (
                                                <div style={{
                                                    position: 'absolute',
                                                    inset: '-1px',
                                                    backgroundImage: svgUrl(svg),
                                                    backgroundSize: '100% 100%',
                                                    backgroundRepeat: 'no-repeat',
                                                    backgroundPosition: 'center',
                                                    zIndex: 5,
                                                    imageRendering: 'pixelated',
                                                    animation: 'flameThrob 0.15s steps(2, end) infinite alternate',
                                                }} />
                                            );
                                        })()}
                                    </div>
                                );
                            })
                        )}

                        {/* Layer 1.5: Debris — mảnh vụn gạch tan vỡ */}
                        {debrisList.map(({ id, row, col }) => (
                            <div key={id} style={{
                                position: 'absolute',
                                left: col * cellSize,
                                top: row * cellSize,
                                width: cellSize,
                                height: cellSize,
                                backgroundImage: svgUrl(SVG.blockDebris),
                                backgroundSize: '100% 100%',
                                backgroundRepeat: 'no-repeat',
                                zIndex: 4,
                                pointerEvents: 'none',
                                animation: 'shatter 0.4s ease-out forwards',
                            }} />
                        ))}

                        {/* Layer 1.6: Items — vật phẩm ẩn trong block */}
                        {(gameState.items || []).map(item => {
                            const svgKey = item.type === 'life' ? 'itemLife'
                                : item.type === 'range' ? 'itemRange' : 'itemBomb';
                            return (
                                <div key={item.id} style={{
                                    position: 'absolute',
                                    left: item.col * cellSize,
                                    top: item.row * cellSize,
                                    width: cellSize, height: cellSize,
                                    backgroundImage: svgUrl(SVG[svgKey]),
                                    backgroundSize: '70%',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    zIndex: 3,
                                    pointerEvents: 'none',
                                    animation: 'itemFloat 1.4s ease-in-out infinite alternate',
                                }} />
                            );
                        })}

                        {/* Layer 2: Players — each absolutely at (0,0), moved by RAF translate3d */}
                        {players.map(p => {
                            if (!p.alive) return null;
                            const isFlashing = !!(hitFlash[p.uid] && hitFlash[p.uid] > Date.now());
                            return (
                                <div
                                    key={p.uid}
                                    ref={setPlayerRef(p.uid)}
                                    style={{
                                        position: 'absolute',
                                        top: avatarOffset,
                                        left: avatarOffset,
                                        width: avatarSize,
                                        height: avatarSize,
                                        willChange: 'transform',
                                        zIndex: 10,
                                        transform: `translate3d(${p.col * cellSize}px, ${p.row * cellSize}px, 0)`,
                                        // Hit flash: viền đỏ + rung
                                        outline: isFlashing ? '3px solid #ef4444' : 'none',
                                        borderRadius: '50%',
                                        animation: isFlashing ? 'hitShake 0.15s ease-in-out 4' : 'none',
                                        filter: isFlashing ? 'brightness(1.8) saturate(0.3)' : 'none',
                                    }}
                                >
                                    <PlayerAvatar
                                        player={p}
                                        size={avatarSize}
                                        isMe={p.uid === currentUid}
                                    />
                                    {/* Name tag — ẩn/hiện qua showNames */}
                                    {showNames && (
                                        <div style={{
                                            position: 'absolute',
                                            top: avatarSize + 2,
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: p.uid === currentUid ? 'rgba(99,102,241,.85)' : 'rgba(0,0,0,.75)',
                                            color: 'white',
                                            fontSize: Math.max(8, cellSize * 0.22),
                                            padding: '1px 5px',
                                            borderRadius: 4,
                                            whiteSpace: 'nowrap',
                                            pointerEvents: 'none',
                                            border: p.uid === currentUid ? '1px solid rgba(165,180,252,.5)' : 'none',
                                        }}>
                                            {p.name}{p.uid === currentUid ? ' ★' : ''}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    </div>

                    {/* ── Overlays ── */}
                    {gameOver && (
                        <GameOverOverlay
                            winner={gameOver.winner}
                            winnerName={gameOver.winnerName}
                            reward={gameOver.reward}
                            reason={gameOver.reason}
                            refundedUids={gameOver.refundedUids ?? []}
                            currentUid={currentUid}
                            onBack={handleBack}
                        />
                    )}


                    {me && !me.alive && !gameOver && (
                        <div className="absolute inset-0 flex items-start justify-center z-20 pointer-events-none"
                            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'grayscale(70%) brightness(0.75)' }}>
                            <div className="mt-6 text-center bg-black/70 px-4 py-2 rounded-xl border border-white/10">
                                <p className="text-3xl mb-1">💀</p>
                                <p className="text-white text-sm font-bold">Đã bị loại!</p>
                                <p className="text-gray-400 text-xs">Spectator mode...</p>
                            </div>
                        </div>
                    )}

                    {/* Edge vignette */}
                    {miniCam.col > 0 && (
                        <div className="absolute inset-y-0 left-0 w-5 pointer-events-none z-10"
                            style={{ background: 'linear-gradient(to right, rgba(0,0,0,.4), transparent)' }} />
                    )}
                    {miniCam.col < MAP_W - VP_COLS && (
                        <div className="absolute inset-y-0 right-0 w-5 pointer-events-none z-10"
                            style={{ background: 'linear-gradient(to left, rgba(0,0,0,.4), transparent)' }} />
                    )}
                </div>

                {/* ── Mobile D-Pad: fixed overlay góc dưới ── */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-20
                    flex items-end justify-between px-4 pb-4 pt-2
                    bg-gradient-to-t from-black/70 to-transparent"
                    style={{ pointerEvents: 'none' }}
                >
                    {/* D-Pad trái */}
                    <div className="relative flex-shrink-0" style={{ width: 160, height: 160, pointerEvents: 'auto' }}>
                        {[
                            { dir: 'up', top: 0, left: 55, label: '▲' },
                            { dir: 'left', top: 55, left: 0, label: '◀' },
                            { dir: 'right', top: 55, left: 110, label: '▶' },
                            { dir: 'down', top: 110, left: 55, label: '▼' },
                        ].map(({ dir, top, left, label }) => (
                            <button key={dir}
                                onTouchStart={(e) => {
                                    e.preventDefault();
                                    // Dừng interval touch cũ (phòng trượt ngón từ nút này sang nút khác)
                                    clearInterval(touchInterv.current);
                                    // Fire ngay lập tức
                                    doMove(dir);
                                    // Repeat khi giữ ngón tay — dùng touchInterv (không đụng keyboard interval)
                                    touchInterv.current = setInterval(() => doMove(dir), MOVE_INTERVAL_MS);
                                }}
                                onTouchEnd={(e) => {
                                    e.preventDefault();
                                    clearInterval(touchInterv.current);
                                }}
                                onTouchCancel={(e) => {
                                    e.preventDefault();
                                    clearInterval(touchInterv.current);
                                }}
                                style={{
                                    position: 'absolute', top, left,
                                    width: 50, height: 50,
                                    // Loại bỏ delay tap mặc định của mobile browser
                                    touchAction: 'none',
                                }}
                                className="rounded-2xl bg-gray-800/85 active:bg-indigo-600
                                    border-2 border-white/20 active:border-indigo-400
                                    flex items-center justify-center text-white text-xl font-bold
                                    shadow-xl active:scale-90 transition-all"
                            >{label}</button>
                        ))}
                        {/* Centro do D-Pad */}
                        <div className="absolute rounded-xl bg-gray-900/60 border border-white/10"
                            style={{ top: 60, left: 60, width: 40, height: 40 }} />
                    </div>

                    {/* Nút giữa: thoát trên mobile */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0" style={{ pointerEvents: 'auto' }}>
                        <button onClick={toggleFullscreen}
                            className="w-10 h-10 rounded-xl bg-gray-800/70 border border-white/15
                                flex items-center justify-center text-white/70 text-lg
                                active:scale-90 transition-transform shadow-lg">
                            {isFullscreen ? '⛶' : '🔲'}
                        </button>
                        <button onClick={handleBack}
                            className="w-10 h-10 rounded-xl bg-red-900/50 border border-red-500/30
                                flex items-center justify-center text-red-400 text-sm font-bold
                                active:scale-90 transition-transform shadow-lg">
                            ✕
                        </button>
                    </div>

                    {/* Nút bom phải */}
                    <div className="flex-shrink-0" style={{ pointerEvents: 'auto' }}>
                        <button
                            onTouchStart={(e) => { e.preventDefault(); handleBomb(); }}
                            className="w-20 h-20 rounded-full active:scale-85 transition-transform
                                flex items-center justify-center shadow-2xl text-4xl select-none"
                            style={{
                                background: 'radial-gradient(circle at 35% 35%, #fb923c, #dc2626 60%, #7f1d1d)',
                                border: '3px solid rgba(255,200,100,.35)',
                                boxShadow: '0 0 30px rgba(239,68,68,.6), 0 8px 24px rgba(0,0,0,.6)',
                            }}
                        >💣</button>
                        <p className="text-white/40 text-[10px] text-center mt-1">BOM</p>
                    </div>
                </div>

                <p className="text-gray-700 text-xs hidden md:block tracking-wide pb-2">
                    WASD · ↑↓←→ di chuyển &nbsp;·&nbsp; Space / Enter đặt bom
                </p>
                <p className="text-gray-700/60 text-[10px] md:hidden tracking-wide pb-1 text-center">
                    Chạm bản đồ để di chuyển · D-Pad hoặc chạm vào ô đích
                </p>
            </div>
        </div>
    );
}

export default BombGame;
