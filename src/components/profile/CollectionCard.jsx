import { forwardRef } from 'react';
import { DEFAULT_CAN_BG } from '@/lib/canBgColors';
import { Link } from 'react-router-dom';
import { Pin, Share2, X as XIcon, Zap, Star } from 'lucide-react';
import RarityBadge from '@/components/shared/RarityBadge';
import { MAX_PINS } from '@/hooks/useTogglePin';
import { proxyImageUrl } from '@/lib/cardCapture';

// Rarity Breakdown bar only — a monochromatic ramp built from the active
// theme's own --primary hue (dim to vivid), so this proportion chart
// complements whichever theme is active instead of five fixed rarity hues
// clashing against it. Individual RarityBadge chips elsewhere keep the
// theme-invariant --rarity-* tokens on purpose: a can's actual rarity must
// still read the same regardless of viewer theme. See
// .impeccable/critique/2026-09-11T08-11-49Z, Minor Observations.
const BREAKDOWN_VAR = {
  Common: '--breakdown-common',
  Uncommon: '--breakdown-uncommon',
  Rare: '--breakdown-rare',
  'Ultra Rare': '--breakdown-ultra',
  Legendary: '--breakdown-legendary',
};

// This card IS the share card — the ref forwarded here is what
// useCardCapture's html2canvas call captures directly, so there is no
// separate "capture mode" render to keep in sync with what's on screen.
// Images only route through proxyImageUrl/crossOrigin while `sharing` is
// true (i.e. actually being captured) — html2canvas taints on cross-origin
// images without that, but it also requires the target host to be on
// image-proxy's allowlist, which arbitrary user-typed can image URLs won't
// always be. Loading the raw URL the rest of the app uses whenever we're
// not mid-capture keeps ordinary browsing from depending on that allowlist.
const CollectionCard = forwardRef(function CollectionCard(
  {
    top6,
    rarityBreakdown,
    getEffectiveRarity,
    pinnedCount,
    onTogglePin,
    pinPending,
    onShare,
    sharing,
    rank,
    userName,
    score,
    totalCans,
    rarePulls,
  },
  ref
) {
  const displayName = userName || 'Collector';

  return (
    <div ref={ref} className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-sm font-display font-bold text-foreground tracking-wide truncate">
          {displayName}&rsquo;s Collection
        </h2>
        <button
          onClick={onShare}
          aria-label={sharing ? 'Close share card' : 'Share collection card'}
          className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center flex-shrink-0"
        >
          {sharing ? <XIcon className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Score is the number this whole page (and the leaderboard/achievement
          system) revolves around — .hero-card is the token index.css
          reserves for exactly this spot, so it gets its own emphasis
          instead of sitting as a third equal column next to Rare Pulls/
          Cans. text-foreground, not text-primary/60 — that would land at
          2.3-4.2:1 on 5 of 6 themes against .hero-card's opaque surface,
          the same class of WCAG failure already fixed on Home's equivalent
          label (text-foreground stays theme-invariant at 14.7-16.8:1). */}
      <div className="hero-card rounded-2xl p-5 mb-3 text-center">
        <p className="text-[10px] font-mono uppercase tracking-widest text-foreground">Score</p>
        <p className="text-5xl font-mono font-black text-foreground tabular-nums">{score}</p>
        {rank && (
          <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[9px] font-mono font-semibold text-primary">
            #{rank}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-border mb-5">
        {[
          { icon: Star, label: 'Rare Pulls', value: rarePulls },
          { icon: Zap, label: 'Cans', value: totalCans },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center text-center px-1">
            <Icon className="w-3.5 h-3.5 text-primary mb-1" />
            <span className="text-xl font-mono font-bold text-foreground tabular-nums">{value}</span>
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>

      {rarityBreakdown.length > 0 && (
        <div className="mb-5">
          {/* text-foreground, not text-primary/60 — same WCAG failure as
              Score's label above (2.3-4.2:1 on 5 of 6 themes), just never
              propagated here when that one was fixed. */}
          <p className="text-[10px] font-mono uppercase tracking-widest text-foreground mb-2">Rarity Breakdown</p>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
            {rarityBreakdown.map(({ rarity, pct }) => (
              <div
                key={rarity}
                className="h-full"
                style={{ width: `${pct}%`, backgroundColor: `hsl(var(${BREAKDOWN_VAR[rarity] || '--breakdown-legendary'}))` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {rarityBreakdown.map(({ rarity, count }) => (
              <span key={rarity} className="text-[10px] font-mono text-muted-foreground">
                {rarity} <span className="text-foreground">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {top6.map(item => (
          <div
            key={item.id}
            className="relative rounded-xl overflow-hidden border border-primary/20 bg-black/20 hover:border-primary/40 transition-colors"
          >
            <Link to={`/can/${item.can_id}`} className="block">
              <div className="aspect-square" style={{ backgroundColor: item.can_bg_color || DEFAULT_CAN_BG }}>
                {item.can_image_url ? (
                  <img
                    src={sharing ? proxyImageUrl(item.can_image_url) : item.can_image_url}
                    alt={item.can_name}
                    loading="lazy"
                    decoding="async"
                    crossOrigin={sharing ? 'anonymous' : undefined}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-lg opacity-20">🥤</span>
                  </div>
                )}
              </div>
              <div className="p-1.5 space-y-0.5">
                <p className="text-[10px] font-semibold text-foreground truncate">{item.can_name}</p>
                <RarityBadge rarity={getEffectiveRarity(item)} size="sm" />
              </div>
            </Link>
            <button
              onClick={() => onTogglePin(item)}
              disabled={pinPending}
              aria-label={item.pinned_at ? 'Unpin from showcase' : 'Pin to showcase'}
              className="absolute top-0 right-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors"
            >
              {/* Real tap target is the full 44px button above; this stays a
                  small visual badge so it doesn't dominate a ~100px tile. */}
              <span className="w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center">
                <Pin className={`w-3 h-3 transition-colors ${item.pinned_at ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
              </span>
            </button>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-mono text-muted-foreground mt-2">
        {pinnedCount}/{MAX_PINS} pinned
      </p>
    </div>
  );
});

export default CollectionCard;
