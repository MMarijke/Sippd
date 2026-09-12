import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import FollowButton from '@/components/social/FollowButton';

export default function FindCollectors({ query, tab }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const {
    data: users = [],
    isLoading: isLoadingUsers,
    isError: isUsersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['public-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('public_profiles').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: follows = [], isError: isFollowsError } = useQuery({
    queryKey: ['my-follows', currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const { data: scores = [], isError: isScoresError } = useQuery({
    queryKey: ['leaderboard-scores-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leaderboard_scores').select('user_id, score');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isUsersError) toast.error('Could not search collectors');
    if (isFollowsError) toast.error('Could not load your follows');
    if (isScoresError) toast.error('Could not load collector scores');
  }, [isUsersError, isFollowsError, isScoresError]);

  const myFollowingIds = useMemo(
    () => new Set(
      follows.filter(f => f.follower_id === currentUser?.id && f.status === 'accepted').map(f => f.following_id)
    ),
    [follows, currentUser?.id]
  );

  const scoreByUserId = useMemo(
    () => Object.fromEntries(scores.map(s => [s.user_id, s.score])),
    [scores]
  );

  const results = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter(u => {
      if (!u.full_name) return false;
      if (u.id === currentUser?.id) return false;
      const accessible = !u.is_private || myFollowingIds.has(u.id);
      return accessible && u.full_name.toLowerCase().includes(q);
    }).slice(0, 8);
  }, [users, query, currentUser?.id, myFollowingIds]);

  if (isLoadingUsers) {
    return (
      <p className="text-xs font-mono text-muted-foreground text-center py-4">Searching…</p>
    );
  }

  if (isUsersError) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-destructive" /> Couldn't search collectors
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-11 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={() => refetchUsers()}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </Button>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-xs font-mono text-muted-foreground">No collectors found for "{query}"</p>
        {/* This search bar stays visible across all three Ranks tabs, but
            only ever searches people — on Most Wanted (cans) a can-name
            query read as a broken search rather than a scoped one
            (/impeccable critique). Only shown here, where the ambiguity
            actually exists; Collectors/Regional never see this line since
            there's no can-search expectation to correct there. */}
        {tab === 'mostwanted' && (
          <p className="text-[11px] font-mono text-muted-foreground/70 mt-1">
            This searches people, not cans — check the list below instead.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
      {results.map(u => {
        const initial = u.full_name?.[0]?.toUpperCase() || '?';
        const score = scoreByUserId[u.id] || 0;
        return (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate(`/u/${u.id}`)}
              aria-label={`View ${u.full_name || 'this collector'}'s profile`}
              className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-display font-bold text-primary flex-shrink-0 hover:bg-primary/20 transition-colors"
            >
              {initial}
            </button>
            <Link to={`/u/${u.id}`} className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{u.full_name}</p>
              <p className="text-[11px] font-mono text-muted-foreground">{score} pts</p>
            </Link>
            <FollowButton targetUser={u} currentUser={currentUser} />
          </div>
        );
      })}
    </div>
  );
}
