import { Link } from 'react-router-dom';
import CanImageBox from '@/components/shared/CanImageBox';
import RarityBadge from '@/components/shared/RarityBadge';
import { getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';
import { byAcquiredDesc } from '@/lib/canDate';

// Card width tracks 80vw, capped at 280px so it doesn't get absurd on
// tablet-width viewports. At the common 375px mobile viewport, the 280px
// cap is what actually governs (80vw would be 300px there), leaving
// roughly a 13% peek of the next card past the page's own px-5 padding —
// narrower than 80vw's own ~20% margin, since the cap is doing the work.
const CARD_WIDTH = 'min(80vw, 280px)';

export default function SpotlightCarousel({ collected, sharedCansMap, selectedBrand, isLoading = false }) {
  // Same rule as CanCard: a can without enough community votes is unrated
  // ('???', the neutral tile and badge), not shown as Common.
  const rarityOf = item => {
    const sharedCan = sharedCansMap[item.can_id];
    if (sharedCan && getConfidence(sharedCan.total_votes) === 'unrated') return '???';
    return sharedCan ? getDisplayRarity(sharedCan) : (item.can_rarity || 'Common');
  };
  const filtered = selectedBrand && selectedBrand !== 'All'
    ? collected.filter(item => item.can_brand === selectedBrand)
    : collected;
  // Newest first by when the collector got each can (their own date, else
  // when logged).
  const items = [...filtered].sort(byAcquiredDesc).slice(0, 8);

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between px-5 mb-3">
          <h2 className="text-base font-display font-bold text-foreground">Recent Pulls</h2>
        </div>
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
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-base font-display font-bold text-foreground">Recent Pulls</h2>
        {items.length > 0 && (
          <span className="text-2xs font-mono text-muted-foreground">Swipe →</span>
        )}
      </div>

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
    </div>
  );
}
