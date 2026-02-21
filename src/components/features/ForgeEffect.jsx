import { useEffect, useRef, useMemo } from 'react';

/**
 * ForgeEffect - Hiệu ứng lò rèn khi chế tạo Đồng Vàng
 * 
 * Bao gồm:
 * - Lửa cháy ở phía dưới màn hình
 * - Tàn lửa (ember) bay lên từ đống lửa
 * - Tro (ash) bay lơ lửng ở phía trên
 * - Ánh sáng ấm bao phủ
 * - Âm thanh forge.wav
 */
const ForgeEffect = ({ isActive }) => {
  const audioRef = useRef(null);

  // Quản lý âm thanh
  useEffect(() => {
    if (isActive) {
      try {
        const audio = new Audio('/forge.wav');
        audio.loop = true;
        audio.volume = 0.35;
        audio.play().catch(() => { });
        audioRef.current = audio;
      } catch (e) {
        console.log('Không thể phát âm thanh lò rèn');
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [isActive]);

  // ===== Pre-generate particles (tránh re-render) =====

  // Ngọn lửa ở đáy
  const fireParticles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      width: Math.random() * 14 + 8,
      height: Math.random() * 45 + 25,
      bottom: Math.random() * 3,
      delay: Math.random() * 1.5,
      duration: Math.random() * 0.8 + 0.5,
    }))
    , []);

  // Tàn lửa bay lên
  const emberParticles = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: 5 + Math.random() * 90,
      size: Math.random() * 5 + 2,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2.5,
      drift: (Math.random() - 0.5) * 120,
      r: 255,
      g: Math.floor(100 + Math.random() * 120),
      b: Math.floor(Math.random() * 30),
    }))
    , []);

  // Tro bay lơ lửng phía trên
  const ashParticles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => {
      const gray = 160 + Math.floor(Math.random() * 60);
      return {
        id: i,
        startLeft: 5 + Math.random() * 90,
        size: Math.random() * 3.5 + 1.5,
        delay: Math.random() * 6,
        duration: Math.random() * 6 + 5,
        drift: (Math.random() - 0.5) * 200,
        startBottom: 50 + Math.random() * 25,
        opacity: 0.3 + Math.random() * 0.35,
        color: `rgb(${gray}, ${gray - 5}, ${gray - 10})`,
      };
    })
    , []);

  if (!isActive) return null;

  return (
    <>
      {/* CSS Keyframes */}
      <style>{`
        @keyframes forge-flame-flicker {
          0%, 100% {
            transform: scaleY(1) scaleX(1) translateY(0);
            opacity: 0.7;
          }
          20% {
            transform: scaleY(1.5) scaleX(0.7) translateY(-10px);
            opacity: 1;
          }
          40% {
            transform: scaleY(0.8) scaleX(1.3) translateY(-4px);
            opacity: 0.85;
          }
          60% {
            transform: scaleY(1.3) scaleX(0.85) translateY(-14px);
            opacity: 0.95;
          }
          80% {
            transform: scaleY(0.9) scaleX(1.1) translateY(-6px);
            opacity: 0.6;
          }
        }

        @keyframes forge-ember-rise {
          0% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-82vh) translateX(var(--ember-drift)) scale(0.15);
            opacity: 0;
          }
        }

        @keyframes forge-ash-float {
          0% {
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 0;
          }
          12% {
            opacity: var(--ash-opacity);
          }
          88% {
            opacity: calc(var(--ash-opacity) * 0.6);
          }
          100% {
            transform: translateY(-30vh) translateX(var(--ash-drift)) rotate(540deg);
            opacity: 0;
          }
        }

        @keyframes forge-glow-pulse {
          0%, 100% { opacity: 0.5; }
          30% { opacity: 0.85; }
          70% { opacity: 0.65; }
        }

        @keyframes forge-heat-shimmer {
          0%, 100% { 
            transform: scaleX(1); 
            opacity: 0.1; 
          }
          50% { 
            transform: scaleX(1.03); 
            opacity: 0.2; 
          }
        }
      `}</style>

      {/* Container toàn màn hình - z-30 để nằm trên modal card */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 30,
      }}>
        {/* === Lớp ánh sáng ấm bao phủ === */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 100%, rgba(255, 80, 0, 0.12) 0%, rgba(255, 120, 0, 0.05) 40%, transparent 75%)',
          animation: 'forge-heat-shimmer 3s ease-in-out infinite',
        }} />

        {/* === LỬA CHÁY - Phía dưới === */}

        {/* Lớp glow chính */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '-5%',
          right: '-5%',
          height: '28%',
          background: `linear-gradient(to top, 
            rgba(255, 50, 0, 0.55) 0%,
            rgba(255, 100, 0, 0.35) 25%,
            rgba(255, 150, 0, 0.15) 55%,
            transparent 100%
          )`,
          animation: 'forge-glow-pulse 2s ease-in-out infinite',
        }} />

        {/* Lớp glow phụ - tập trung giữa */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '10%',
          right: '10%',
          height: '20%',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(255, 200, 50, 0.45) 0%, rgba(255, 100, 0, 0.2) 50%, transparent 85%)',
          animation: 'forge-glow-pulse 1.5s ease-in-out infinite reverse',
        }} />

        {/* Lớp glow "lõi" - siêu sáng */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '25%',
          right: '25%',
          height: '8%',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(255, 255, 200, 0.35) 0%, rgba(255, 200, 50, 0.2) 50%, transparent 100%)',
          animation: 'forge-glow-pulse 1s ease-in-out infinite',
        }} />

        {/* Ngọn lửa (flame particles) */}
        {fireParticles.map(p => (
          <div
            key={`fire-${p.id}`}
            style={{
              position: 'absolute',
              bottom: `${p.bottom}%`,
              left: `${p.left}%`,
              width: `${p.width}px`,
              height: `${p.height}px`,
              borderRadius: '50% 50% 30% 30% / 70% 70% 30% 30%',
              background: `radial-gradient(ellipse at 50% 70%, 
                rgba(255, 255, 150, 0.95) 0%, 
                rgba(255, 190, 0, 0.85) 20%, 
                rgba(255, 100, 0, 0.65) 50%, 
                rgba(220, 40, 0, 0.35) 75%,
                transparent 100%)`,
              animation: `forge-flame-flicker ${p.duration}s ease-in-out ${p.delay}s infinite`,
              filter: 'blur(1.5px)',
              transformOrigin: 'bottom center',
            }}
          />
        ))}

        {/* === TÀN LỬA (EMBER) - Bay lên từ lửa === */}
        {emberParticles.map(p => {
          const glowColor = `rgba(${p.r}, ${p.g}, ${p.b}, 0.85)`;
          return (
            <div
              key={`ember-${p.id}`}
              style={{
                '--ember-drift': `${p.drift}px`,
                position: 'absolute',
                bottom: '8%',
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                borderRadius: '50%',
                background: `radial-gradient(circle, rgba(255, 255, 200, 1), ${glowColor})`,
                boxShadow: `0 0 ${p.size * 3}px ${p.size}px ${glowColor}`,
                animation: `forge-ember-rise ${p.duration}s ease-out ${p.delay}s infinite`,
              }}
            />
          );
        })}

        {/* === TRO BAY (ASH) - Lơ lửng phía trên === */}
        {ashParticles.map(p => (
          <div
            key={`ash-${p.id}`}
            style={{
              '--ash-drift': `${p.drift}px`,
              '--ash-opacity': p.opacity,
              position: 'absolute',
              bottom: `${p.startBottom}%`,
              left: `${p.startLeft}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              borderRadius: '50%',
              background: p.color,
              boxShadow: `0 0 2px 0.5px rgba(200, 200, 200, 0.2)`,
              animation: `forge-ash-float ${p.duration}s linear ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
};

export default ForgeEffect;
