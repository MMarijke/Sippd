import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

const RARITY_CONFIG = {
  'Rare': {
    label: 'RARE PULL',
    accent: '#00FFFF',
    glow: 'rgba(0,255,255,0.6)',
    burst: 'rgba(0,255,255,0.15)',
    shimmer: '#00FFFF',
    particles: ['#00FFFF', '#00c8d4', '#7ff7ff', '#ffffff'],
    icon: '★',
  },
  'Ultra Rare': {
    label: 'ULTRA RARE',
    accent: '#FFD700',
    glow: 'rgba(255,215,0,0.7)',
    burst: 'rgba(255,215,0,0.12)',
    shimmer: '#FFD700',
    particles: ['#FFD700', '#FFA500', '#fff7aa', '#ffffff'],
    icon: '✦',
  },
  'Legendary': {
    label: 'LEGENDARY',
    accent: '#FF00FF',
    glow: 'rgba(255,0,255,0.7)',
    burst: 'rgba(255,0,255,0.15)',
    shimmer: '#FF00FF',
    particles: ['#FF00FF', '#cc00cc', '#ff99ff', '#ffffff'],
    icon: '👑',
  },
};

// Generate random particles once
const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  angle: (i / 30) * 360 + Math.random() * 12,
  distance: 100 + Math.random() * 160,
  size: 3 + Math.random() * 5,
  delay: Math.random() * 0.3,
  colorIndex: Math.floor(Math.random() * 4),
  shape: Math.random() > 0.5 ? 'circle' : 'rect',
}));

export default function RarityReveal({ rarity, canName, onComplete }) {
  const config = RARITY_CONFIG[rarity] || RARITY_CONFIG['Rare'];
  const autoDismissRef = useRef(null);

  useEffect(() => {
    autoDismissRef.current = setTimeout(onComplete, 2500);
    return () => clearTimeout(autoDismissRef.current);
  }, [onComplete]);

  const handleTap = () => {
    clearTimeout(autoDismissRef.current);
    onComplete();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer select-none overflow-hidden"
      style={{ backgroundColor: '#05050A' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      onClick={handleTap}
    >
      {/* Deep background radial */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 1, 0.6], scale: [0.5, 2, 2] }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          background: `radial-gradient(circle at 50% 50%, ${config.burst} 0%, transparent 70%)`,
        }}
      />

      {/* Screen flash */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0] }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ backgroundColor: config.accent }}
      />

      {/* Shimmer scan lines */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.08, 0.04] }}
        transition={{ duration: 1, delay: 0.3 }}
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            ${config.accent}22 3px,
            ${config.accent}22 4px
          )`,
        }}
      />

      {/* Particles burst */}
      {PARTICLES.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        return (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              width: p.size,
              height: p.size,
              borderRadius: p.shape === 'circle' ? '50%' : '1px',
              backgroundColor: config.particles[p.colorIndex],
              top: '50%',
              left: '50%',
            }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: Math.cos(rad) * p.distance,
              y: Math.sin(rad) * p.distance,
              scale: [0, 1.4, 0.6, 0],
              opacity: [1, 1, 0.6, 0],
            }}
            transition={{
              duration: 0.9,
              delay: p.delay,
              ease: 'easeOut',
            }}
          />
        );
      })}

      {/* Concentric ring pulse */}
      {[0, 0.15, 0.3].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{ borderColor: config.accent + '60' }}
          initial={{ width: 40, height: 40, opacity: 0.8 }}
          animate={{ width: 500, height: 500, opacity: 0 }}
          transition={{ duration: 1.2, delay, ease: 'easeOut' }}
        />
      ))}

      {/* Core content */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center px-8"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
      >
        {/* Icon */}
        <motion.div
          className="text-6xl mb-4 leading-none"
          style={{ filter: `drop-shadow(0 0 20px ${config.glow})` }}
          animate={{ scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {config.icon}
        </motion.div>

        {/* Rarity label */}
        <motion.h1
          className="font-display font-black tracking-widest mb-3 leading-none"
          style={{
            fontSize: 'clamp(2rem, 10vw, 3.5rem)',
            color: config.accent,
            textShadow: `0 0 30px ${config.glow}, 0 0 60px ${config.glow}, 0 0 100px ${config.glow}`,
          }}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 16 }}
        >
          {config.label}
        </motion.h1>

        {/* Can name */}
        <motion.p
          className="text-xl font-semibold text-white mb-2 leading-tight max-w-xs"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          {canName}
        </motion.p>

        {/* Sub label */}
        <motion.p
          className="text-xs font-mono uppercase tracking-[0.2em] mb-10"
          style={{ color: config.accent + 'aa' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Added to your vault
        </motion.p>

        {/* Tap hint */}
        <motion.p
          className="text-[11px] font-mono text-white/30 tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ delay: 1.2, duration: 1, repeat: Infinity }}
        >
          Tap to continue
        </motion.p>
      </motion.div>
    </motion.div>
  );
}