import { forwardRef } from 'react';
import { Zap, CupSoda } from 'lucide-react';
import { DEFAULT_CAN_BG } from '@/lib/canBgColors';
import { proxyImageUrl } from '@/lib/cardCapture';
import RarityBadge from '@/components/shared/RarityBadge';
import { BREAKDOWN_VAR } from '@/lib/rarityConsensus';

// Rarity Breakdown bar — theme-aware --breakdown-* ramp, matching
// CollectionCard's and RarityHero's proportion charts elsewhere in the
// app (deliberately switched from the theme-invariant --rarity-* tokens
// RarityBadge itself still uses — a shared/exported card reflecting the
// owner's chosen theme was judged more valuable than exported images
// looking identical across every theme, unlike a can's own badge color,
// which stays fixed for a different reason: it's the one true rarity
// value being asserted, not a personalization choice).

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
            {/* A real SVG icon, not an emoji: 🥤 has no reliable color-emoji
                glyph on every OS/browser combination and was rendering as an
                ambiguous monochrome box that read as a delete/trash icon —
                confirmed in both the live DOM and the captured PNG, so this
                wasn't an html2canvas quirk, it was the emoji itself. */}
            <div className="absolute inset-0 items-center justify-center" style={{ display: 'none' }}>
              <CupSoda className="w-5 h-5 text-muted-foreground/40" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CupSoda className="w-5 h-5 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="p-1.5">
        {/* No `truncate` — overflow-hidden + white-space:nowrap on a text
            node (with or without text-overflow:ellipsis) corrupts
            html2canvas's rendering of this custom webfont text, the same
            bug already fixed on the header below. The tile's own
            overflow-hidden still contains it; a long name just wraps. */}
        <p className="text-[10px] font-semibold text-foreground">{name}</p>
        {rarityBadge}
      </div>
    </div>
  );
}

// The dedicated, purpose-built html2canvas capture source for
// MonthlyReport's recap card — rendered hidden/off-screen by
// RecapShareModal, never shown to the user directly.
//
// Monthly-Report-only on purpose, not a generic ShareCardTemplate with a
// variant switch: this used to also render Profile's Top Pulls card
// behind a `variant` prop, and that sharing was the exact mechanism
// behind this session's font-corruption, rarity-color, and layout-overflow
// bugs — a fix made for one variant's needs (or a regression in one)
// silently changed the other's rendering too. Profile now shares a live
// collection link instead of exporting an image (see ShareCardModal's
// removal from Profile.jsx and useShare.js's copyLink/shareLink), so
// there is exactly one remaining consumer of this capture pipeline and
// exactly one card shape to reason about. Keep it that way — if Profile
// ever needs an exportable image again, give it its own template rather
// than reintroducing a variant switch here.
//
// Real theme tokens throughout (hsl(var(--...))), not hardcoded hex — the
// original monthly-recap version was cyan-and-black regardless of the
// viewer's actual Pro theme; this reskins with Common/Verdant/Cobalt/
// Voidglass/Aurora like every other themed surface in the app.
const RecapCardTemplate = forwardRef(function RecapCardTemplate(
  {
    userName,
    rarityBreakdown = [],
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
          hero-zone gradient, at card scale rather than page scale.
          Alphas now multiplied by --glow-intensity, matching that same
          gating on .home-gradient-bg-layer -- these were the two glow
          surfaces in the app quietly contradicting Field Guide/Origami
          Fold's "zero glow" invariant. (/impeccable critique) */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary) / calc(0.14 * var(--glow-intensity))) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-14 -left-14 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(var(--accent) / calc(0.1 * var(--glow-intensity))) 0%, transparent 70%)' }}
      />

      <div className="relative z-10">
        {/* Branding header.
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
              {/* Genericized -- Sippd covers soft drinks too now, not just
                  energy drinks, matching the same tagline update already
                  made to index.html/manifest.json. This template feeds a
                  one-way-door html2canvas export (see the doc comment
                  above), so this couldn't be fixed retroactively in
                  already-shared recap images, only in new ones going
                  forward. (/impeccable critique) */}
              <p className="text-[8px] font-mono text-muted-foreground tracking-wide mt-0.5">CAN COLLECTION TRACKER</p>
            </div>
          </div>
          <div className="absolute right-0 top-0 text-right max-w-[55%]">
            <p className="text-sm font-display font-bold text-foreground leading-tight">{displayName}</p>
            <p className="text-[11px] font-mono text-primary mt-0.5">{monthLabel} Recap</p>
          </div>
        </div>

        <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)' }} />

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
            {/* No `truncate` — same html2canvas text-corruption bug as
                the header and CanTile's name, see those notes. */}
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-primary/70 uppercase tracking-wider">{bestPull.can_brand}</p>
              <p className="text-sm font-semibold text-foreground">{bestPull.can_name}</p>
              <RarityBadge rarity={bestPullRarity} size="sm" className="mt-1" />
            </div>
          </div>
        ) : (
          <p className="text-xs font-mono text-muted-foreground text-center py-4 mb-4">No pulls yet this month</p>
        )}

        {rarityBreakdown.length > 0 && (
          <div className="mb-1">
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

        <div className="mt-4 pt-3 text-center" style={{ borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
          <span className="text-[10px] font-mono text-primary/50 tracking-wide">
            {typeof window !== 'undefined' ? window.location.host : 'sippd.app'}
          </span>
        </div>
      </div>
    </div>
  );
});

export default RecapCardTemplate;
