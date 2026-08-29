import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import RarityBadge from '@/components/shared/RarityBadge';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { getDisplayRarity } from '@/lib/rarityConsensus';

export default function SpotlightCarousel({ collected, sharedCansMap, selectedBrand }) {
  const filtered = selectedBrand && selectedBrand !== 'All'
    ? collected.filter(item => item.can_brand === selectedBrand)
    : collected;
  const items = filtered.slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-display font-bold text-foreground">Recent Pulls</h3>
        {items.length > 0 && (
          <span className="text-[11px] font-mono text-muted-foreground">Swipe →</span>
        )}
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-2xl bg-card border border-border flex items-center justify-center text-center px-6 min-h-[190px]"
          style={{ width: 'min(65vw, 240px)' }}
        >
          <p className="text-sm font-mono text-muted-foreground">Add your first can to see it here</p>
        </div>
      ) : (
        <Carousel opts={{ align: 'start' }} className="w-full">
          <CarouselContent>
            {items.map(item => {
              const sharedCan = sharedCansMap[item.can_id];
              const rarity = sharedCan ? getDisplayRarity(sharedCan) : (item.can_rarity || 'Common');

              return (
                <CarouselItem key={item.id} className="basis-[min(65vw,240px)]">
                  <Link to={`/can/${item.can_id}`} className="block">
                    <div className="rounded-2xl overflow-hidden">
                      <div
                        className="flex items-center justify-center"
                        style={{ backgroundColor: item.can_bg_color || '#0D2B2B' }}
                      >
                        {item.can_image_url ? (
                          <img
                            src={item.can_image_url}
                            alt={item.can_name}
                            className="w-full h-[140px] object-contain"
                          />
                        ) : (
                          <div className="w-full h-[140px] flex items-center justify-center">
                            <Package className="w-10 h-10 text-white/20" />
                          </div>
                        )}
                      </div>
                      <div className="bg-card px-3 py-2.5 space-y-1.5">
                        <p className="text-sm font-semibold text-foreground truncate">{item.can_name}</p>
                        <div className="flex items-center justify-between gap-2">
                          <RarityBadge rarity={rarity} />
                          <span className="text-[10px] font-mono text-muted-foreground truncate">{item.can_brand}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      )}
    </div>
  );
}
