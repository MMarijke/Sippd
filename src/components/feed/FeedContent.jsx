import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Radio, RefreshCw, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ActivityCard from '@/components/feed/ActivityCard';
import { useMyFollows } from '@/hooks/useFollow';
import { useProStatus } from '@/hooks/useProStatus';
import { cn } from '@/lib/utils';

// Extracted from the standalone Feed page (/impeccable critique: Feed
// merged into Leaderboard/Ranks as a 4th tab, reusing the same
// aria-pressed segmented-tab pattern already proven for
// Collectors/Regional/Most Wanted) — this is the actual feed body, with
// no PageHeader of its own, so it composes under whichever page's header
// is already on screen (Feed.jsx itself, or Leaderboard.jsx's Ranks tab).
// The Global/Following scope toggle and the manual refresh button both
// live here rather than in a parent's header action slot, since only this
// component knows about `tab`/`refetch`.
export default function FeedContent({ defaultTab = 'global' }) {
  const [tab, setTab] = useState(defaultTab);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: allActivity = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchOnMount: true,
  });

  const { data: follows = [] } = useMyFollows(user?.id);

  const { data: myReactions = [] } = useQuery({
    queryKey: ['my-reactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reactions')
        .select('*')
        .eq('reactor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const myReactionSet = new Set(myReactions.map(r => `${r.activity_id}:${r.emoji}`));

  const followingIds = new Set(
    follows.filter(f => f.follower_id === user?.id && f.status === 'accepted').map(f => f.following_id)
  );

  // RLS (activity_items_select_visible) already restricts allActivity to
  // rows this user is allowed to see — a private account's posts are never
  // fetched here unless we're an accepted follower or it's our own, and a
  // public account's posts are visible to everyone. Global shows everything
  // RLS already returned, self included. Following narrows further to just
  // the people we follow (plus ourselves).
  const filtered = allActivity.filter(item => {
    if (tab === 'global') {
      return true;
    } else {
      return followingIds.has(item.user_id) || item.user_id === user?.id;
    }
  });

  // Trophy Case badge — one batched lookup per mount for every poster
  // currently visible, not one query per card.
  const proUserIds = useProStatus(filtered.map(item => item.user_id));

  const REACTION_COUNT_FIELD = { fire: 'reactions_fire', star: 'reactions_star', wow: 'reactions_wow' };

  const reactMutation = useMutation({
    mutationFn: async ({ activityId, emoji }) => {
      const { error } = await supabase.rpc('react_to_activity', {
        p_caller_id: user.id,
        p_activity_id: activityId,
        p_emoji: emoji,
      });
      if (error) throw error;
    },
    // Optimistic so the tap feels instant instead of waiting on a full
    // refetch — rolled back in onError, reconciled with the server in
    // onSettled either way.
    onMutate: async ({ activityId, emoji }) => {
      await queryClient.cancelQueries({ queryKey: ['activity-feed'] });
      await queryClient.cancelQueries({ queryKey: ['my-reactions', user?.id] });

      const previousActivity = queryClient.getQueryData(['activity-feed']);
      const previousReactions = queryClient.getQueryData(['my-reactions', user?.id]);
      const field = REACTION_COUNT_FIELD[emoji];

      queryClient.setQueryData(['activity-feed'], (old = []) =>
        old.map(item => item.id === activityId ? { ...item, [field]: (item[field] || 0) + 1 } : item)
      );
      queryClient.setQueryData(['my-reactions', user?.id], (old = []) => [
        ...old,
        { activity_id: activityId, reactor_id: user.id, emoji },
      ]);

      return { previousActivity, previousReactions };
    },
    onError: (error, variables, context) => {
      if (context?.previousActivity) queryClient.setQueryData(['activity-feed'], context.previousActivity);
      if (context?.previousReactions) queryClient.setQueryData(['my-reactions', user?.id], context.previousReactions);
      toast.error(error.message || 'Failed to react');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
      queryClient.invalidateQueries({ queryKey: ['my-reactions'] });
    },
  });

  const handleReact = (item, emoji) => {
    if (!user) return;
    // The DB allows one reaction per post, not one per emoji
    // (reactions_activity_id_reactor_id_key) — this only checks the exact
    // item:emoji pair, so tapping a *different* emoji after already
    // reacting passed this guard and hit the RPC's own rejection instead.
    // The buttons are disabled for this case too (ActivityCard.jsx), but
    // the handler stays defensive against being called directly.
    const hasAnyReaction = ['fire', 'star', 'wow'].some(e => myReactionSet.has(`${item.id}:${e}`));
    if (hasAnyReaction) return;
    reactMutation.mutate({ activityId: item.id, emoji });
  };

  const isEmpty = !isLoading && !isError && filtered.length === 0;
  const followsNobody = followingIds.size === 0;

  return (
    <div>
      <div className="px-5 pb-4 flex items-center gap-2">
        {/* Segmented filter, not a tab set — role="tab"/tablist implies
            arrow-key navigation between options, which this never
            implemented. Standardized on the aria-pressed pattern already
            used correctly elsewhere (Home's brand filter,
            CollectorsLeaderboard's metric toggle). */}
        <div aria-label="Feed scope" className="flex-1 flex bg-secondary rounded-lg border border-border p-0.5">
          <button
            type="button"
            aria-pressed={tab === 'global'}
            className={cn('flex-1 h-11 font-mono text-xs rounded-md transition-colors gap-1.5 flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              tab === 'global' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab('global')}
          >
            <Radio className="w-3.5 h-3.5" /> Global
          </button>
          <button
            type="button"
            aria-pressed={tab === 'following'}
            className={cn('flex-1 h-11 font-mono text-xs rounded-md transition-colors gap-1.5 flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              tab === 'following' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab('following')}
          >
            <Users className="w-3.5 h-3.5" /> Following
          </button>
        </div>
        {/* A tab switch remounts this component (refetchOnMount already
            covers "I just got here"), so this is for the narrower case of
            wanting fresh data without leaving the tab you're already on. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh feed"
          className="w-11 h-11 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-20 px-8 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive/60" />
          <p className="text-sm font-display font-semibold text-foreground">Couldn't load the feed</p>
          <p className="text-xs font-mono text-muted-foreground">Check your connection and try again.</p>
          <Button
            size="sm"
            onClick={() => refetch()}
            className="font-mono text-xs bg-primary text-primary-foreground"
          >
            Try Again
          </Button>
        </div>
      ) : isEmpty ? (
        tab === 'following' ? (
          followsNobody ? (
            <div className="flex flex-col items-center gap-3 py-16 px-8 text-center">
              <span className="text-4xl">👥</span>
              <p className="text-sm font-display font-semibold text-foreground">
                No one to follow yet
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                Follow some collectors to see their hauls here
              </p>
              <Button
                size="sm"
                onClick={() => navigate('/leaderboard')}
                className="font-mono text-xs bg-primary text-primary-foreground"
              >
                Find Collectors
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 px-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm font-mono text-muted-foreground">No activity from your collectors yet — check back soon!</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-4 py-20 px-8 text-center">
            <Radio className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm font-mono text-muted-foreground">No activity yet — be the first to scan a can!</p>
          </div>
        )
      ) : (
        <div className="px-5 space-y-3">
          {filtered.map(item => (
            <ActivityCard
              key={item.id}
              item={item}
              user={user}
              myReactionSet={myReactionSet}
              onReact={handleReact}
              isPro={proUserIds.has(item.user_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
