import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Pin, Share2, X as XIcon, Zap, Star } from 'lucide-react';
import RarityBadge from '@/components/shared/RarityBadge';
import { MAX_PINS } from '@/hooks/useTogglePin';
import { RARITY_BG_CLASS } from '@/lib/rarityConsensus';
import { proxyImageUrl } from '@/lib/cardCapture';

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
          className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center flex-shrink-0"
        >
          {sharing ? <XIcon className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border mb-5">
        {[
          { icon: Zap, label: 'Score', value: score, badge: rank ? `#${rank}` : null },
          { icon: Star, label: 'Rare Pulls', value: rarePulls },
          { icon: Zap, label: 'Cans', value: totalCans },
        ].map(({ icon: Icon, label, value, badge }) => (
          <div key={label} className="flex flex-col items-center text-center px-1">
            <Icon className="w-3.5 h-3.5 text-primary mb-1" />
            <span className="text-xl font-mono font-bold text-foreground tabular-nums">{value}</span>
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
            {badge && (
              <span className="mt-1 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[9px] font-mono font-semibold text-primary">
                {badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {rarityBreakdown.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary/60 mb-2">Rarity Breakdown</p>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
            {rarityBreakdown.map(({ rarity, pct }) => (
              <div key={rarity} className={`h-full ${RARITY_BG_CLASS[rarity]}`} style={{ width: `${pct}%` }} />
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
              <div className="aspect-square" style={{ backgroundColor: item.can_bg_color || '#0D2B2B' }}>
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
