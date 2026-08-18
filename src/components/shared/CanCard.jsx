import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import RarityBadge from './RarityBadge';
import CanImageBox from './CanImageBox';
import { getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';
import { useFavourite } from '@/hooks/useFavourite';
import { cn } from '@/lib/utils';

export default function CanCard({ can, onClick, showStatus, sharedCan, onFavouriteToggle }) {
  const name = can.can_name || can.name;
  const brand = can.can_brand || can.brand;
  const imageUrl = can.can_image_url || can.image_url || sharedCan?.image_url;
  const confidence = sharedCan ? getConfidence(sharedCan.total_votes) : 'confirmed';
  const rarity = confidence === 'unrated' ? '???' : (sharedCan ? getDisplayRarity(sharedCan) : (can.can_rarity || can.rarity || 'Common'));
  const flavour = can.can_flavour || can.flavour;
  const isFavourite = can.is_favourite || false;

  const { toggleFavourite, isPending } = useFavourite();

  const handleStar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!can.id) return;
    toggleFavourite({ collectionItem: can, sharedCan });
    onFavouriteToggle?.();
  };

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        'bg-card border rounded-xl overflow-hidden cursor-pointer transition-all group',
        isFavourite
          ? 'border-primary/50 shadow-[0_0_12px_rgba(0,255,255,0.12)]'
          : 'border-border hover:border-primary/30'
      )}
    >
      <div className="aspect-square relative overflow-hidden">
        <CanImageBox
          imageUrl={imageUrl}
          bgColor={can.can_bg_color}
          alt={name}
          className="w-full h-full group-hover:scale-105 transition-transform duration-300"
          iconSize="w-10 h-10"
        />
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <RarityBadge rarity={rarity} />
          {confidence === 'low' && (
            <span className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/80 text-yellow-400 border border-yellow-400/30">
              Low Conf.
            </span>
          )}
          {confidence === 'unrated' && (
            <span className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground border border-border/60">
              Unrated
            </span>
          )}
        </div>

        {/* Star button */}
        {can.id && (
          <button
            onClick={handleStar}
            disabled={isPending}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-background/90"
          >
            <Star className={cn('w-3.5 h-3.5 transition-colors', isFavourite ? 'fill-primary text-primary' : 'text-muted-foreground')} />
          </button>
        )}

        {showStatus && can.status && !can.id && (
          <div className="absolute top-2 right-2">
            <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
              can.status === 'collected' ? 'bg-rarity-uncommon/20 text-rarity-uncommon' :
              can.status === 'wishlist' ? 'bg-rarity-rare/20 text-rarity-rare' :
              'bg-muted-foreground/20 text-muted-foreground'
            }`}>
              {can.status === 'collected' ? '✓ Vault' : can.status === 'wishlist' ? '★ Want' : '⊕ Dupe'}
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-[11px] font-mono text-primary/70 uppercase tracking-wider truncate">{brand}</p>
        <h3 className="text-sm font-semibold text-foreground truncate mt-0.5">{name}</h3>
        {flavour && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{flavour}</p>
        )}
      </div>
    </motion.div>
  );
}