import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import DrawnCan from '@/components/login/DrawnCan';
import { PILL } from '@/components/login/pill';

// The first viewport is the actual product mechanism at full scale, not a
// shrunk-down preview card — Sippd's real celebratory moment (see
// src/components/scan/RarityReveal.jsx) is the single most product-specific
// "peak" this app has, so it becomes the opening thesis directly. Adapted
// from that real overlay (same particle/burst/glow grammar, same Legendary
// config values) into an in-flow page hero: not `fixed`, sized to the
// viewport rather than layered over other content, and the auto-dismiss
// timer and tap-to-close from the real overlay don't apply here — this
// version's job is to be looked at, not to get out of the way.
const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  angle: (i / 30) * 360 + Math.random() * 12,
  distance: 100 + Math.random() * 160,
  size: 3 + Math.random() * 5,
  delay: Math.random() * 0.3,
  colorIndex: Math.floor(Math.random() * 4),
  shape: Math.random() > 0.5 ? 'circle' : 'rect',
}));

const ACCENT = '#FF00FF';
const GLOW = 'rgba(255,0,255,0.7)';
const BURST = 'rgba(255,0,255,0.15)';
const PARTICLE_COLORS = ['#FF00FF', '#cc00cc', '#ff99ff', '#ffffff'];
// Small magenta text on the near-black hero: a pale tint of the accent, since
// the accent at partial opacity measured 3.26:1 there. This is ~11:1.
const ACCENT_TEXT = '#FF99FF';

// ctaLabel: the page swaps "Get Started" for "Check your inbox" once a
// sign-up or reset email has been sent, so the opening never invites a
// second sign-up beside the confirmation. showScrollHint: off once the
// page below has collapsed, so the chevron doesn't point at nothing.
export default function HeroReveal({ onGetStarted, onJumpToSignIn, ctaLabel = 'Get Started', showScrollHint = true }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative min-h-dvh flex flex-col overflow-hidden" style={{ backgroundColor: '#05050A' }}>
      {!reducedMotion && (
        <>
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0.6], scale: [0.5, 2, 2] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ background: `radial-gradient(circle at 50% 42%, ${BURST} 0%, transparent 70%)` }}
          />
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ backgroundColor: ACCENT }}
          />
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.08, 0.04] }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${ACCENT}22 3px, ${ACCENT}22 4px)`,
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
                  backgroundColor: PARTICLE_COLORS[p.colorIndex],
                  top: '42%',
                  left: '50%',
                }}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(rad) * p.distance,
                  y: Math.sin(rad) * p.distance,
                  scale: [0, 1.4, 0.6, 0],
                  opacity: [1, 1, 0.6, 0],
                }}
                transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
              />
            );
          })}
          {[0, 0.15, 0.3].map((delay, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border"
              style={{ borderColor: ACCENT + '60', top: '42%', left: '50%', translateX: '-50%', translateY: '-50%' }}
              initial={{ width: 40, height: 40, opacity: 0.8 }}
              animate={{ width: 500, height: 500, opacity: 0 }}
              transition={{ duration: 1.2, delay, ease: 'easeOut' }}
            />
          ))}
        </>
      )}

      {/* Brand mark + fast path for a returning user who doesn't want to
          scroll through proof they don't need. */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">⚡</span>
          <span className="text-sm font-display font-bold text-white tracking-wide">Sippd</span>
        </div>
        <button
          type="button"
          onClick={onJumpToSignIn}
          className="h-11 px-3 -mr-3 flex items-center text-xs font-mono text-white/60 hover:text-white transition-colors"
        >
          Sign in
        </button>
      </div>

      {/* Core content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-8">
        <motion.div
          initial={reducedMotion ? false : { scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="flex flex-col items-center"
        >
          <motion.div
            className="text-5xl mb-1 leading-none"
            style={{ filter: `drop-shadow(0 0 20px ${GLOW})` }}
            animate={reducedMotion ? {} : { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }}
            transition={reducedMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            👑
          </motion.div>

          {/* The pull itself: a can, so the page says "cans" before any copy. */}
          <DrawnCan className="h-36 sm:h-44 w-auto mb-4" />

          {/* The reveal's rarity word: display, not the page heading. */}
          <motion.p
            className="font-display font-black tracking-wide mb-3 leading-none px-4"
            style={{
              fontSize: 'clamp(2rem, 10vw, 4rem)',
              color: ACCENT,
              textShadow: `0 0 30px ${GLOW}, 0 0 60px ${GLOW}, 0 0 100px ${GLOW}`,
            }}
            initial={reducedMotion ? false : { y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 0.2, type: 'spring', stiffness: 200, damping: 16 }}
          >
            LEGENDARY
          </motion.p>

          <motion.p
            className="text-2xl font-semibold text-white mb-2 leading-tight max-w-xs"
            initial={reducedMotion ? false : { y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 0.35 }}
          >
            Nova Surge XL
          </motion.p>

          <motion.p
            className="text-sm font-mono uppercase tracking-[0.1em] mb-8 text-balance"
            style={{ color: ACCENT_TEXT }}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 0.5 }}
          >
            This is what a pull feels like
          </motion.p>

          {/* What Sippd is, in plain words: the page's real heading. */}
          <motion.h1
            className="text-lg sm:text-xl font-semibold text-white leading-snug max-w-[22rem] mb-8 text-balance"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 0.8, duration: 0.4, ease: 'easeOut' }}
          >
            Scan the cans you find. The community votes how rare they are.
          </motion.h1>

          <motion.button
            type="button"
            onClick={onGetStarted}
            className={PILL}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 1.2, duration: 0.4 }}
          >
            {ctaLabel}
          </motion.button>
        </motion.div>
      </div>

      <div className="relative z-10 flex justify-center pb-6 h-11">
        {showScrollHint && <ChevronDown className="w-5 h-5 text-white/30" aria-hidden="true" />}
      </div>
    </div>
  );
}
