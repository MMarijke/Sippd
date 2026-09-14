import { Link } from 'react-router-dom';
import RarityBadge from '../shared/RarityBadge';
import { Package, PackagePlus, ChevronRight, Check } from 'lucide-react';
import { getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';
import { cn } from '@/lib/utils';

export default function CanListItem({ item, sharedCan, onAddToCrate, selectable, selected, onToggleSelect }) {
  const confidence = sharedCan ? getConfidence(sharedCan.total_votes) : 'confirmed';
  const rarity = confidence === 'unrated' ? '???' : (sharedCan ? getDisplayRarity(sharedCan) : (item.can_rarity || 'Common'));

  return (
    // The row's own navigation is a full-area overlay Link (absolute inset-0)
    // rather than wrapping every child in an <a>, so the "Add to crate"
    // button below can be a real sibling instead of a <button> nested
    // inside an <a> — nesting interactive elements is invalid HTML and
    // produces unpredictable focus/click behavior. In selectable mode the
    // Link is dropped (a tap should select, not navigate) and the row
    // itself becomes the tap target for toggling selection.
    <div
      onClick={selectable ? onToggleSelect : undefined}
      className={cn(
        'relative flex items-center gap-3 p-3 bg-card border rounded-xl transition-all',
        selectable ? 'cursor-pointer' : 'hover:border-primary/30',
        selectable && selected ? 'border-primary ring-1 ring-primary' : 'border-border'
      )}
    >
      {!selectable && (
        <Link
          to={`/can/${item.can_id}`}
          aria-label={item.can_name}
          className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}
      <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0 pointer-events-none">
        {item.can_image_url ? (
          <img src={item.can_image_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-5 h-5 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 pointer-events-none">
        <p className="text-sm font-semibold text-foreground truncate">{item.can_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] font-mono text-muted-foreground">{item.can_brand}</span>
          <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
            item.status === 'collected' ? 'bg-rarity-uncommon/15 text-rarity-uncommon' :
            item.status === 'wishlist' ? 'bg-rarity-rare/15 text-rarity-rare' :
            'bg-muted text-muted-foreground'
          }`}>
            {item.status === 'collected' ? 'Vault' : item.status === 'wishlist' ? 'Want' : 'Dupe'}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 pointer-events-none">
        <RarityBadge rarity={rarity} />
        {confidence === 'low' && (
          <span className="text-[8px] font-mono uppercase tracking-wider px-1 py-0.5 rounded text-yellow-400 border border-yellow-400/30">
            Low Conf.
          </span>
        )}
        {confidence === 'unrated' && (
          <span className="text-[8px] font-mono uppercase tracking-wider px-1 py-0.5 rounded text-muted-foreground border border-border/60">
            Unrated
          </span>
        )}
      </div>
      {selectable ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
          aria-label={selected ? `Deselect ${item.can_name}` : `Select ${item.can_name}`}
          aria-pressed={selected}
          className="relative z-10 w-11 h-11 flex items-center justify-center flex-shrink-0"
        >
          <span className={cn(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
            selected ? 'bg-primary border-primary' : 'bg-background border-border'
          )}>
            {selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
          </span>
        </button>
      ) : (
        <>
          {onAddToCrate && (
            <button
              onClick={onAddToCrate}
              aria-label="Add to crate"
              className="relative z-10 w-11 h-11 rounded-lg bg-secondary/60 border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors flex-shrink-0"
            >
              <PackagePlus className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 pointer-events-none" />
        </>
      )}
    </div>
  );
}
