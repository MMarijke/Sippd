import { DEFAULT_CAN_BG } from '@/lib/canBgColors';
import { Link } from 'react-router-dom';
import { Pin, Share2, Zap, Star, CupSoda } from 'lucide-react';
import RarityBadge from '@/components/shared/RarityBadge';
import { MAX_PINS } from '@/hooks/useTogglePin';
import { cn } from '@/lib/utils';

// Rarity Breakdown bar — theme-invariant --rarity-* tokens, the same ones
// RarityBadge uses, so this proportion chart reads as the same rarity
// language as every badge/gauge elsewhere in the app (a can's actual
// rarity must look the same regardless of viewer theme). An earlier
// version of this bar used a monochromatic single-hue ramp instead —
// changed back after user feedback that losing the per-tier color
// distinction made the bar unreadable as a breakdown at a glance. See
// ShareCardTemplate.jsx's identical bar — kept in sync so the live view
// and the exported card never disagree.
const BREAKDOWN_VAR = {
  Common: '--rarity-common',
  Uncommon: '--rarity-uncommon',
  Rare: '--rarity-rare',
  'Ultra Rare': '--rarity-ultra',
  Legendary: '--rarity-legendary',
};

// Profile's live, interactive trophy case — pin/unpin, navigate to a can,
// open the share flow. Purely a live view now: the exported share image is
// a separate, purpose-built ShareCardTemplate (src/components/shared/),
// captured hidden/off-screen by ShareCardModal. This card used to double as
// the literal html2canvas capture source, which is what caused this app's
// last two share-flow bugs (a live control's icon baked into the exported
// PNG as a dead pixel; the card needing conditional un/mounting to avoid
// visually duplicating itself). No ref, no `sharing` mode, no proxied
// images — this component only ever has one job now.
export default function CollectionCard({
  top6,
  rarityBreakdown,
  getEffectiveRarity,
  pinnedCount,
  onTogglePin,
  pinPending,
  onShare,
  rank,
  userName,
  score,
  totalCans,
  rarePulls,
}) {
  const displayName = userName || 'Collector';

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-sm font-display font-bold text-foreground tracking-wide truncate">
          {displayName}&rsquo;s Collection
        </h2>
        <button
          onClick={onShare}
          aria-label="Share collection card"
          className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center flex-shrink-0"
        >
          <Share2 className="w-4 h-4" />
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
        {top6.map(item => {
          // Proactively disables the button instead of relying on the
          // mutation's own thrown-error toast (useTogglePin.js) — that
          // still fires as a fallback for any race between two pin taps,
          // but the common case is now prevented, not just explained
          // after the fact.
          const atCap = !item.pinned_at && pinnedCount >= MAX_PINS;
          return (
          <div
            key={item.id}
            className="relative rounded-xl overflow-hidden border border-primary/20 bg-black/20 hover:border-primary/40 transition-colors"
          >
            <Link to={`/can/${item.can_id}`} className="block">
              <div className="aspect-square" style={{ backgroundColor: item.can_bg_color || DEFAULT_CAN_BG }}>
                {item.can_image_url ? (
                  <>
                    {/* onError swaps to the same icon fallback used for a
                        missing/broken URL, rather than a browser
                        broken-image glyph. A real SVG, not an emoji — 🥤
                        has no reliable color glyph on every OS/browser and
                        was rendering as an ambiguous monochrome box that
                        read as a delete/trash icon. */}
                    <img
                      src={item.can_image_url}
                      alt={item.can_name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain"
                      onError={e => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    <div className="w-full h-full items-center justify-center" style={{ display: 'none' }}>
                      <CupSoda className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <CupSoda className="w-5 h-5 text-muted-foreground/40" />
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
              disabled={pinPending || atCap}
              aria-label={
                item.pinned_at
                  ? 'Unpin from showcase'
                  : atCap
                    ? `Pin to showcase (${MAX_PINS} already pinned — unpin one first)`
                    : 'Pin to showcase'
              }
              className={cn(
                'absolute top-0 right-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors',
                atCap && 'cursor-not-allowed'
              )}
            >
              {/* Real tap target is the full 44px button above; this stays a
                  small visual badge so it doesn't dominate a ~100px tile. */}
              <span
                className={cn(
                  'w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center',
                  atCap && 'opacity-40'
                )}
              >
                <Pin className={`w-3 h-3 transition-colors ${item.pinned_at ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
              </span>
            </button>
          </div>
          );
        })}
      </div>
      <p className="text-[10px] font-mono text-muted-foreground mt-2">
        {pinnedCount}/{MAX_PINS} pinned
      </p>
    </div>
  );
}
