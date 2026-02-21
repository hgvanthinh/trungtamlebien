// src/pages/public/BombGame.jsx
import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket, movePlayer, placeBomb, leaveRoom } from '../../services/api/socket';
import { auth } from '../../config/firebase';

// ─── Constants ─────────────────────────────────────────────────
const MAP_W = 29;
const MAP_H = 13;
const VP_COLS = 15;
const VP_ROWS = 13;
const CAM_LERP = 0.10;   // camera smoothness
const MOVE_ANIM_MS = 118;    // player move animation duration (< server 130ms cooldown)

const CELL_EMPTY = 0, CELL_WALL = 1, CELL_BLOCK = 2;

// ─── Easing ────────────────────────────────────────────────────
/** easeOutQuad: starts fast, decelerates smoothly to destination */
function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

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
    explosionCenter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#f97316" opacity=".9"/>
      <circle cx="16" cy="16" r="9" fill="#fbbf24"/>
      <circle cx="16" cy="16" r="5" fill="#fef9c3"/>
      <circle cx="16" cy="16" r="2" fill="white"/>
      <polygon points="16,1 18,10 14,10" fill="#ef4444" opacity=".8"/>
      <polygon points="16,31 18,22 14,22" fill="#ef4444" opacity=".8"/>
      <polygon points="1,16 10,18 10,14" fill="#ef4444" opacity=".8"/>
      <polygon points="31,16 22,18 22,14" fill="#ef4444" opacity=".8"/>
    </svg>`,
    explosionH: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="0" y="11" width="32" height="10" fill="#f97316" opacity=".85" rx="2"/>
      <rect x="0" y="13" width="32" height="6" fill="#fbbf24" rx="1"/>
      <rect x="0" y="14.5" width="32" height="3" fill="#fef9c3" rx="1"/>
    </svg>`,
    explosionV: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="11" y="0" width="10" height="32" fill="#f97316" opacity=".85" rx="2"/>
      <rect x="13" y="0" width="6" height="32" fill="#fbbf24" rx="1"/>
      <rect x="14.5" y="0" width="3" height="32" fill="#fef9c3" rx="1"/>
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
function PlayerPill({ player, isMe }) {
    const [err, setErr] = useState(false);
    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border
            ${player.alive ? 'bg-white/5 border-white/10' : 'opacity-40 bg-white/2 border-white/5'}`}>
            <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border border-white/30"
                style={{ backgroundColor: player.color }}>
                {player.photoURL && !err ? (
                    <img src={player.photoURL} alt="" onError={() => setErr(true)}
                        className="w-full h-full object-cover" draggable={false} />
                ) : (
                    <span className="text-white text-xs font-bold flex items-center justify-center h-full">
                        {player.name?.[0]?.toUpperCase()}
                    </span>
                )}
            </div>
            <span className={`text-xs font-medium truncate max-w-[70px] ${player.alive ? 'text-white' : 'text-gray-600 line-through'}`}>
                {player.name}{isMe ? ' ★' : ''}
            </span>
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
function GameOverOverlay({ winner, winnerName, currentUid, onBack }) {
    const isWinner = winner === currentUid;
    return (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="flex flex-col items-center gap-5 p-8 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl text-center">
                <span className="text-6xl">{winner ? (isWinner ? '🏆' : '💀') : '🤝'}</span>
                {winner ? (
                    <div>
                        <p className="text-white font-bold text-2xl">{isWinner ? 'Bạn thắng!' : 'Bạn thua!'}</p>
                        <p className="text-gray-400 text-sm mt-1">
                            {isWinner ? '+100 Xu đã được cộng' : `${winnerName} thắng`}
                        </p>
                    </div>
                ) : (
                    <p className="text-white font-bold text-2xl">Hòa!</p>
                )}
                <button onClick={onBack}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all active:scale-95">
                    Về sảnh chờ
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
    const moveInterv = useRef(null);

    // ── Cell size (based on VP_COLS, not MAP_W) ───────────────
    useEffect(() => {
        const calc = () => {
            const s = Math.max(20, Math.min(44,
                Math.floor((window.innerWidth - 16) / VP_COLS),
                Math.floor((window.innerHeight - 60 - 170) / VP_ROWS)
            ));
            setCellSize(s);
            cellSizeRef.current = s;
        };
        calc();
        window.addEventListener('resize', calc);
        return () => window.removeEventListener('resize', calc);
    }, []);

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
                const e = easeOutQuad(t);
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

        // Update camera target (follow current player)
        const me = gameState.players[currentUid];
        if (me) {
            const halfCol = Math.floor(VP_COLS / 2);
            const halfRow = Math.floor(VP_ROWS / 2);
            const camCol = Math.max(0, Math.min(me.col - halfCol, MAP_W - VP_COLS));
            const camRow = Math.max(0, Math.min(me.row - halfRow, MAP_H - VP_ROWS));
            targetCam.current = { x: camCol * cs, y: camRow * cs };
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
    const handleBomb = useCallback(() => placeBomb(roomId), [roomId]);

    useEffect(() => {
        const KEY = {
            ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
            w: 'up', s: 'down', a: 'left', d: 'right',
        };
        const dn = (e) => {
            if (KEY[e.key]) { e.preventDefault(); keysHeld.current.add(KEY[e.key]); }
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleBomb(); }
        };
        const up = (e) => { if (KEY[e.key]) keysHeld.current.delete(KEY[e.key]); };
        window.addEventListener('keydown', dn);
        window.addEventListener('keyup', up);
        moveInterv.current = setInterval(() => {
            for (const d of ['up', 'down', 'left', 'right']) {
                if (keysHeld.current.has(d)) { handleMove(d); break; }
            }
        }, 130);
        return () => {
            window.removeEventListener('keydown', dn);
            window.removeEventListener('keyup', up);
            clearInterval(moveInterv.current);
        };
    }, [handleMove, handleBomb]);

    const handleBack = useCallback(() => {
        leaveRoom(roomId);
        navigate('/game-lobby');
    }, [roomId, navigate]);

    // ── Explosion type ────────────────────────────────────────
    const getExpType = useCallback((r, c) => {
        if (!gameState?.explosions?.length) return null;
        for (const exp of gameState.explosions) {
            const idx = exp.cells?.findIndex(cell => cell.row === r && cell.col === c);
            if (idx === undefined || idx === -1) continue;
            if (idx === 0) return 'center';
            return exp.cells[idx].row === exp.cells[0].row ? 'h' : 'v';
        }
        return null;
    }, [gameState]);

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
            style={{ background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)' }}>

            {/* ── HUD ── */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/90 border-b border-white/10 backdrop-blur-sm flex-wrap">
                <span className="text-xl">💣</span>
                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                    {players.map(p => (
                        <PlayerPill key={p.uid} player={p} isMe={p.uid === currentUid} />
                    ))}
                </div>
                <MiniMap map={gameState.map} players={players}
                    currentUid={currentUid}
                    camCol={miniCam.col} camRow={miniCam.row} />
                <button
                    onClick={() => setShowNames(v => !v)}
                    title={showNames ? 'Ẩn tên nhân vật' : 'Hiện tên nhân vật'}
                    className={`text-xs px-2 py-1 rounded border transition-all flex-shrink-0
                        ${showNames
                            ? 'text-indigo-300 border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20'
                            : 'text-gray-500 border-white/10 hover:text-gray-300'}`}
                >
                    {showNames ? '🏷️ Tên' : '🚫 Tên'}
                </button>
                <button onClick={handleBack}
                    className="text-gray-500 hover:text-red-400 text-xs px-2 py-1 rounded border border-white/10 hover:border-red-500/40 transition-all flex-shrink-0">
                    Thoát
                </button>
            </div>

            {/* ── Game Viewport ── */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-2">
                <div
                    className="relative rounded-xl border border-white/10"
                    style={{
                        width: vpW, height: vpH,
                        overflow: 'hidden',
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

                                let bg;
                                if (expType === 'center') bg = svgUrl(SVG.explosionCenter);
                                else if (expType === 'h') bg = svgUrl(SVG.explosionH);
                                else if (expType === 'v') bg = svgUrl(SVG.explosionV);
                                else if (tile === CELL_WALL) bg = svgUrl(SVG.wall);
                                else if (tile === CELL_BLOCK) bg = svgUrl(SVG.block);
                                else bg = svgUrl(SVG.floor);

                                return (
                                    <div key={`${r}-${c}`} style={{
                                        position: 'absolute',
                                        left: c * cellSize, top: r * cellSize,
                                        width: cellSize, height: cellSize,
                                        backgroundImage: bg, backgroundSize: 'cover',
                                    }}>
                                        {bombHere && !expType && (
                                            <div style={{
                                                position: 'absolute', inset: 0,
                                                backgroundImage: svgUrl(SVG.bomb),
                                                backgroundSize: '75%',
                                                backgroundRepeat: 'no-repeat',
                                                backgroundPosition: 'center',
                                            }} />
                                        )}
                                    </div>
                                );
                            })
                        )}

                        {/* Layer 2: Players — each absolutely at (0,0), moved by RAF translate3d */}
                        {players.map(p => !p.alive ? null : (
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
                                    // Initial transform — RAF will take over
                                    transform: `translate3d(${p.col * cellSize}px, ${p.row * cellSize}px, 0)`,
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
                        ))}
                    </div>

                    {/* ── Overlays ── */}
                    {gameOver && (
                        <GameOverOverlay winner={gameOver.winner} winnerName={gameOver.winnerName}
                            currentUid={currentUid} onBack={handleBack} />
                    )}
                    {me && !me.alive && !gameOver && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 pointer-events-none">
                            <div className="text-center">
                                <p className="text-5xl mb-2">💀</p>
                                <p className="text-white text-lg font-bold">Bạn đã bị loại!</p>
                                <p className="text-gray-400 text-sm">Đang chờ kết quả...</p>
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

                {/* ── Mobile D-Pad ── */}
                <div className="flex items-center gap-5 pb-1 md:hidden">
                    <div className="relative" style={{ width: 116, height: 116 }}>
                        {[
                            { dir: 'up', pos: { top: 0, left: '50%', transform: 'translateX(-50%)' }, label: '▲' },
                            { dir: 'left', pos: { left: 0, top: '50%', transform: 'translateY(-50%)' }, label: '◀' },
                            { dir: 'right', pos: { right: 0, top: '50%', transform: 'translateY(-50%)' }, label: '▶' },
                            { dir: 'down', pos: { bottom: 0, left: '50%', transform: 'translateX(-50%)' }, label: '▼' },
                        ].map(({ dir, pos, label }) => (
                            <button key={dir}
                                onTouchStart={(e) => { e.preventDefault(); handleMove(dir); }}
                                className="absolute w-10 h-10 rounded-xl bg-gray-800/90 active:bg-indigo-600 border border-white/15
                                    flex items-center justify-center text-white text-base shadow-lg active:scale-95 transition-transform"
                                style={pos}
                            >{label}</button>
                        ))}
                        <div className="absolute w-10 h-10 rounded-xl bg-gray-900 border border-white/10"
                            style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                    </div>
                    <button
                        onTouchStart={(e) => { e.preventDefault(); handleBomb(); }}
                        className="w-16 h-16 rounded-full active:scale-90 transition-transform flex items-center justify-center shadow-2xl text-3xl"
                        style={{
                            background: 'radial-gradient(circle at 35% 35%, #f97316, #dc2626)',
                            border: '2px solid rgba(255,255,255,.25)',
                            boxShadow: '0 4px 20px rgba(239,68,68,.5)',
                        }}
                    >💣</button>
                </div>

                <p className="text-gray-700 text-xs hidden md:block tracking-wide">
                    WASD · ↑↓←→ di chuyển &nbsp;·&nbsp; Space / Enter đặt bom
                </p>
            </div>
        </div>
    );
}

export default BombGame;
