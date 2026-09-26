import { useState } from 'react';
import { DEFAULT_CAN_BG } from '@/lib/canBgColors';
import { Link } from 'react-router-dom';
import { Pin, Link2, CupSoda, X } from 'lucide-react';
import RarityBadge from '@/components/shared/RarityBadge';
import { getMaxPins } from '@/hooks/useTogglePin';
import { cn } from '@/lib/utils';

// Rarity Breakdown bar — theme-invariant --rarity-* tokens, the same ones
// RarityBadge uses, so this proportion chart reads as the same rarity
// language as every badge/gauge elsewhere in the app (a can's actual
// rarity must look the same regardless of viewer theme). An earlier
// version of this bar used a monochromatic single-hue ramp instead —
// changed back after user feedback that losing the per-tier color
// distinction made the bar unreadable as a breakdown at a glance.
const BREAKDOWN_VAR = {
  Common: '--rarity-common',
  Uncommon: '--rarity-uncommon',
  Rare: '--rarity-rare',
  'Ultra Rare': '--rarity-ultra',
  Legendary: '--rarity-legendary',
};

// The trophy-case presentation shared by Profile.jsx (your own, editable
// collection) and PublicProfile.jsx (anyone's, read-only) — score hero,
// stat row, rarity breakdown bar, and can-tile grid, one definition
// instead of two that quietly drift. Before this, Profile rendered this
// exact content through its own CollectionCard while PublicProfile
// re-implemented an approximate version of the same idea (a differently
// styled score box, a recharts pie chart instead of this bar, no pin
// affordances) — the same visual-drift failure mode as the ShareCardTemplate/
// CollectionCard split earlier this session, just between two live pages
// instead of a live page and a capture template.
//
// `canEdit` is the one flag that changes what renders: pin buttons and
// can-detail navigation only make sense when the viewer owns this
// collection (CanDetail's own query is owner-scoped — linking a stranger
// there would show either the viewer's unrelated copy of that can or
// nothing at all). Profile.jsx always passes canEdit; PublicProfile never
// does, even when you're viewing your own public link — /u/:userId is
// deliberately the read-only view regardless of who's looking.
//
// Emptiness (zero cans) is deliberately NOT handled in here: what to show
// instead — "scan your first can" for an owner with nothing yet, a
// neutral message for a stranger's empty collection — is page-specific
// messaging, so each page still decides whether to render this card at
// all, exactly as Profile.jsx already did before this component existed.
export default function CollectionCard({
  headerTitle,
  score,
  rank,
  stats,
  rarityBreakdown,
  items,
  getEffectiveRarity,
  canEdit = false,
  onTogglePin,
  pinnedCount,
  pinPending,
  onShare,
  // Whether the COLLECTION OWNER (not the viewer) has Pro — Trophy Case's
  // bigger pin cap and hero spotlight tile are a perk of the showcase
  // itself, so a stranger viewing a Pro collector's PublicProfile sees the
  // same larger, spotlighted grid the owner sees on their own Profile.
  isPro = false,
}) {
  const maxPins = getMaxPins(isPro);
  // First-use hint for the Share icon — it used to export an image, now it
  // shares a live link, and a bare chain-link glyph carries none of that
  // history on its own. Only ever relevant when onShare is passed (Profile
  // is the only caller today), and clears itself the first time it's read
  // or the button is actually tapped, whichever comes first — same
  // localStorage "seen" pattern as the theme-family New badges.
  // (/impeccable critique)
  const [shareHintSeen, setShareHintSeen] = useState(() => {
    try {
      return localStorage.getItem('sippd_share_hint_seen') === '1';
    } catch {
      return true;
    }
  });
  const dismissShareHint = () => {
    try {
      localStorage.setItem('sippd_share_hint_seen', '1');
    } catch {
      // Best-effort — a blocked localStorage just means the hint reappears.
    }
    setShareHintSeen(true);
  };
  const handleShareClick = () => {
    dismissShareHint();
    onShare();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      {(headerTitle || onShare) && (
        <div className="flex items-center justify-between mb-4 gap-2">
          {headerTitle && (
            <h2 className="text-sm font-display font-bold text-foreground tracking-wide truncate">
              {headerTitle}
            </h2>
          )}
          {onShare && (
            <button
              onClick={handleShareClick}
              aria-label="Share profile link"
              className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center flex-shrink-0"
            >
              <Link2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {onShare && !shareHintSeen && (
        <div className="flex items-start justify-between gap-2 -mt-2 mb-4 px-0.5">
          <p className="text-[11px] font-mono text-muted-foreground leading-snug">
            New: tap the link icon above to share your live profile — no more downloading an image.
          </p>
          <button
            onClick={dismissShareHint}
            aria-label="Dismiss"
            className="p-2 -m-2 text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Score is the number this whole app (leaderboard/achievement system
          included) revolves around — .hero-card is the token index.css
          reserves for exactly this spot, so it gets its own emphasis
          instead of sitting as a column next to the other stats.
          text-foreground, not text-primary/60 — that would land at
          2.3-4.2:1 on 5 of 6 themes against .hero-card's opaque surface,
          the same class of WCAG failure already fixed on Home's equivalent
          label (text-foreground stays theme-invariant at 14.7-16.8:1). */}
      <div className="hero-card rounded-2xl p-5 mb-3 text-center">
        <p className="text-xs font-mono uppercase tracking-widest text-foreground">Score</p>
        <p className="text-5xl font-mono font-black text-foreground tabular-nums">{score}</p>
        {rank && (
          <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono font-semibold text-primary">
            #{rank}
          </span>
        )}
      </div>

      <div className={cn('grid divide-x divide-border mb-5', stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center text-center px-1">
            <Icon className="w-3.5 h-3.5 text-primary mb-1" />
            <span className="text-xl font-mono font-bold text-foreground tabular-nums">{value}</span>
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>

      {rarityBreakdown.length > 0 && (
        <div className="mb-5">
          {/* text-foreground, not text-primary/60 — same WCAG failure as
              Score's label above (2.3-4.2:1 on 5 of 6 themes), just never
              propagated here when that one was fixed. */}
          <p className="text-xs font-mono uppercase tracking-widest text-foreground mb-2">Rarity Breakdown</p>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
            {rarityBreakdown.map(({ rarity, pct }) => (
              <div
                key={rarity}
                className="h-full"
                style={{ width: `${pct}%`, backgroundColor: `hsl(var(${BREAKDOWN_VAR[rarity] || '--rarity-legendary'}))` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {rarityBreakdown.map(({ rarity, count }) => (
              <span key={rarity} className="text-xs font-mono text-muted-foreground">
                {rarity} <span className="text-foreground">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* grid-flow-row-dense so the hero tile's 2x2 span doesn't leave a
          hole for auto-placement to skip past — later tiles backfill the
          gap next to/below it instead of only ever flowing after it. */}
      <div className={cn('grid grid-cols-3 gap-2', isPro && 'grid-flow-row-dense')}>
        {items.map((item, index) => {
          // Proactively disables the button instead of relying on the
          // mutation's own thrown-error toast (useTogglePin.js) — that
          // still fires as a fallback for any race between two pin taps,
          // but the common case is now prevented, not just explained
          // after the fact.
          const atCap = canEdit && !item.pinned_at && pinnedCount >= maxPins;
          // Trophy Case: the showcase's first tile gets a spotlight
          // treatment when its owner is Pro — genuinely new layout, not a
          // toggle, since every tile rendered identically before this.
          const isHero = isPro && index === 0;
          const tile = (
            <>
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
                <p className={cn('font-semibold text-foreground truncate', isHero ? 'text-sm' : 'text-xs')}>{item.can_name}</p>
                <RarityBadge rarity={getEffectiveRarity(item)} size={isHero ? undefined : 'sm'} />
              </div>
            </>
          );

          return (
            <div
              key={item.id}
              className={cn(
                'relative rounded-xl overflow-hidden border bg-black/20 transition-colors',
                isHero
                  ? 'col-span-2 row-span-2 border-primary/50 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.4)]'
                  : 'border-primary/20 hover:border-primary/40'
              )}
            >
              {canEdit ? (
                <Link to={`/can/${item.can_id}`} className="block">{tile}</Link>
              ) : (
                <div>{tile}</div>
              )}
              {canEdit && (
                <button
                  onClick={() => onTogglePin(item)}
                  disabled={pinPending || atCap}
                  aria-label={
                    item.pinned_at
                      ? 'Unpin from showcase'
                      : atCap
                        ? `Pin to showcase (${maxPins} already pinned — unpin one first)`
                        : 'Pin to showcase'
                  }
                  className={cn(
                    'absolute top-0 right-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors',
                    atCap && 'cursor-not-allowed'
                  )}
                >
                  {/* Real tap target is the full 44px button above; this
                      stays a small visual badge so it doesn't dominate a
                      ~100px tile. */}
                  <span
                    className={cn(
                      'w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center',
                      atCap && 'opacity-40'
                    )}
                  >
                    <Pin className={`w-3 h-3 transition-colors ${item.pinned_at ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <p className="text-xs font-mono text-muted-foreground mt-2">
          {pinnedCount}/{maxPins} pinned
        </p>
      )}
    </div>
  );
}
