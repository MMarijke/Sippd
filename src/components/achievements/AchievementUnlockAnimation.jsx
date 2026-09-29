import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

function Particle({ x, y, color, size, angle, speed, opacity }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        opacity,
        transform: `rotate(${angle}deg) translateY(-${speed}px)`,
        transition: 'none',
        pointerEvents: 'none',
      }}
    />
  );
}

export default function AchievementUnlockAnimation({ achievement, onDismiss }) {
  const [phase, setPhase] = useState('enter'); // enter → show → exit
  const [particles, setParticles] = useState([]);
  const timerRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // The particle burst is pure decorative motion with no information of
    // its own — skipped entirely under reduced motion rather than shown
    // static (a field of motionless dots reads as a rendering glitch, not
    // an intentional design).
    if (!reducedMotion) {
      const ps = Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: `${40 + Math.random() * 20}%`,
        y: `${30 + Math.random() * 30}%`,
        color: [
          'hsl(var(--primary))',
          'hsl(var(--accent))',
          'hsl(var(--primary) / 0.7)',
          '#FFFFFF',
          'hsl(var(--primary))',
        ][Math.floor(Math.random() * 5)],
        size: 4 + Math.random() * 6,
        angle: Math.random() * 360,
        speed: 40 + Math.random() * 80,
        opacity: 0.6 + Math.random() * 0.4,
      }));
      setParticles(ps);
    }

    // Auto-dismiss after 3s
    timerRef.current = setTimeout(() => {
      setPhase('exit');
      setTimeout(onDismiss, reducedMotion ? 0 : 400);
    }, 3000);

    return () => clearTimeout(timerRef.current);
  }, [reducedMotion]);

  const dismiss = () => {
    clearTimeout(timerRef.current);
    setPhase('exit');
    setTimeout(onDismiss, reducedMotion ? 0 : 400);
  };

  // Escape to close — keyboard-only users have no other way out before the
  // 3s auto-dismiss besides tabbing to... nothing, there's no button here.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEnter = phase === 'enter';
  const isExit = phase === 'exit';

  // Below, every `transition` string still runs its normal duration when
  // motion is allowed; under reduced motion each becomes 'none' so state
  // changes (enter -> show -> exit, the actual content) still happen
  // immediately, just without the animated interpolation between them.
  const stateTransition = reducedMotion ? 'none' : 'all 0.4s ease';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievement-unlock-title"
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: isExit
          ? 'hsl(var(--background) / 0)'
          : 'hsl(var(--background) / 0.92)',
        backdropFilter: isExit ? 'none' : 'blur(4px)',
        transition: reducedMotion ? 'none' : 'background 0.4s ease, backdrop-filter 0.4s ease',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            opacity: isExit ? 0 : p.opacity,
            transform: isExit
              ? `rotate(${p.angle}deg) translateY(-${p.speed * 2}px) scale(0)`
              : `rotate(${p.angle}deg) translateY(-${p.speed}px) scale(1)`,
            transition: 'all 1.2s ease-out',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Gold burst glow -- alphas now multiplied by --glow-intensity, same
          as every other glow surface in index.css (.neon-glow, .hero-card,
          .rarity-glow-*). Was fixed-alpha, quietly contradicting Field
          Guide/Origami Fold's "zero glow" promise (--glow-intensity: 0)
          at the app's other dopamine-spike moment. (/impeccable critique) */}
      <div style={{
        position: 'absolute',
        width: 240,
        height: 240,
        borderRadius: '50%',
        background: 'radial-gradient(circle, hsl(var(--primary) / calc(0.25 * var(--glow-intensity))) 0%, hsl(var(--primary) / calc(0.05 * var(--glow-intensity))) 50%, transparent 70%)',
        opacity: isExit ? 0 : 1,
        transform: isExit ? 'scale(0.5)' : 'scale(1)',
        transition: stateTransition,
      }} />

      {/* Card */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        opacity: isExit ? 0 : 1,
        transform: isExit ? 'scale(0.8) translateY(20px)' : 'scale(1) translateY(0)',
        transition: stateTransition,
      }}>
        {/* "ACHIEVEMENT UNLOCKED" label */}
        <p style={{
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'hsl(var(--primary))',
          textShadow: '0 0 12px hsl(var(--primary) / calc(0.6 * var(--glow-intensity)))',
        }}>
          Achievement Unlocked
        </p>

        {/* Icon */}
        <div style={{
          width: 96,
          height: 96,
          borderRadius: 28,
          background: 'hsl(var(--primary) / 0.12)',
          border: '2px solid hsl(var(--primary) / 0.5)',
          boxShadow: '0 0 32px hsl(var(--primary) / calc(0.3 * var(--glow-intensity))), 0 0 64px hsl(var(--primary) / calc(0.1 * var(--glow-intensity)))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
        }}>
          {achievement.icon}
        </div>

        {/* Title */}
        {/* var(--font-display), not a hardcoded 'Orbitron' -- this was the
            one place in the app where the active theme's font system
            silently didn't apply. Resolves to Orbitron under Neon Grid,
            Fraunces under Field Guide, Outfit under Origami Fold, same as
            every className="font-display" surface elsewhere (see
            tailwind.config.js's fontFamily wiring). (/impeccable critique) */}
        <p id="achievement-unlock-title" style={{
          fontSize: '1.375rem',
          fontWeight: 900,
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'hsl(var(--primary))',
          textShadow: '0 0 20px hsl(var(--primary) / calc(0.5 * var(--glow-intensity)))',
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 1.2,
        }}>
          {achievement.title}
        </p>

        {/* Description */}
        <p style={{
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-mono)',
          color: 'hsl(var(--muted-foreground))',
          textAlign: 'center',
          maxWidth: 240,
        }}>
          {achievement.description}
        </p>

        {/* Tap to dismiss hint */}
        <p style={{
          fontSize: '0.6875rem', // was 10px -- raised to the app's 11px text-2xs floor
          fontFamily: 'var(--font-mono)',
          color: 'hsl(var(--muted-foreground))',
          marginTop: 8,
          letterSpacing: '0.1em',
        }}>
          TAP TO DISMISS
        </p>
      </div>
    </div>,
    document.body
  );
}
