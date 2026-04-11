// src/pages/public/BombGame/components.jsx
// ─── Pure Display Sub-components ───────────────────────────────

import { useState, useEffect } from 'react';
import { MAP_W, MAP_H, VP_COLS, VP_ROWS, CELL_WALL, CELL_BLOCK } from './constants';
import { SVG, svgUrl } from './svgAssets';

// ─── PlayerAvatar (pure display) ───────────────────────────────
export function PlayerAvatar({ player, size, isMe }) {
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

// ─── PlayerPill (HUD pill) ──────────────────────────────────────
// compact=true: chế độ rút gọn cho mobile (không hiện tên)
export function PlayerPill({ player, isMe, compact = false }) {
    const [err, setErr] = useState(false);
    return (
        <div className={`flex items-center rounded-lg border flex-shrink-0
            ${compact ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'}
            ${player.alive ? 'bg-white/5 border-white/10' : 'opacity-40 bg-white/2 border-white/5'}`}
            style={isMe ? { borderColor: 'rgba(165,180,252,0.4)', background: 'rgba(99,102,241,0.1)' } : {}}>
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
            {!compact && (
                <span className={`text-xs font-medium truncate max-w-[70px] ${player.alive ? 'text-white' : 'text-gray-600 line-through'}`}>
                    {player.name}{isMe ? ' ★' : ''}
                </span>
            )}
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
            {player.stars > 0 && (
                <span className="flex items-center gap-px flex-shrink-0" style={{ fontSize: 10 }}>
                    <span>⭐</span>
                    <span className="text-yellow-300 font-bold" style={{ fontSize: 10, lineHeight: 1 }}>{player.stars}</span>
                </span>
            )}
        </div>
    );
}

// ─── MiniMap ────────────────────────────────────────────────────
export function MiniMap({ map, players, currentUid, camCol, camRow }) {
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

// ─── GameOverOverlay ────────────────────────────────────────────
export function GameOverOverlay({ winner, winnerName, currentUid, reward, reason, refundedUids = [], onBack }) {
    const isWinner = winner === currentUid;
    const isTimeoutDraw = !winner && reason === 'timeout';
    const isSurvivor = isTimeoutDraw && refundedUids.includes(currentUid);
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

    let icon, title, subtitle;
    if (winner) {
        icon = isWinner ? '🏆' : '💀';
        title = isWinner ? 'Bạn thắng!' : 'Bạn thua!';
        subtitle = isWinner
            ? <span className="text-yellow-400 font-semibold">+{rewardDisplay} Xu đã được cộng!</span>
            : <span>{winnerName} thắng &mdash; <span className="text-red-400">-20 Xu</span></span>;
    } else if (isTimeoutDraw) {
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
                        <p className="text-gray-600 text-xs mt-2">⏰ Hết giờ</p>
                    )}
                </div>

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
