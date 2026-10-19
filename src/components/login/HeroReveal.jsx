import { motion } from 'framer-motion';
import { ChevronDown, ArrowDown } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import DrawnCan from '@/components/login/DrawnCan';
import { PILL, PILL_OUTLINE } from '@/components/login/pill';

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
// Magenta text on the near-black hero (the LEGENDARY badge, the h1's second
// sentence): a pale tint of the accent, since
// the accent at partial opacity measured 3.26:1 there. This is ~11:1.
const ACCENT_TEXT = '#FF99FF';

// ctaLabel: the page swaps "Get Started" for "Check your inbox" once a
// sign-up or reset email has been sent, so the opening never invites a
// second sign-up beside the confirmation. showScrollHint: off once the
// page below has collapsed, so the chevron doesn't point at nothing.
//
// onSeeHow (web only): on desktop the form is already beside the opening,
// so the opening's button there is a secondary "See how it works" that
// scrolls to the rarity section, not a second magenta Sign Up. Phones keep
// the primary button, since the form is below. Without onSeeHow (Android
// intro), the primary button shows at every size.
export default function HeroReveal({ onGetStarted, onJumpToSignIn, onSeeHow, ctaLabel = 'Get Started', showScrollHint = true }) {
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
            style={{ background: `radial-gradient(circle at 50% 31%, ${BURST} 0%, transparent 70%)` }}
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
                  top: '31%',
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
              style={{ borderColor: ACCENT + '60', top: '31%', left: '50%', translateX: '-50%', translateY: '-50%' }}
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
        {/* Desktop: the form beside the opening has Sign up | Sign in tabs,
            so this quick path is for phones (and the Android intro). */}
        <button
          type="button"
          onClick={onJumpToSignIn}
          className={`h-11 px-3 -mr-3 flex items-center text-xs font-mono text-white/60 hover:text-white transition-colors ${onSeeHow ? 'lg:hidden' : ''}`}
        >
          Sign in
        </button>
      </div>

      {/* Core content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="flex flex-col items-center">
          {/* The pull: a can that lands with the burst, LEGENDARY stamped
              across it as a badge. The rarity is the can's, not the page's
              headline; it shows what a reveal looks like at a glance. */}
          <motion.div
            className="relative mb-10"
            initial={reducedMotion ? false : { scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          >
            <DrawnCan className="h-40 sm:h-48 w-auto" />
            {/* Centred by a static wrapper: framer-motion owns the badge's
                transform, which would override a translate-x centring. */}
            <span className="absolute inset-x-0 -bottom-4 flex justify-center">
            <motion.span
              className="whitespace-nowrap rounded-full border px-4 py-1.5 font-display font-black text-sm tracking-[0.18em]"
              style={{
                backgroundColor: '#05050A',
                borderColor: ACCENT,
                color: ACCENT_TEXT,
                boxShadow: `0 0 18px ${GLOW}`,
                textShadow: `0 0 12px ${GLOW}`,
              }}
              initial={reducedMotion ? false : { y: 14, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={reducedMotion ? { duration: 0 } : { delay: 0.35, type: 'spring', stiffness: 320, damping: 18 }}
            >
              LEGENDARY
            </motion.span>
            </span>
          </motion.div>

          {/* What Sippd is: the page's headline, at display size. The second
              sentence is the differentiator, set apart in the reveal's tint. */}
          <motion.h1
            className="font-display font-black text-white leading-[1.08] tracking-[-0.01em] max-w-[18ch] text-balance mb-4"
            style={{ fontSize: 'clamp(1.75rem, 7.5vw, 3.5rem)' }}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* One sentence per block, so the tinted one never starts mid-line. */}
            <span className="block">Scan the cans you find.</span>{' '}
            <span className="block" style={{ color: ACCENT_TEXT }}>The community votes how rare they are.</span>
          </motion.h1>

          <motion.p
            className="text-base sm:text-lg font-body text-white/75 max-w-[32ch] text-balance mb-8"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 0.75, duration: 0.4 }}
          >
            Log every can you own, climb the leaderboard, and chase the Legendary ones.
          </motion.p>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 1, duration: 0.4 }}
          >
            <button type="button" onClick={onGetStarted} className={`${PILL} ${onSeeHow ? 'lg:hidden' : ''}`}>
              {ctaLabel}
            </button>
            {onSeeHow && showScrollHint && (
              <button type="button" onClick={onSeeHow} className={`${PILL_OUTLINE} hidden lg:inline-flex`}>
                See how it works
                <ArrowDown className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 flex justify-center pb-6 h-11">
        {showScrollHint && <ChevronDown className="w-5 h-5 text-white/30" aria-hidden="true" />}
      </div>
    </div>
  );
}
