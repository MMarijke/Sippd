import { Link } from 'react-router-dom';
import CanImageBox from '@/components/shared/CanImageBox';
import RarityBadge from '@/components/shared/RarityBadge';
import { getDisplayRarity, RARITY_ORDER } from '@/lib/rarityConsensus';
import { cn } from '@/lib/utils';

// Card width tracks 80vw, capped at 280px so it doesn't get absurd on
// tablet-width viewports. At the common 375px mobile viewport, the 280px
// cap is what actually governs (80vw would be 300px there), leaving
// roughly a 13% peek of the next card past the page's own px-5 padding —
// narrower than 80vw's own ~20% margin, since the cap is doing the work.
const CARD_WIDTH = 'min(80vw, 280px)';

const VIEWS = [
  { value: 'recent', label: 'Recent' },
  { value: 'rarest', label: 'Rarest' },
];

const tierIndex = rarity => RARITY_ORDER.indexOf(rarity);

// Your cans, second on Home right after your standing (they used to sit
// ~1000px down, under the stats and the feed). Recent is your latest pulls;
// Rarest is your best ones, rarest tier first and newest first within it.
// `filters` (the brand chips) render between the heading and the cards.
export default function SpotlightCarousel({ collected, sharedCansMap, selectedBrand, isLoading = false, view = 'recent', onViewChange, filters = null }) {
  const rarityOf = item => {
    const sharedCan = sharedCansMap[item.can_id];
    return sharedCan ? getDisplayRarity(sharedCan) : (item.can_rarity || 'Common');
  };
  const filtered = selectedBrand && selectedBrand !== 'All'
    ? collected.filter(item => item.can_brand === selectedBrand)
    : collected;
  const ordered = view === 'rarest'
    // Stable sort: equal tiers keep the collection's newest-first order.
    ? [...filtered].sort((a, b) => tierIndex(rarityOf(b)) - tierIndex(rarityOf(a)))
    : filtered;
  const items = ordered.slice(0, 8);

  const header = (
    <div className="flex items-center justify-between gap-3 px-5 mb-3">
      <h2 className="text-base font-display font-bold text-foreground">Your cans</h2>
      {onViewChange && (
        <div role="group" aria-label="Show" className="flex rounded-lg border border-border p-0.5">
          {VIEWS.map(v => (
            <button
              key={v.value}
              type="button"
              aria-pressed={view === v.value}
              onClick={() => onViewChange(v.value)}
              className={cn('h-11 px-3 rounded-md font-mono text-xs transition-colors',
                view === v.value ? 'bg-card text-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <section aria-label="Your cans">
        {header}
        <div className="flex gap-3 overflow-x-auto scrollbar-none px-5 pb-1">
          {[0, 1].map(i => (
            <div
              key={i}
              className="flex-shrink-0 rounded-2xl bg-card border border-border overflow-hidden"
              style={{ width: CARD_WIDTH }}
            >
              <div className="w-full h-[140px] bg-secondary/60 animate-pulse" />
              <div className="px-3 py-2.5 space-y-2">
                <div className="h-3.5 w-2/3 rounded bg-secondary/60 animate-pulse" />
                <div className="h-3 w-1/3 rounded bg-secondary/60 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Your cans">
      {header}
      {filters}

      {items.length === 0 ? (
        <div className="px-5">
          <div
            className="rounded-2xl bg-card border border-border flex items-center justify-center text-center px-6 min-h-[190px]"
            style={{ width: CARD_WIDTH }}
          >
            <p className="text-sm font-mono text-muted-foreground">
              {selectedBrand && selectedBrand !== 'All' ? `No ${selectedBrand} cans yet` : 'Add your first can to see it here'}
            </p>
          </div>
        </div>
      ) : (
        // scroll-px-5: snap points respect the page gutter, so the first
        // card no longer snaps flush against the screen edge.
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-5 scrollbar-none px-5 pb-1">
          {items.map(item => {
            const rarity = rarityOf(item);
            return (
              <Link
                key={item.id}
                to={`/can/${item.can_id}`}
                className="flex-shrink-0 snap-start block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ width: CARD_WIDTH }}
              >
                <div className="rounded-2xl overflow-hidden border border-border">
                  <CanImageBox
                    imageUrl={item.can_image_url}
                    rarity={rarity}
                    alt={item.can_name}
                    className="w-full h-[140px]"
                    iconSize="w-10 h-10"
                  />
                  <div className="bg-card px-3 py-2.5 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">{item.can_name}</p>
                    <div className="flex items-center justify-between gap-2">
                      <RarityBadge rarity={rarity} />
                      <span className="text-2xs font-mono text-muted-foreground truncate">{item.can_brand}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
