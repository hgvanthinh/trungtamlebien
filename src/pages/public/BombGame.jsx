// src/pages/public/BombGame.jsx
// ─── Main BombGame component — refactored, imports from ./BombGame/ ────────────
import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { socket, movePlayer, placeBomb, leaveRoom, leaveGame, spectateTournamentMatch, unspectateTournamentMatch, sendTournamentEmoji } from '../../services/api/socket';
import SpectatorOverlayComponent from '../../components/game/SpectatorOverlay';
import { auth } from '../../config/firebase';
import { playSound, toggleMute, isMuted, playBGM, stopBGM } from '../../utils/audioManager';

// Modules tách ra
import {
    MAP_W, MAP_H, VP_COLS, VP_ROWS,
    MOVE_INTERVAL_MS, MOVE_ANIM_MS,
    CELL_EMPTY, CELL_BLOCK,
    CAM_LERP, DPAD_H, HUD_H_MOBILE, HUD_H_DESKTOP
} from './BombGame/constants';
import { SVG, svgUrl } from './BombGame/svgAssets';
import { linear, buildExplosionMap } from './BombGame/gameLogic';
import { PlayerAvatar, PlayerPill, MiniMap, GameOverOverlay } from './BombGame/components';

export function BombGame() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const currentUid = auth.currentUser?.uid;

    const gameMode = location.state?.mode ?? 'loanDau';
    const tournamentId = location.state?.tournamentId ?? null;
    const isDauCap = gameMode === 'dauCap';

    const [gameState, setGameState] = useState(null);
    const [gameOver, setGameOver] = useState(null);
    const [isSpectating, setIsSpectating] = useState(false);
    const [spectatorMatchId, setSpectatorMatchId] = useState(null);
    const [tournamentState, setTournamentState] = useState(null);
    const [floatingEmojis, setFloatingEmojis] = useState([]);
    const isSpectatingRef = useRef(false);

    const addFloatingEmoji = useCallback((emoji, fromName = '') => {
        const id = `em_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const x = window.innerWidth * 0.3 + Math.random() * window.innerWidth * 0.4;
        setFloatingEmojis(prev => [...prev, { id, emoji, fromName, x }]);
    }, []);
    const removeFloatingEmoji = useCallback((id) => {
        setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, []);

    const [showNames, setShowNames] = useState(false);
    const [connState, setConnState] = useState('connected');
    const [cellSize, setCellSize] = useState(34);
    const [miniCam, setMiniCam] = useState({ col: 0, row: 0 });
    const [debrisList, setDebrisList] = useState([]);
    const [soundMuted, setSoundMuted] = useState(isMuted);
    const [hitFlash, setHitFlash] = useState({});
    const [countdown, setCountdown] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // ── Auto fullscreen trên mobile ──
    useEffect(() => {
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
            || window.matchMedia('(max-width: 768px)').matches;
        const el = document.documentElement;

        const requestFS = () => {
            if (el.requestFullscreen) el.requestFullscreen();
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        };

        if (isMobile) {
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
        playBGM();
        const handleFirstInteraction = () => { playBGM(); };
        window.addEventListener('click', handleFirstInteraction, { once: true });
        window.addEventListener('keydown', handleFirstInteraction, { once: true });
        return () => {
            stopBGM();
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
        };
    }, []);

    // ── Refs (RAF-managed, no React state) ──
    const cellSizeRef = useRef(34);
    const mapDivRef = useRef(null);
    const playerLayer = useRef(null);
    const targetCam = useRef({ x: 0, y: 0 });
    const currentCam = useRef({ x: 0, y: 0 });
    const rafRef = useRef(null);
    const playerAnim = useRef({});
    const playerVis = useRef({});
    const playerRefs = useRef({});

    const keysHeld = useRef(new Set());
    const moveInterv = useRef(null);
    const touchInterv = useRef(null);
    const tapTarget = useRef(null);
    const tapActiveRef = useRef(false);
    const tapRafRef = useRef(null);
    const tapLastMove = useRef(0);
    const viewportRef = useRef(null);
    const prevMapRef = useRef(null);
    const gameStateRef = useRef(null);
    const camInitialized = useRef(false);
    const prevLivesRef = useRef({});

    // ── Cell size ──
    useEffect(() => {
        const calc = () => {
            const isMobile = window.innerWidth < 768;
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

    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    // ── Countdown ──
    useEffect(() => {
        if (!gameState?.timeRemaining) return;
        setCountdown(Math.ceil(gameState.timeRemaining / 1000));
        const iv = setInterval(() => {
            setCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
        }, 1000);
        return () => clearInterval(iv);
    }, [gameState?.timeRemaining]);

    // ── Hit flash ──
    useEffect(() => {
        if (!gameState?.players) return;
        const newFlashes = {};
        for (const [uid, p] of Object.entries(gameState.players)) {
            const prev = prevLivesRef.current[uid];
            if (prev !== undefined && p.lives < prev) {
                newFlashes[uid] = Date.now() + 600;
            }
            prevLivesRef.current[uid] = p.lives;
        }
        if (Object.keys(newFlashes).length > 0) {
            setHitFlash(prev => ({ ...prev, ...newFlashes }));
        }
    }, [gameState?.players]);

    // ── Phát tiếng nổ ──
    const prevExplosionIds = useRef(new Set());
    useEffect(() => {
        const currentExplosions = gameState?.explosions ?? [];
        const currentIds = new Set(currentExplosions.map(e => e.bombId ?? e.id));
        let hasNew = false;
        for (const id of currentIds) {
            if (!prevExplosionIds.current.has(id)) { hasNew = true; break; }
        }
        if (hasNew) playSound('explosion');
        prevExplosionIds.current = currentIds;
    }, [gameState?.explosions]);

    // ── Debris system ──
    useEffect(() => {
        const cur = gameState?.map;
        const prev = prevMapRef.current;
        if (cur && prev) {
            const newDebris = [];
            for (let r = 0; r < cur.length; r++) {
                for (let c = 0; c < cur[r].length; c++) {
                    if (prev[r]?.[c] === CELL_BLOCK && cur[r][c] === CELL_EMPTY) {
                        newDebris.push({ id: `debris_${Date.now()}_${r}_${c}`, row: r, col: c });
                    }
                }
            }
            if (newDebris.length > 0) {
                setDebrisList(prev => [...prev, ...newDebris]);
                setTimeout(() => {
                    const ids = new Set(newDebris.map(d => d.id));
                    setDebrisList(prev => prev.filter(d => !ids.has(d.id)));
                }, 420);
            }
        }
        prevMapRef.current = cur ?? null;
    }, [gameState?.map]);

    // ── Master RAF loop ──
    useEffect(() => {
        function tick() {
            const now = performance.now();
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
            for (const [uid, anim] of Object.entries(playerAnim.current)) {
                const t = Math.min(1, (now - anim.startTime) / anim.duration);
                const e = linear(t);
                const x = anim.fromX + (anim.toX - anim.fromX) * e;
                const y = anim.fromY + (anim.toY - anim.fromY) * e;
                playerVis.current[uid] = { x, y };
                const el = playerRefs.current[uid];
                if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
            rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    // ── Update animation targets ──
    useEffect(() => {
        if (!gameState) return;
        const cs = cellSizeRef.current;

        Object.values(gameState.players).forEach(p => {
            const toX = p.col * cs;
            const toY = p.row * cs;
            const existing = playerAnim.current[p.uid];

            if (p.uid === currentUid && existing) {
                if (Math.round(toX) === Math.round(existing.fromX) &&
                    Math.round(toY) === Math.round(existing.fromY)) return;
            }
            if (existing && existing.toX === toX && existing.toY === toY) return;

            const curVis = playerVis.current[p.uid];
            const fromX = curVis ? curVis.x : toX;
            const fromY = curVis ? curVis.y : toY;

            playerAnim.current[p.uid] = {
                fromX, fromY, toX, toY,
                startTime: performance.now(),
                duration: curVis ? MOVE_ANIM_MS : 0,
            };
        });

        const me = gameState.players[currentUid];
        if (me) {
            const halfCol = Math.floor(VP_COLS / 2);
            const halfRow = Math.floor(VP_ROWS / 2);
            const camCol = Math.max(0, Math.min(me.col - halfCol, MAP_W - VP_COLS));
            const camRow = Math.max(0, Math.min(me.row - halfRow, MAP_H - VP_ROWS));
            const camX = camCol * cs;
            const camY = camRow * cs;

            if (!camInitialized.current) {
                currentCam.current = { x: camX, y: camY };
                targetCam.current = { x: camX, y: camY };
                if (mapDivRef.current) {
                    mapDivRef.current.style.transform = `translate3d(${-camX}px, ${-camY}px, 0)`;
                }
                camInitialized.current = true;
            }
            setMiniCam({ col: camCol, row: camRow });
        }
    }, [gameState, currentUid]);

    const setPlayerRef = useCallback((uid) => (el) => {
        if (el) {
            playerRefs.current[uid] = el;
            const vis = playerVis.current[uid];
            if (vis) el.style.transform = `translate3d(${vis.x}px, ${vis.y}px, 0)`;
        } else {
            delete playerRefs.current[uid];
        }
    }, []);

    // ── Socket handlers ──
    useEffect(() => {
        const onStart = ({ gameState: gs }) => { if (gs) setGameState(gs); };
        const onState = (gs) => setGameState(gs);
        const onOver = (data) => {
            setGameOver(data);
            if (isDauCap && tournamentId && data.winner !== currentUid) {
                setIsSpectating(true);
                isSpectatingRef.current = true;
            }
        };
        const onSpectateJoined = ({ gameState: gs }) => { if (gs) setGameState(gs); };
        const onTournamentUpdated = (t) => setTournamentState(t);
        const onTournamentJoined = (t) => setTournamentState(t);
        const onEmojiBC = ({ emoji, fromName }) => { if (addFloatingEmoji) addFloatingEmoji(emoji, fromName); };
        const onSyncErr = () => navigate('/game-lobby', { replace: true, state: { toast: 'Game đã kết thúc. Bạn bị đưa về sảnh chờ.' } });
        const onDisconnect = (reason) => {
            if (reason === 'io server disconnect') {
                navigate('/game-lobby', { replace: true, state: { toast: 'Bạn đã bị ngắt khỏi game.' } });
            } else {
                setConnState('reconnecting');
            }
        };
        const onReconnect = () => {
            setConnState('connected');
            socket.emit('game:sync', { roomId });
        };
        let lostTimer = null;
        const onReconnectAttempt = (attempt) => {
            if (attempt >= 8) {
                setConnState('lost');
                lostTimer = setTimeout(() => navigate('/game-lobby', { replace: true, state: { toast: 'Mất kết nối quá lâu. Bạn bị xử thua.' } }), 3000);
            }
        };

        socket.on('game:start', onStart);
        socket.on('game:state', onState);
        socket.on('game:over', onOver);
        socket.on('game:sync_error', onSyncErr);
        socket.on('disconnect', onDisconnect);
        socket.on('connect', onReconnect);
        socket.io.on('reconnect_attempt', onReconnectAttempt);
        socket.on('tournament:spectate_joined', onSpectateJoined);
        socket.on('tournament:updated', onTournamentUpdated);
        socket.on('tournament:joined', onTournamentJoined);
        socket.on('tournament:emoji_broadcast', onEmojiBC);

        async function initAndSync() {
            if (!socket.connected) {
                try {
                    const { auth: firebaseAuth } = await import('../../config/firebase');
                    const user = firebaseAuth.currentUser;
                    if (!user) { navigate('/', { replace: true }); return; }
                    setConnState('reconnecting');
                    const idToken = await user.getIdToken(true);
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
                    } catch (_) {}
                    socket.auth = { token: idToken, photoURL, fullName };
                    await new Promise((resolve, reject) => {
                        socket.once('connect', resolve);
                        socket.once('connect_error', reject);
                        socket.connect();
                    });
                    setConnState('connected');
                } catch (err) {
                    console.error('[BombGame] Reconnect failed:', err);
                    navigate('/game-lobby', { replace: true, state: { toast: 'Không thể kết nối server game.' } });
                    return;
                }
            }
            socket.emit('game:sync', { roomId });
        }

        initAndSync();

        const fallbackTimer = setTimeout(() => {
            setGameState(prev => {
                if (!prev) navigate('/game-lobby', { replace: true, state: { toast: 'Không tìm thấy game. Có thể game đã kết thúc.' } });
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
            socket.off('tournament:spectate_joined', onSpectateJoined);
            socket.off('tournament:updated', onTournamentUpdated);
            socket.off('tournament:joined', onTournamentJoined);
            socket.off('tournament:emoji_broadcast', onEmojiBC);
            clearTimeout(fallbackTimer);
            if (lostTimer) clearTimeout(lostTimer);
        };
    }, [roomId, navigate]);

    // ── Movement handlers ──
    const handleMove = useCallback((dir) => movePlayer(roomId, dir), [roomId]);
    const handleBomb = useCallback(() => {
        if (isSpectatingRef.current) return;
        playSound('placeBomb'); placeBomb(roomId);
    }, [roomId]);

    const doMove = useCallback((d) => {
        if (isSpectatingRef.current) return;
        handleMove(d);

        const gs = gameStateRef.current;
        const me = gs?.players[currentUid];
        if (me?.alive) {
            const deltas = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
            const [dr, dc] = deltas[d];
            const nRow = me.row + dr;
            const nCol = me.col + dc;
            const cell = gs.map?.[nRow]?.[nCol];

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

                const halfCol = Math.floor(VP_COLS / 2);
                const halfRow = Math.floor(VP_ROWS / 2);
                const camCol = Math.max(0, Math.min(nCol - halfCol, MAP_W - VP_COLS));
                const camRow = Math.max(0, Math.min(nRow - halfRow, MAP_H - VP_ROWS));
                targetCam.current = { x: camCol * cs, y: camRow * cs };
            }
        }
    }, [handleMove, currentUid]);

    // ── Keyboard ──
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
                    doMove(d); break;
                }
            }, MOVE_INTERVAL_MS);
        };
        const dn = (e) => {
            if (KEY[e.key]) {
                e.preventDefault();
                const dir = KEY[e.key];
                if (!keysHeld.current.has(dir)) {
                    keysHeld.current.add(dir);
                    doMove(dir);
                    startRepeat();
                }
            }
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleBomb(); }
        };
        const up = (e) => { if (KEY[e.key]) keysHeld.current.delete(KEY[e.key]); };
        window.addEventListener('keydown', dn);
        window.addEventListener('keyup', up);
        startRepeat();
        return () => {
            window.removeEventListener('keydown', dn);
            window.removeEventListener('keyup', up);
            clearInterval(moveInterv.current);
            tapActiveRef.current = false;
            if (tapRafRef.current) cancelAnimationFrame(tapRafRef.current);
        };
    }, [doMove, handleBomb]);

    const handleBack = useCallback(() => {
        if (!gameOver) leaveGame(roomId);
        else leaveRoom(roomId);
        navigate('/game-lobby');
    }, [roomId, navigate, gameOver]);

    // ── Tap-to-Move ──
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

    const startTapRaf = useCallback(() => {
        if (tapRafRef.current) return;
        const loop = (now) => {
            if (!tapActiveRef.current) { tapRafRef.current = null; return; }
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
        if (tapRafRef.current) { cancelAnimationFrame(tapRafRef.current); tapRafRef.current = null; }
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

    // ── Explosion type lookup ──
    const getExpType = useCallback((r, c) => {
        return buildExplosionMap(gameState?.explosions)[`${r},${c}`] || null;
    }, [gameState]);

    // ── Connection lost overlay ──
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

    // ── Loading ──
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
    const avatarOffset = (cellSize - avatarSize) / 2;

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col select-none overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)', touchAction: 'none' }}>

            {/* ══ HUD ══ */}
            <div className="bg-gray-900/95 border-b border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-1 px-2 pt-1.5 pb-1">
                    <div className="flex gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none">
                        <div className="hidden md:flex gap-1 flex-wrap">
                            {players.map(p => (
                                <PlayerPill key={p.uid} player={p} isMe={p.uid === currentUid} compact={false} />
                            ))}
                        </div>
                        <div className="flex md:hidden gap-1">
                            {players.map(p => (
                                <PlayerPill key={p.uid} player={p} isMe={p.uid === currentUid} compact={true} />
                            ))}
                        </div>
                    </div>

                    {countdown !== null && (
                        <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-lg font-mono font-bold text-xs border flex-shrink-0
                            ${countdown <= (isDauCap ? 15 : 30)
                                ? 'text-red-400 border-red-500/40 bg-red-500/10 animate-pulse'
                                : countdown <= (isDauCap ? 30 : 60)
                                    ? 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
                                    : 'text-white border-white/10 bg-white/5'}`}
                        >
                            {isDauCap && <span className="mr-0.5">⚔️</span>}
                            ⏱ {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                        </div>
                    )}

                    <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                        <MiniMap map={gameState.map} players={players}
                            currentUid={currentUid}
                            camCol={miniCam.col} camRow={miniCam.row} />
                        <button onClick={() => { const muted = toggleMute(); setSoundMuted(muted); }}
                            title={soundMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                            className="text-lg w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 active:scale-90 transition-transform">
                            {soundMuted ? '🔇' : '🔊'}
                        </button>
                        <button onClick={toggleFullscreen}
                            className="text-sm w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 active:scale-90 transition-transform">
                            {isFullscreen ? '⛶' : '⛶'}
                        </button>
                        <button onClick={handleBack}
                            className="text-red-400/70 hover:text-red-400 text-xs px-2 h-8 rounded-lg border border-white/10 hover:border-red-500/40 transition-all flex items-center">
                            Thoát
                        </button>
                    </div>
                </div>

                <div className="flex md:hidden items-center gap-1.5 px-2 pb-1.5">
                    <MiniMap map={gameState.map} players={players}
                        currentUid={currentUid}
                        camCol={miniCam.col} camRow={miniCam.row} />
                    <div className="flex-1" />
                    <button onClick={() => { const muted = toggleMute(); setSoundMuted(muted); }}
                        className="text-base w-8 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10 active:scale-90 transition-transform">
                        {soundMuted ? '🔇' : '🔊'}
                    </button>
                    <button onClick={toggleFullscreen}
                        className="text-xs w-8 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10 active:scale-90 transition-transform">
                        {isFullscreen ? '⛶' : '🔲'}
                    </button>
                </div>
            </div>

            {/* ── Game Viewport ── */}
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-2"
                style={{ paddingBottom: `max(${DPAD_H}px, calc(${DPAD_H}px + env(safe-area-inset-bottom)))` }}>
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
                    <div ref={mapDivRef} style={{
                        position: 'absolute',
                        width: MAP_W * cellSize,
                        height: MAP_H * cellSize,
                        willChange: 'transform',
                    }}>
                        {/* Layer 1: Tiles */}
                        {gameState.map.map((rowArr, r) =>
                            rowArr.map((tile, c) => {
                                const expType = getExpType(r, c);
                                const bombHere = gameState.bombs?.some(b => b.row === r && b.col === c);
                                let bg;
                                if (tile === 1) bg = svgUrl(SVG.wall);
                                else if (tile === 2) bg = svgUrl(SVG.block);
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
                                                    position: 'absolute', inset: '-1px',
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

                        {/* Layer 1.5: Debris */}
                        {debrisList.map(({ id, row, col }) => (
                            <div key={id} style={{
                                position: 'absolute',
                                left: col * cellSize, top: row * cellSize,
                                width: cellSize, height: cellSize,
                                backgroundImage: svgUrl(SVG.blockDebris),
                                backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
                                zIndex: 4, pointerEvents: 'none',
                                animation: 'shatter 0.4s ease-out forwards',
                            }} />
                        ))}

                        {/* Layer 1.6: Items */}
                        {(gameState.items || []).map(item => {
                            const svgKey = item.type === 'life' ? 'itemLife'
                                : item.type === 'range' ? 'itemRange'
                                : item.type === 'star' ? 'itemStar'
                                : 'itemBomb';
                            return (
                                <div key={item.id} style={{
                                    position: 'absolute',
                                    left: item.col * cellSize, top: item.row * cellSize,
                                    width: cellSize, height: cellSize,
                                    backgroundImage: svgUrl(SVG[svgKey]),
                                    backgroundSize: '70%', backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    zIndex: 3, pointerEvents: 'none',
                                    animation: 'itemFloat 1.4s ease-in-out infinite alternate',
                                }} />
                            );
                        })}

                        {/* Layer 2: Players */}
                        {players.map(p => {
                            if (!p.alive) return null;
                            const isFlashing = !!(hitFlash[p.uid] && hitFlash[p.uid] > Date.now());
                            return (
                                <div
                                    key={p.uid}
                                    ref={setPlayerRef(p.uid)}
                                    style={{
                                        position: 'absolute',
                                        top: avatarOffset, left: avatarOffset,
                                        width: avatarSize, height: avatarSize,
                                        willChange: 'transform', zIndex: 10,
                                        transform: `translate3d(${p.col * cellSize}px, ${p.row * cellSize}px, 0)`,
                                        outline: isFlashing ? '3px solid #ef4444' : 'none',
                                        borderRadius: '50%',
                                        animation: isFlashing ? 'hitShake 0.15s ease-in-out 4' : 'none',
                                        filter: isFlashing ? 'brightness(1.8) saturate(0.3)' : 'none',
                                    }}
                                >
                                    <PlayerAvatar player={p} size={avatarSize} isMe={p.uid === currentUid} />
                                    {showNames && (
                                        <div style={{
                                            position: 'absolute',
                                            top: avatarSize + 2, left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: p.uid === currentUid ? 'rgba(99,102,241,.85)' : 'rgba(0,0,0,.75)',
                                            color: 'white',
                                            fontSize: Math.max(8, cellSize * 0.22),
                                            padding: '1px 5px', borderRadius: 4,
                                            whiteSpace: 'nowrap', pointerEvents: 'none',
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
                    {gameOver && !isSpectating && (
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

                    {isSpectating && (
                        <SpectatorOverlayComponent
                            tournamentId={tournamentId}
                            tournament={tournamentState}
                            activeMatchId={spectatorMatchId}
                            onWatch={(matchId) => {
                                if (spectatorMatchId) unspectateTournamentMatch(tournamentId, spectatorMatchId);
                                spectateTournamentMatch(tournamentId, matchId);
                                setSpectatorMatchId(matchId);
                            }}
                            onStopWatch={() => setSpectatorMatchId(null)}
                            isWatching={!!spectatorMatchId}
                            floatingEmojis={floatingEmojis}
                            addFloatingEmoji={addFloatingEmoji}
                            removeFloatingEmoji={removeFloatingEmoji}
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
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-end justify-between px-4 pb-4 pt-2 bg-gradient-to-t from-black/70 to-transparent"
                    style={{ pointerEvents: 'none' }}>
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
                                    clearInterval(touchInterv.current);
                                    doMove(dir);
                                    touchInterv.current = setInterval(() => doMove(dir), MOVE_INTERVAL_MS);
                                }}
                                onTouchEnd={(e) => { e.preventDefault(); clearInterval(touchInterv.current); }}
                                onTouchCancel={(e) => { e.preventDefault(); clearInterval(touchInterv.current); }}
                                style={{ position: 'absolute', top, left, width: 50, height: 50, touchAction: 'none' }}
                                className="rounded-2xl bg-gray-800/85 active:bg-indigo-600 border-2 border-white/20 active:border-indigo-400 flex items-center justify-center text-white text-xl font-bold shadow-xl active:scale-90 transition-all"
                            >{label}</button>
                        ))}
                        <div className="absolute rounded-xl bg-gray-900/60 border border-white/10"
                            style={{ top: 60, left: 60, width: 40, height: 40 }} />
                    </div>

                    <div className="flex flex-col items-center gap-2 flex-shrink-0" style={{ pointerEvents: 'auto' }}>
                        <button onClick={toggleFullscreen}
                            className="w-10 h-10 rounded-xl bg-gray-800/70 border border-white/15 flex items-center justify-center text-white/70 text-lg active:scale-90 transition-transform shadow-lg">
                            {isFullscreen ? '⛶' : '🔲'}
                        </button>
                        <button onClick={handleBack}
                            className="w-10 h-10 rounded-xl bg-red-900/50 border border-red-500/30 flex items-center justify-center text-red-400 text-sm font-bold active:scale-90 transition-transform shadow-lg">
                            ✕
                        </button>
                    </div>

                    <div className="flex-shrink-0" style={{ pointerEvents: 'auto' }}>
                        <button
                            onTouchStart={(e) => { e.preventDefault(); handleBomb(); }}
                            className="w-20 h-20 rounded-full active:scale-85 transition-transform flex items-center justify-center shadow-2xl text-4xl select-none"
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
