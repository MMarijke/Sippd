import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import FollowButton from '@/components/social/FollowButton';

export default function FindCollectors({ query }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const { data: users = [] } = useQuery({
    queryKey: ['public-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('public_profiles').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: follows = [] } = useQuery({
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

  const { data: scores = [] } = useQuery({
    queryKey: ['leaderboard-scores-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leaderboard_scores').select('user_id, score');
      if (error) throw error;
      return data;
    },
  });

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

  if (results.length === 0) {
    return (
      <p className="text-xs font-mono text-muted-foreground text-center py-4">No collectors found for "{query}"</p>
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
