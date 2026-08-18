import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { getItemScore } from '@/lib/rarityConsensus';
import FollowButton from '@/components/social/FollowButton';

export default function FindCollectors({ query }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: follows = [] } = useQuery({
    queryKey: ['my-follows', currentUser?.id],
    queryFn: () => base44.entities.Follow.filter({ follower_id: currentUser.id }, '-created_date', 200),
    enabled: !!currentUser?.id,
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ['all-collections'],
    queryFn: () => base44.entities.UserCollection.list('-created_date', 2000),
  });

  const myFollowingIds = new Set(
    follows.filter(f => f.follower_id === currentUser?.id && f.status === 'accepted').map(f => f.following_id)
  );

  const scoreByEmail = {};
  for (const item of allItems) {
    if (item.status !== 'collected' || !item.created_by) continue;
    scoreByEmail[item.created_by] = (scoreByEmail[item.created_by] || 0) + getItemScore(item, null);
  }

  const q = query.toLowerCase();
  const results = users.filter(u => {
    if (!u.full_name) return false;
    if (u.id === currentUser?.id) return false;
    // Show public accounts + accounts I follow
    const accessible = !u.is_private || myFollowingIds.has(u.id);
    return accessible && u.full_name.toLowerCase().includes(q);
  }).slice(0, 8);

  if (results.length === 0) {
    return (
      <p className="text-xs font-mono text-muted-foreground text-center py-4">No collectors found for "{query}"</p>
    );
  }

  return (
    <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
      {results.map(u => {
        const initial = u.full_name?.[0]?.toUpperCase() || '?';
        const score = scoreByEmail[u.email] || 0;
        return (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate(`/u/${u.id}`)}
              className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-display font-bold text-primary flex-shrink-0 hover:bg-primary/20 transition-colors"
            >
              {initial}
            </button>
            <div className="flex-1 min-w-0" onClick={() => navigate(`/u/${u.id}`)} style={{ cursor: 'pointer' }}>
              <p className="text-sm font-semibold text-foreground truncate">{u.full_name}</p>
              <p className="text-[11px] font-mono text-muted-foreground">{score} pts</p>
            </div>
            <FollowButton targetUser={u} currentUser={currentUser} />
          </div>
        );
      })}
    </div>
  );
}