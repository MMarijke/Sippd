import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Radio, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import ActivityCard from '@/components/feed/ActivityCard';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function Feed() {
  const [tab, setTab] = useState('global');
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: allActivity = [], isLoading, refetch } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => base44.entities.ActivityItem.list('-created_date', 50),
    enabled: !!user?.id,
    refetchOnMount: true,
  });

  const { data: follows = [] } = useQuery({
    queryKey: ['my-follows', user?.id],
    queryFn: () => base44.entities.Follow.filter({ follower_id: user.id }, '-created_date', 200),
    enabled: !!user?.id,
  });

  const { data: myReactions = [] } = useQuery({
    queryKey: ['my-reactions', user?.id],
    queryFn: () => base44.entities.Reaction.list('-created_date', 500),
    enabled: !!user?.id,
  });

  const myReactionSet = new Set(myReactions.map(r => `${r.activity_id}:${r.emoji}`));

  // IDs of people I follow (accepted)
  const followingIds = new Set(
    follows.filter(f => f.follower_id === user?.id && f.status === 'accepted').map(f => f.following_id)
  );

  const filtered = allActivity.filter(item => {
    if (tab === 'global') {
      return !item.is_private_user && item.user_id !== user?.id;
    } else {
      // following tab: my follows + my own
      return followingIds.has(item.user_id) || item.user_id === user?.id;
    }
  });

  const reactMutation = useMutation({
    mutationFn: async ({ activityId, emoji, currentCount, fieldName, alreadyReacted }) => {
      if (alreadyReacted) return; // no double react
      await base44.entities.Reaction.create({
        activity_id: activityId,
        reactor_email: user.email,
        reactor_name: user.full_name || user.email,
        emoji,
      });
      await base44.entities.ActivityItem.update(activityId, {
        [fieldName]: (currentCount || 0) + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
      queryClient.invalidateQueries({ queryKey: ['my-reactions'] });
    },
  });

  const handleReact = (item, emoji) => {
    if (!user) return;
    const fieldName = emoji === 'fire' ? 'reactions_fire' : emoji === 'star' ? 'reactions_star' : 'reactions_wow';
    const currentCount = item[fieldName] || 0;
    const alreadyReacted = myReactionSet.has(`${item.id}:${emoji}`);
    reactMutation.mutate({ activityId: item.id, emoji, currentCount, fieldName, alreadyReacted });
  };

  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <div className="space-y-0 pb-24">
      <PageHeader
        title="Feed"
        subtitle="Community activity"
        action={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      {/* Tab toggle */}
      <div className="px-5 pb-4">
        <div className="flex bg-secondary rounded-lg border border-border p-0.5">
          <button
            className={cn('flex-1 h-8 font-mono text-xs rounded-md transition-colors gap-1.5 flex items-center justify-center',
              tab === 'global' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab('global')}
          >
            <Radio className="w-3.5 h-3.5" /> Global
          </button>
          <button
            className={cn('flex-1 h-8 font-mono text-xs rounded-md transition-colors gap-1.5 flex items-center justify-center',
              tab === 'following' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab('following')}
          >
            <Users className="w-3.5 h-3.5" /> Following
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-4 py-20 px-8 text-center">
          {tab === 'following' ? (
            <>
              <Users className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm font-mono text-muted-foreground">Follow other collectors to see their activity here</p>
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-xs border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => navigate('/leaderboard')}
              >
                Find Collectors
              </Button>
            </>
          ) : (
            <>
              <Radio className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm font-mono text-muted-foreground">No activity yet — be the first to scan a can!</p>
            </>
          )}
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {filtered.map(item => (
            <ActivityCard
              key={item.id}
              item={item}
              user={user}
              myReactionSet={myReactionSet}
              onReact={handleReact}
            />
          ))}
        </div>
      )}
    </div>
  );
}