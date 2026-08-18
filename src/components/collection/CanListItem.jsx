import { Link } from 'react-router-dom';
import RarityBadge from '../shared/RarityBadge';
import { Package, ChevronRight } from 'lucide-react';
import { getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';

export default function CanListItem({ item, sharedCan }) {
  const confidence = sharedCan ? getConfidence(sharedCan.total_votes) : 'confirmed';
  const rarity = confidence === 'unrated' ? '???' : (sharedCan ? getDisplayRarity(sharedCan) : (item.can_rarity || 'Common'));
  return (
    <Link
      to={`/can/${item.can_id}`}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/30 transition-all"
    >
      <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
        {item.can_image_url ? (
          <img src={item.can_image_url} alt={item.can_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-5 h-5 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
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
      <div className="flex flex-col items-end gap-1">
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
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}