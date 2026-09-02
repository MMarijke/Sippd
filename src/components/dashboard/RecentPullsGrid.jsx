import { Link } from 'react-router-dom';
import CanImageBox from '@/components/shared/CanImageBox';
import RarityBadge from '@/components/shared/RarityBadge';
import { getDisplayRarity } from '@/lib/rarityConsensus';

export default function RecentPullsGrid({ collected, sharedCansMap = {} }) {
  const items = collected.slice(0, 3);
  const placeholderCount = Math.max(0, 3 - items.length);

  return (
    <div>
      <h3 className="text-base font-display font-bold text-foreground px-5 mb-3">Recent Pulls</h3>

      <div className="grid grid-cols-3 gap-3 px-5">
        {items.map(item => {
          const sharedCan = sharedCansMap[item.can_id];
          const rarity = sharedCan ? getDisplayRarity(sharedCan) : (item.can_rarity || 'Common');

          return (
            <Link key={item.id} to={`/can/${item.can_id}`} className="block">
              <div className="rounded-xl overflow-hidden">
                <CanImageBox
                  imageUrl={item.can_image_url}
                  bgColor={item.can_bg_color}
                  alt={item.can_name}
                  className="w-full aspect-square"
                  iconSize="w-8 h-8"
                />
                <div className="bg-card px-2 py-2 space-y-1">
                  <p className="text-xs font-semibold text-foreground truncate">{item.can_name}</p>
                  <RarityBadge rarity={rarity} className="text-[9px] px-1.5 py-0.5" />
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{item.can_brand}</p>
                </div>
              </div>
            </Link>
          );
        })}

        {Array.from({ length: placeholderCount }).map((_, i) => (
          <div key={`placeholder-${i}`} className="rounded-xl overflow-hidden">
            <CanImageBox className="w-full aspect-square" iconSize="w-8 h-8" />
            <div className="bg-card px-2 py-2">
              <p className="text-[10px] font-mono text-muted-foreground">Empty</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
