import { motion } from 'framer-motion';
import { ScanLine } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { RARITY_HEX, rarityHexToRgba } from '@/lib/rarityConsensus';

const RARITY_LABELS = { 'Rare': 'RARE PULL', 'Ultra Rare': 'ULTRA RARE', 'Legendary': 'LEGENDARY' };
const RARITY_ICONS = { 'Rare': '★', 'Ultra Rare': '✦', 'Legendary': '👑' };

// Lighten (positive) or darken (negative) a hex color toward white/black, for
// particle color variety derived from one accent rather than hand-picked hex.
function shade(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const target = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  const mix = (channel) => Math.round((target - channel) * p) + channel;
  return `#${[mix(r), mix(g), mix(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

// Every color below derives from RARITY_HEX — the same source RarityBadge and
// every other rarity surface in the app reads from — instead of an
// independently hand-picked palette. A prior version hardcoded this screen's
// own cyan/gold/magenta hex literals, so an Ultra Rare pull flashed gold here
// and then showed purple everywhere else the same can appears. (/impeccable
// critique)
const RARITY_CONFIG = Object.fromEntries(
  ['Rare', 'Ultra Rare', 'Legendary'].map((rarity) => {
    const accent = RARITY_HEX[rarity];
    return [rarity, {
      label: RARITY_LABELS[rarity],
      accent,
      glow: rarityHexToRgba(rarity, 0.6),
      burst: rarityHexToRgba(rarity, 0.15),
      shimmer: accent,
      particles: [accent, shade(accent, -0.25), shade(accent, 0.45), '#ffffff'],
      icon: RARITY_ICONS[rarity],
    }];
  })
);

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

export default function RarityReveal({ rarity, canName, onComplete, onScanNext }) {
  const config = RARITY_CONFIG[rarity] || RARITY_CONFIG['Rare'];
  const reducedMotion = usePrefersReducedMotion();

  // Used to force-navigate to "View Collection" on a 2.5s timer regardless
  // of whether the user had acted — but the action buttons don't reach full
  // opacity until 1.2s in, leaving well under a second of stable, tappable
  // UI before the forced navigate. That silently defaulted away from "Scan
  // Next," the flow Scan.jsx's own comment says exists specifically so
  // logging several cans in one sitting doesn't require leaving and coming
  // back each time — hardest exactly when a Legendary pull is the moment
  // someone most wants to linger, not be rushed. Tap-anywhere-to-dismiss
  // (handleTap, bound to the whole screen) already covers "I'm done here,"
  // so there's nothing left for a timer to do that isn't actively working
  // against the app's own stated common case. (/impeccable critique)
  const handleTap = () => {
    onComplete();
  };

  const handleScanNext = (e) => {
    e.stopPropagation();
    onScanNext();
  };

  // bg-background, not a hardcoded hex -- this was the one thing in the
  // whole reveal that wasn't theme-invariant BY DESIGN (unlike the rarity
  // accent/particle colors below, which correctly are). A Field Guide/
  // Origami Fold user got slammed into Neon Grid's exact near-black on
  // every Rare+ pull -- the app's single most emotionally loaded moment
  // contradicting whichever calmer identity they'd actually chosen.
  // AddedConfirmation.jsx (the common-case sibling) already did this
  // correctly one file over. (/impeccable critique)
  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={`${config.label}: ${canName} added to your vault`}
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer select-none overflow-hidden bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      onClick={handleTap}
    >
      {/* Decorative motion — background burst, screen flash, shimmer scan
          lines, particle burst, ring pulses — is pure movement with no
          informational content of its own, so it's skipped entirely under
          reduced motion rather than slowed down or replayed statically.
          The reveal itself (icon, rarity label, can name) still renders
          in full below; only the motion is removed. */}
      {!reducedMotion && (
        <>
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0.6], scale: [0.5, 2, 2] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              background: `radial-gradient(circle at 50% 50%, ${config.burst} 0%, transparent 70%)`,
            }}
          />

          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ backgroundColor: config.accent }}
          />

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
        </>
      )}

      {/* Core content */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center px-8"
        initial={reducedMotion ? false : { scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
      >
        {/* Icon — the infinite pulse/rotate loop is decorative, dropped
            under reduced motion; the icon itself still shows. */}
        <motion.div
          className="text-6xl mb-4 leading-none"
          style={{ filter: `drop-shadow(0 0 20px ${config.glow})` }}
          animate={reducedMotion ? {} : { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }}
          transition={reducedMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
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
          initial={reducedMotion ? false : { y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { delay: 0.2, type: 'spring', stiffness: 200, damping: 16 }}
        >
          {config.label}
        </motion.h1>

        {/* Can name */}
        <motion.p
          className="text-xl font-semibold text-foreground mb-2 leading-tight max-w-xs"
          initial={reducedMotion ? false : { y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { delay: 0.35 }}
        >
          {canName}
        </motion.p>

        {/* Sub label */}
        <motion.p
          className="text-xs font-mono uppercase tracking-[0.2em] mb-10"
          style={{ color: config.accent + 'aa' }}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { delay: 0.5 }}
        >
          Added to your vault
        </motion.p>

        {/* Explicit actions rather than an unlabeled tap-anywhere hint — a
            rare pull is exactly the moment someone is most likely to want
            to keep scanning, so that choice is named rather than implied. */}
        <motion.div
          className="flex items-center gap-3"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { delay: 1.2, duration: 0.4 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleScanNext}
            className="h-11 px-5 rounded-full border text-xs font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            style={{ borderColor: config.accent + '60', color: config.accent }}
          >
            <ScanLine className="w-3.5 h-3.5" /> Scan Next
          </button>
          <button
            type="button"
            onClick={handleTap}
            className="h-11 px-5 rounded-full text-xs font-mono font-semibold uppercase tracking-wider text-black transition-colors"
            style={{ backgroundColor: config.accent }}
          >
            View Collection
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
