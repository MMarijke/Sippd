import { forwardRef } from 'react';
import { Zap, Star } from 'lucide-react';
import { DEFAULT_CAN_BG } from '@/lib/canBgColors';
import { proxyImageUrl } from '@/lib/cardCapture';
import RarityBadge from '@/components/shared/RarityBadge';

// Rarity Breakdown bar only — see the identical note on CollectionCard.jsx.
// A monochromatic ramp built from the active theme's own --primary hue
// (dim to vivid), not the theme-invariant --rarity-* tokens RarityBadge
// uses: a can's actual rarity must read the same in every theme, but this
// bar is the same mood/proportion visualization as CollectionCard's, so it
// gets the same theme-complementary treatment rather than clashing with it.
const BREAKDOWN_VAR = {
  Common: '--breakdown-common',
  Uncommon: '--breakdown-uncommon',
  Rare: '--breakdown-rare',
  'Ultra Rare': '--breakdown-ultra',
  Legendary: '--breakdown-legendary',
};

function CanTile({ image, bgColor, name, rarityBadge }) {
  return (
    <div className="rounded-xl overflow-hidden border border-primary/20" style={{ backgroundColor: 'hsl(var(--background) / 0.5)' }}>
      <div className="aspect-square relative" style={{ backgroundColor: bgColor || DEFAULT_CAN_BG }}>
        {image ? (
          <>
            <img
              src={proxyImageUrl(image)}
              alt={name}
              crossOrigin="anonymous"
              className="w-full h-full object-contain"
              onError={e => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
            <div className="absolute inset-0 items-center justify-center" style={{ display: 'none' }}>
              <span className="text-lg opacity-20">🥤</span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-lg opacity-20">🥤</span>
          </div>
        )}
      </div>
      <div className="p-1.5">
        <p className="text-[10px] font-semibold text-foreground truncate">{name}</p>
        {rarityBadge}
      </div>
    </div>
  );
}

// The dedicated, purpose-built html2canvas capture source for both Profile's
// Top Pulls card and MonthlyReport's recap card — rendered hidden/off-screen
// by ShareCardModal, never shown to the user directly. Deliberately separate
// from CollectionCard (Profile's live, interactive trophy view): a shared
// component that's BOTH the on-screen interactive card AND the capture
// source is exactly what caused the two bugs this replaces (a live control's
// icon getting baked into the exported image as a dead pixel, and the two
// having to be conditionally un/mounted to avoid literally duplicating on
// screen). This template has no interactive elements at all — nothing here
// is ever clickable, so nothing here can end up as a fake control in the
// exported PNG.
//
// Real theme tokens throughout (hsl(var(--...))), not hardcoded hex — the
// prior monthly-recap version was cyan-and-black regardless of the viewer's
// actual Pro theme; this now reskins with Common/Verdant/Cobalt/Voidglass/
// Aurora like every other themed surface in the app.
const ShareCardTemplate = forwardRef(function ShareCardTemplate(
  {
    variant, // 'collection' | 'monthly'
    userName,
    rarityBreakdown = [],
    // collection variant
    score,
    rank,
    rarePulls,
    totalCans,
    top6 = [],
    getEffectiveRarity,
    // monthly variant
    monthLabel,
    cansAdded,
    monthScore,
    streak,
    bestPull,
    bestPullImage,
    bestPullRarity,
  },
  ref
) {
  const displayName = userName || 'Collector';

  return (
    <div
      ref={ref}
      className="relative w-[360px] overflow-hidden rounded-3xl p-6"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
        border: '1px solid hsl(var(--primary) / 0.25)',
      }}
    >
      {/* Corner glow accents — same primary/accent pairing as Home's
          hero-zone gradient, at card scale rather than page scale. */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-14 -left-14 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.1) 0%, transparent 70%)' }}
      />

      <div className="relative z-10">
        {/* Branding header — shared by both variants.
            Deliberately NOT a flex row, and the tagline/username paragraphs
            deliberately have no overflow/white-space/ellipsis utility on
            them. Both were confirmed, via isolated html2canvas repro
            against this exact component, to corrupt these custom-webfont
            glyphs into garbage characters in the exported PNG while the
            live DOM renders perfectly — an outer `justify-between` flex
            row breaks glyph layout on its text descendants, and so does
            `overflow-hidden` + `white-space: nowrap` (Tailwind `truncate`
            included) on the text node itself, with or without
            `text-overflow: ellipsis`. Long text is bounded by the
            max-w-[…]% wrappers below and simply wraps instead of
            truncating — acceptable since this template is only ever an
            off-screen capture source, never shown live. The inner
            icon+SIPPD flex row is unaffected and stays as flex. */}
        <div className="relative mb-4" style={{ height: 30 }}>
          <div className="absolute left-0 top-0 flex items-center gap-2 max-w-[70%]">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-display font-black text-primary tracking-[0.15em] leading-none">SIPPD</p>
              <p className="text-[8px] font-mono text-primary/50 tracking-wide mt-0.5">ENERGY DRINK TRACKER</p>
            </div>
          </div>
          <div className="absolute right-0 top-0 text-right max-w-[55%]">
            <p className="text-sm font-display font-bold text-foreground leading-tight">{displayName}</p>
            <p className="text-[11px] font-mono text-primary mt-0.5">
              {variant === 'monthly' ? `${monthLabel} Recap` : 'Collection Score'}
            </p>
          </div>
        </div>

        <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)' }} />

        {variant === 'monthly' ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Cans', value: cansAdded },
                { label: 'Score', value: `+${monthScore}` },
                { label: 'Streak', value: `${streak}d` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3 text-center border border-border" style={{ backgroundColor: 'hsl(var(--background) / 0.35)' }}>
                  <p className="text-xl font-mono font-black text-foreground tabular-nums">{value}</p>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
                </div>
              ))}
            </div>

            <p className="text-[10px] font-mono uppercase tracking-widest text-foreground mb-2">Best Pull of the Month</p>
            {bestPull ? (
              <div className="flex items-center gap-3 rounded-xl p-3 mb-4 border border-primary/20" style={{ backgroundColor: 'hsl(var(--background) / 0.35)' }}>
                <div className="w-16 h-16 flex-shrink-0">
                  <CanTile image={bestPullImage} bgColor={bestPull.can_bg_color} name="" rarityBadge={null} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono text-primary/70 uppercase tracking-wider truncate">{bestPull.can_brand}</p>
                  <p className="text-sm font-semibold text-foreground truncate">{bestPull.can_name}</p>
                  <RarityBadge rarity={bestPullRarity} size="sm" className="mt-1" />
                </div>
              </div>
            ) : (
              <p className="text-xs font-mono text-muted-foreground text-center py-4 mb-4">No pulls yet this month</p>
            )}
          </>
        ) : (
          <>
            <div
              className="rounded-2xl p-5 mb-3 text-center border"
              style={{
                backgroundColor: 'hsl(var(--background) / 0.35)',
                borderColor: 'hsl(var(--primary) / 0.3)',
                boxShadow: '0 0 24px hsl(var(--primary) / calc(0.1 * var(--glow-intensity)))',
              }}
            >
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
          </>
        )}

        {rarityBreakdown.length > 0 && (
          <div className={variant === 'collection' ? 'mb-5' : 'mb-1'}>
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

        {variant === 'collection' && top6.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {top6.map(item => (
              <CanTile
                key={item.id}
                image={item.can_image_url}
                bgColor={item.can_bg_color}
                name={item.can_name}
                rarityBadge={<RarityBadge rarity={getEffectiveRarity(item)} size="sm" />}
              />
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 text-center" style={{ borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
          <span className="text-[10px] font-mono text-primary/50 tracking-wide">
            {typeof window !== 'undefined' ? window.location.host : 'sippd.app'}
          </span>
        </div>
      </div>
    </div>
  );
});

export default ShareCardTemplate;
