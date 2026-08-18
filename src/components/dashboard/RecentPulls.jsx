import { Link } from 'react-router-dom';
import RarityBadge from '../shared/RarityBadge';
import { Package, ChevronRight } from 'lucide-react';

export default function RecentPulls({ recentItems }) {
  if (!recentItems || recentItems.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <h3 className="text-sm font-display font-semibold text-foreground tracking-wide">Recent Pulls</h3>
        <Link to="/collection" className="text-xs font-mono text-primary flex items-center gap-1">
          View All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {recentItems.slice(0, 5).map((item) => (
          <Link
            to={`/can/${item.can_id}`}
            key={item.id}
            className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
              {item.can_image_url ? (
                <img src={item.can_image_url} alt={item.can_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-4 h-4 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{item.can_name}</p>
              <p className="text-[11px] font-mono text-muted-foreground truncate">{item.can_brand}</p>
            </div>
            <RarityBadge rarity={item.can_rarity || 'Common'} />
          </Link>
        ))}
      </div>
    </div>
  );
}