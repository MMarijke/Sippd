import { useNavigate } from 'react-router-dom';
import { Flame, Package, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RarityBadge from '@/components/shared/RarityBadge';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const EMOJI_MAP = { fire: '🔥', star: '⭐', wow: '😮' };

export default function ActivityCard({ item, user, myReactionSet, onReact }) {
  const navigate = useNavigate();

  const timeAgo = item.created_date
    ? formatDistanceToNow(new Date(item.created_date), { addSuffix: true })
    : '';

  const openProfile = (e) => {
    e.stopPropagation();
    // find user id — stored in user_id field
    if (item.user_id) navigate(`/u/${item.user_id}`);
  };

  const renderAction = () => {
    switch (item.type) {
      case 'can_added':
        return (
          <span className="text-foreground">
            added <span className="font-semibold">{item.can_name}</span> to their vault
          </span>
        );
      case 'rarity_voted':
        return (
          <span className="text-foreground">
            voted <RarityBadge rarity={item.can_rarity} size="sm" className="mx-0.5 inline-flex" /> on <span className="font-semibold">{item.can_name}</span>
          </span>
        );
      case 'achievement_unlocked':
        return (
          <span className="text-foreground">
            unlocked the <span className="font-semibold">{item.achievement_title}</span> achievement {item.achievement_icon}
          </span>
        );
      case 'streak_milestone':
        return (
          <span className="text-foreground">
            🔥 reached a <span className="font-semibold">{item.streak_days} day</span> streak
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={openProfile} className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-display font-bold text-primary hover:bg-primary/20 transition-colors">
          {item.user_name?.[0]?.toUpperCase() || '?'}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={openProfile} className="text-sm font-semibold text-foreground hover:text-primary transition-colors text-left">
            {item.user_name || 'Collector'}
          </button>
          <p className="text-[11px] font-mono text-muted-foreground">{timeAgo}</p>
        </div>

        {/* Can thumbnail */}
        {(item.type === 'can_added' || item.type === 'rarity_voted') && item.can_image_url && (
          <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
            <img src={item.can_image_url} alt={item.can_name} className="w-full h-full object-cover" />
          </div>
        )}
        {(item.type === 'can_added' || item.type === 'rarity_voted') && !item.can_image_url && (
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-muted-foreground/30" />
          </div>
        )}
        {item.type === 'achievement_unlocked' && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-xl">
            {item.achievement_icon || '🏆'}
          </div>
        )}
      </div>

      {/* Action text */}
      <p className="text-sm font-mono text-muted-foreground leading-relaxed">
        {renderAction()}
      </p>

      {/* Rarity badge for can_added */}
      {item.type === 'can_added' && (
        <div className="flex items-center justify-between">
          {item.can_rarity ? (
            <RarityBadge rarity={item.can_rarity} />
          ) : (
            <span className="text-[10px] font-mono text-muted-foreground border border-border rounded px-2 py-0.5">? ? ?</span>
          )}
        </div>
      )}

      {/* Reaction row */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        {['fire', 'star', 'wow'].map(emoji => {
          const count = emoji === 'fire' ? item.reactions_fire : emoji === 'star' ? item.reactions_star : item.reactions_wow;
          const reacted = myReactionSet?.has(`${item.id}:${emoji}`);
          return (
            <button
              key={emoji}
              onClick={() => onReact(item, emoji)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono border transition-all',
                reacted
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-secondary border-border text-muted-foreground hover:border-primary/20 hover:text-foreground'
              )}
            >
              {EMOJI_MAP[emoji]} {count > 0 ? count : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}