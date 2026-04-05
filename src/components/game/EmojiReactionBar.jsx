// src/components/game/EmojiReactionBar.jsx
import { useState, useEffect, useCallback } from 'react';

const EMOJI_SET = ['🔥', '💥', '😱', '👏', '😂', '🎉', '💀', '🤯'];

export default function EmojiReactionBar({ onSendEmoji, floatingEmojis, onRemoveEmoji }) {
    return (
        <>
            {/* Emoji bar at bottom */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                flex gap-2 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 shadow-xl">
                {EMOJI_SET.map(e => (
                    <button key={e} onClick={() => onSendEmoji(e)}
                        className="text-2xl transition-transform active:scale-125 hover:scale-110 select-none"
                        style={{ lineHeight: 1 }}>
                        {e}
                    </button>
                ))}
            </div>

            {/* Floating emoji animations */}
            {floatingEmojis.map(item => (
                <FloatingEmoji key={item.id} item={item} onDone={() => onRemoveEmoji(item.id)} />
            ))}
        </>
    );
}

function FloatingEmoji({ item, onDone }) {
    useEffect(() => {
        const timer = setTimeout(onDone, 1600);
        return () => clearTimeout(timer);
    }, [onDone]);

    return (
        <div
            className="fixed z-50 pointer-events-none select-none text-3xl"
            style={{
                left: item.x,
                bottom: 80,
                animation: 'floatUp 1.5s ease-out forwards',
            }}>
            {item.emoji}
            {item.fromName && (
                <span className="text-xs text-white/70 block text-center" style={{ fontSize: 10 }}>
                    {item.fromName}
                </span>
            )}
        </div>
    );
}

// CSS keyframe must be injected globally — add to index.css or inject here
const STYLE_ID = 'emoji-float-style';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        @keyframes floatUp {
            0%   { transform: translateY(0)   scale(1);   opacity: 1; }
            60%  { transform: translateY(-80px) scale(1.2); opacity: 1; }
            100% { transform: translateY(-140px) scale(0.8); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

/** Hook để quản lý floating emojis */
export function useFloatingEmojis() {
    const [floatingEmojis, setFloatingEmojis] = useState([]);

    const addEmoji = useCallback((emoji, fromName = '') => {
        const id = `em_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        // Random x position in center area
        const x = window.innerWidth * 0.3 + Math.random() * window.innerWidth * 0.4;
        setFloatingEmojis(prev => [...prev, { id, emoji, fromName, x }]);
    }, []);

    const removeEmoji = useCallback((id) => {
        setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, []);

    return { floatingEmojis, addEmoji, removeEmoji };
}
