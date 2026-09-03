import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Radio, RefreshCw, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import RarityBadge from '@/components/shared/RarityBadge';

function renderAction(item) {
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
}

export default function FeedPreview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['feed-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const goToFeed = (e, tab) => {
    e.stopPropagation();
    navigate(tab === 'following' ? '/feed?tab=following' : '/feed');
  };

  const handleRefresh = (e) => {
    e.stopPropagation();
    refetch();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/feed')}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate('/feed'); }}
      className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground tracking-wide">Feed</h3>
          <p className="text-[11px] font-mono text-muted-foreground">Community activity</p>
        </div>
        <button
          onClick={handleRefresh}
          aria-label="Refresh feed"
          className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex bg-secondary rounded-lg border border-border p-0.5 mb-3">
        <button
          onClick={(e) => goToFeed(e, 'global')}
          className="flex-1 h-7 font-mono text-[11px] rounded-md transition-colors gap-1.5 flex items-center justify-center bg-card text-primary shadow-sm"
        >
          <Radio className="w-3 h-3" /> Global
        </button>
        <button
          onClick={(e) => goToFeed(e, 'following')}
          className="flex-1 h-7 font-mono text-[11px] rounded-md transition-colors gap-1.5 flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <Users className="w-3 h-3" /> Following
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-11 rounded-xl bg-secondary/60 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs font-mono text-muted-foreground">No activity yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-display font-bold text-primary">
                {item.user_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-muted-foreground truncate leading-relaxed">
                  <span className={cn('text-foreground font-semibold')}>{item.user_name || 'Collector'}</span>{' '}
                  {renderAction(item)}
                </p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
