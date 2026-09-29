import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Star, CheckCircle, PackagePlus, Check } from 'lucide-react';
import RarityBadge from './RarityBadge';
import CanImageBox from './CanImageBox';
import { getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';
import { useFavourite } from '@/hooks/useFavourite';
import { cn } from '@/lib/utils';

export default function CanCard({ can, to, onClick, showStatus, sharedCan, onFavouriteToggle, onAddToCrate, selectable, selected, onToggleSelect }) {
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

  const handleAddToCrate = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCrate?.();
  };

  const handleCardClick = (e) => {
    if (selectable) {
      onToggleSelect?.();
      return;
    }
    onClick?.(e);
  };

  return (
    // Navigation is a full-area overlay Link (absolute inset-0, sibling of
    // the star/add-to-crate buttons) rather than an ancestor <Link> wrapping
    // them — nesting <button> inside <a> is invalid HTML and produces
    // unpredictable focus/click behavior, the same bug class CanListItem's
    // row was restructured to avoid. In selectable mode the Link is dropped
    // entirely (a tap should select, not navigate) and the whole card
    // becomes the tap target for toggling selection instead.
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={handleCardClick}
      className={cn(
        'relative bg-card border rounded-xl overflow-hidden cursor-pointer transition-all group',
        selectable && selected
          ? 'border-primary ring-2 ring-primary/50'
          : isFavourite
            ? 'border-primary/50 favourite-glow'
            : 'border-border hover:border-primary/30'
      )}
    >
      {to && !selectable && (
        <Link
          to={to}
          aria-label={name}
          className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}

      <div className="aspect-square relative overflow-hidden pointer-events-none">
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
            <span className="text-2xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/80 text-caution border border-caution/30">
              Low Conf.
            </span>
          )}
          {confidence === 'unrated' && (
            <span className="text-2xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground border border-border/60">
              Unrated
            </span>
          )}
        </div>

        {/* Bottom-right, not top-right — the star button already occupies
            that corner (absolute top-0 right-0, 44px) and would collide
            with a same-corner badge. */}
        {showStatus && can.status && (
          <div className="absolute bottom-2 right-2">
            <span className={`text-2xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
              can.status === 'collected' ? 'bg-rarity-uncommon/20 text-rarity-uncommon-text' :
              can.status === 'wishlist' ? 'bg-rarity-rare/20 text-rarity-rare-text' :
              'bg-muted-foreground/20 text-muted-foreground'
            }`}>
              {can.status === 'collected' ? '✓ Vault' : can.status === 'wishlist' ? '★ Want' : '⊕ Dupe'}
            </span>
          </div>
        )}

        {sharedCan?.verified && (
          <div className="absolute bottom-2 left-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <CheckCircle className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Star button — replaced by a selection checkbox in selectable mode,
          same corner/footprint so nothing shifts between the two modes. */}
      {selectable ? (
        can.id && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect?.(); }}
            aria-label={selected ? `Deselect ${name}` : `Select ${name}`}
            aria-pressed={selected}
            className="absolute top-0 right-0 z-10 w-11 h-11 rounded-full flex items-center justify-center"
          >
            <span className={cn(
              'w-6 h-6 rounded-full border-2 flex items-center justify-center backdrop-blur-sm transition-colors',
              selected ? 'bg-primary border-primary' : 'bg-background/70 border-border'
            )}>
              {selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
            </span>
          </button>
        )
      ) : can.id && (
        <button
          onClick={handleStar}
          disabled={isPending}
          aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={isFavourite}
          className="absolute top-0 right-0 z-10 w-11 h-11 rounded-full flex items-center justify-center transition-colors"
        >
          {/* Real tap target is the full 44px button above; this stays a
              small visual badge so it doesn't dominate a ~160px grid tile. */}
          <span className="w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors">
            <Star className={cn('w-3.5 h-3.5 transition-colors', isFavourite ? 'fill-primary text-primary' : 'text-muted-foreground')} />
          </span>
        </button>
      )}

      <div className="p-3 flex items-end justify-between gap-2 pointer-events-none">
        <div className="min-w-0">
          <p className="text-2xs font-mono text-muted-foreground uppercase tracking-wider truncate">{brand}</p>
          <h3 className="text-sm font-semibold text-foreground truncate mt-0.5">{name}</h3>
          {flavour && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{flavour}</p>
          )}
        </div>
        {!selectable && onAddToCrate && can.id && (
          <button
            onClick={handleAddToCrate}
            aria-label="Add to crate"
            className="relative z-10 pointer-events-auto w-11 h-11 rounded-lg bg-secondary/60 border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors flex-shrink-0"
          >
            <PackagePlus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
