import { useState } from 'react';
import { canTileBackground } from '@/lib/canBgColors';
import { Link } from 'react-router-dom';
import { Pin, Link2, CupSoda, X, Eye, TrendingUp, ChevronRight, Info } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import RarityBadge from '@/components/shared/RarityBadge';
import { getMaxPins } from '@/hooks/useTogglePin';
import { cn } from '@/lib/utils';
import { BREAKDOWN_VAR, RARITY_POINTS } from '@/lib/rarityConsensus';

// One source for a tier's theme colour, shared by the bar segment and its
// legend dot so the two can never drift apart.
const breakdownColor = (rarity) => `hsl(var(${BREAKDOWN_VAR[rarity] || '--breakdown-legendary'}))`;

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
  // Competitive context under Score. rankTotal: "of N". nextRank +
  // pointsToNextRank: the gap to the next rank up (owner only).
  // rankHref: where the rank chip links (your row on the Score leaderboard).
  // weeklyPoints: "+N pts this week", owner only; omit to hide.
  rankTotal,
  nextRank,
  pointsToNextRank,
  rankHref,
  weeklyPoints,
  stats,
  rarityBreakdown,
  items,
  getEffectiveRarity,
  canEdit = false,
  onTogglePin,
  pinnedCount,
  pinPending,
  onShare,
  // Opens your own profile the way other people see it. Profile passes it;
  // PublicProfile doesn't (you're already looking at the public view).
  onPreview,
  // Rendered under the grid: "See all N cans" on both profile pages, since
  // the grid is capped to the showcase and the rest has to be reachable.
  footer,
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
      {(headerTitle || onShare || onPreview) && (
        <div className="flex items-center justify-between mb-4 gap-2">
          {headerTitle && (
            <h2 className="text-sm font-display font-bold text-foreground tracking-wide truncate">
              {headerTitle}
            </h2>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Text, not just an eye icon: "preview" is ambiguous as a
                glyph, and this is the one place you can check what the
                link you're about to share actually shows. */}
            {onPreview && (
              <button
                onClick={onPreview}
                aria-label="Preview your profile as others see it"
                className="h-11 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors flex items-center gap-1.5 text-xs font-mono"
              >
                <Eye className="w-4 h-4" aria-hidden="true" />
                Preview
              </button>
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
        </div>
      )}

      {onShare && !shareHintSeen && (
        <div className="flex items-start justify-between gap-2 -mt-2 mb-4 px-0.5">
          <p className="text-2xs font-mono text-muted-foreground leading-snug">
            Tap the link icon to share your live profile. It updates as your vault grows, and Preview shows what others will see.
          </p>
          <button
            onClick={dismissShareHint}
            aria-label="Dismiss"
            // 44px hit area (was ~28px) pulled back with negative margin so
            // the glyph keeps its place beside the hint.
            className="w-11 h-11 -m-3 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="w-3 h-3" aria-hidden="true" />
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
      <div className="relative hero-card rounded-2xl p-5 mb-3 text-center">
        {/* What Score is, one tap away: nothing on the page said how it's
            calculated or what it ranks against. Points come straight from
            RARITY_POINTS so the explanation can't drift from the scoring. */}
        <Popover>
          <PopoverTrigger
            aria-label="How Score works"
            className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="w-4 h-4" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent className="w-64 text-xs font-mono leading-relaxed text-left" side="bottom" align="end">
            <p className="font-semibold text-foreground mb-1">How Score works</p>
            <p className="text-muted-foreground">
              Each can you&apos;ve collected earns points for its community-voted rarity:{' '}
              {Object.entries(RARITY_POINTS).map(([tier, pts]) => `${tier} ${pts}`).join(' · ')}.
              Cans without enough votes yet count as 1. Your Score is the total, and it&apos;s what the Score leaderboard ranks.
            </p>
          </PopoverContent>
        </Popover>
        <p className="text-xs font-mono uppercase tracking-widest text-foreground">Score</p>
        <p className="text-5xl font-mono font-black text-foreground tabular-nums">{score}</p>
        {/* This week's movement, directly under the number it moves. */}
        {weeklyPoints != null && (
          <p className="mt-1 flex items-center justify-center gap-1 text-xs font-mono text-foreground">
            {weeklyPoints > 0 ? (
              <>
                <TrendingUp className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                +{weeklyPoints} pts this week
              </>
            ) : (
              <span className="text-muted-foreground">No new points this week</span>
            )}
          </p>
        )}
        {/* Rank with its context: where you stand, out of how many, and
            what the next step up costs. Foreground text on the accent tint
            (primary as 12px text is ~3:1 on light themes); the chip keeps
            the accent in its fill and border. A real link to your row on
            the Score leaderboard when rankHref is given (Profile), plain
            text otherwise (PublicProfile, about someone else). */}
        {rank && (() => {
          const gapText = rank === 1
            ? 'top of the board'
            : pointsToNextRank != null && nextRank
              ? `${pointsToNextRank} pt${pointsToNextRank === 1 ? '' : 's'} to #${nextRank}`
              : null;
          const label = (
            <>
              <span>Rank #{rank}{rankTotal ? ` of ${rankTotal}` : ''}</span>
              {gapText && <span className="text-muted-foreground">· {gapText}</span>}
            </>
          );
          const chipClass = 'mt-2 inline-flex items-center gap-1.5 px-3 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono font-semibold text-foreground';
          return rankHref ? (
            <Link
              to={rankHref}
              aria-label={`Rank ${rank}${rankTotal ? ` of ${rankTotal}` : ''}${gapText ? `, ${gapText.replace('pts', 'points').replace('pt ', 'point ')}` : ''}. View on the leaderboard`}
              className={cn(chipClass, 'min-h-11 hover:bg-primary/15 transition-colors')}
            >
              {label}
              <ChevronRight className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            </Link>
          ) : (
            <span className={cn(chipClass, 'py-1')}>{label}</span>
          );
        })()}
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
                style={{ width: `${pct}%`, backgroundColor: breakdownColor(rarity) }}
              />
            ))}
          </div>
          {/* Colour key per tier, same dot as RarityHero's donut legend on
              Home. Without it the only way to map a segment of the 6px bar
              to its tier was its position -- several themes' ramps are
              single-hue with deliberately soft ends (index.css family
              notes), so the key matters more there than anywhere.
              aria-hidden: the tier name beside it already says it. */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {rarityBreakdown.map(({ rarity, count }) => (
              <span key={rarity} className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: breakdownColor(rarity) }}
                  aria-hidden="true"
                />
                <span>{rarity} <span className="text-foreground">{count}</span></span>
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
          // Spotlight tile for every collector: index 0 is chosen by
          // buildShowcase (the rarest can for free; your first pin for Pro,
          // the custom hero being the Pro perk alongside extra slots).
          const isHero = index === 0;
          // Owner view only: tiles you didn't pin were filled automatically
          // by rarity, and looked identical to ones you chose.
          const isAuto = canEdit && !item.pinned_at;
          const tile = (
            <>
              <div className="aspect-square" style={{ background: canTileBackground(item.can_bg_color) }}>
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
                {/* title: the full name on hover for a truncated one
                    ("Winter Editi…"); screen readers get it from the
                    link's aria-label. */}
                <p title={item.can_name} className={cn('font-semibold text-foreground truncate', isHero ? 'text-sm' : 'text-xs')}>{item.can_name}</p>
                <RarityBadge rarity={getEffectiveRarity(item)} size={isHero ? undefined : 'sm'} />
              </div>
            </>
          );

          return (
            <div
              key={item.id}
              className={cn(
                // bg-background, not bg-black/20: the page's own "well" colour sits
                // recessed from the card in both polarities, where a flat black
                // overlay turned cream themes grey-brown and dragged the rarity
                // badges on it down to 1.8:1 (Sage, measured).
                'relative rounded-xl overflow-hidden border bg-background transition-colors',
                isHero
                  ? 'col-span-2 row-span-2 border-primary/50 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.4)]'
                  : 'border-primary/20 hover:border-primary/40'
              )}
            >
              {canEdit ? (
                // One explicit name: the name and rarity badge ran together
                // as "Ice PopCOMMON", and the Auto chip is visual-only.
                <Link
                  to={`/can/${item.can_id}`}
                  aria-label={[item.can_name, getEffectiveRarity(item), isAuto && 'auto-filled'].filter(Boolean).join(', ')}
                  className="block"
                >
                  {tile}
                </Link>
              ) : (
                <div>{tile}</div>
              )}
              {isAuto && (
                <span
                  aria-hidden="true"
                  className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-background/85 text-2xs font-mono uppercase tracking-wider text-muted-foreground pointer-events-none"
                >
                  Auto
                </span>
              )}
              {canEdit && (
                <button
                  onClick={() => onTogglePin(item)}
                  disabled={pinPending || atCap}
                  // Names the can: six to ten identical "Pin to showcase"
                  // buttons gave no way to tell which one you were on.
                  aria-label={
                    item.pinned_at
                      ? `Unpin ${item.can_name} from showcase`
                      : atCap
                        ? `Pin ${item.can_name} to showcase (${maxPins} already pinned — unpin one first)`
                        : `Pin ${item.can_name} to showcase`
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
          {/* What pinning does, where you pin. */}
          Pinned {pinnedCount}/{maxPins}: pinned cans stay in your showcase{isPro ? ', and your first pin is the spotlight' : ''}.{' '}
          <span className="uppercase tracking-wider">Auto</span> slots fill with your rarest cans.
        </p>
      )}
      {footer}
    </div>
  );
}
