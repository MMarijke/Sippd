import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Trophy, Zap, Crown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
const RARE_TIERS = new Set(['Rare', 'Ultra Rare', 'Legendary']);

export default function CollectorsLeaderboard() {
  const [sortBy, setSortBy] = useState('total');
  const { user: currentUser } = useAuth();

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['all-collections'],
    queryFn: () => base44.entities.UserCollection.list('-created_date', 2000),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const usersMap = useMemo(() =>
    Object.fromEntries(users.map(u => [u.email, u])),
    [users]
  );

  const ranked = useMemo(() => {
    const stats = {};
    for (const item of allItems) {
      if (item.status !== 'collected') continue;
      const email = item.created_by;
      if (!email) continue;
      if (!stats[email]) stats[email] = { total: 0, rare: 0 };
      stats[email].total += 1;
      if (RARE_TIERS.has(item.can_rarity || 'Common')) stats[email].rare += 1;
    }
    return Object.entries(stats)
      .map(([email, s]) => ({
        email,
        name: usersMap[email]?.full_name || email.split('@')[0],
        total: s.total,
        rare: s.rare,
      }))
      .filter(u => u.total > 0)
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [allItems, usersMap, sortBy]);

  const isEmpty = !isLoading && ranked.length === 0;

  return (
    <div className="px-5">
      <div className="flex bg-secondary rounded-lg border border-border p-0.5 mb-4">
        <Button
          variant="ghost"
          className={cn('flex-1 h-8 font-mono text-xs', sortBy === 'total' ? 'bg-card text-primary' : 'text-muted-foreground')}
          onClick={() => setSortBy('total')}
        >
          <Zap className="w-3.5 h-3.5 mr-1.5" /> Total Cans
        </Button>
        <Button
          variant="ghost"
          className={cn('flex-1 h-8 font-mono text-xs', sortBy === 'rare' ? 'bg-card text-primary' : 'text-muted-foreground')}
          onClick={() => setSortBy('rare')}
        >
          <Trophy className="w-3.5 h-3.5 mr-1.5" /> Rare Pulls
        </Button>
      </div>

      {isEmpty ? (
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center">
          <Crown className="w-10 h-10 text-primary mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Be the first to claim #1</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">Add cans to your vault to appear here.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {ranked.map((entry, i) => {
            const isMe = entry.email === currentUser?.email;
            const isMedal = i < 3;
            const score = entry[sortBy];
            const initial = entry.name.charAt(0).toUpperCase();
            return (
              <div
                key={entry.email}
                className={cn('flex items-center gap-3 px-4 py-3', isMe && 'bg-primary/5 border-l-2 border-primary')}
              >
                <div className="w-7 flex-shrink-0 text-center">
                  {isMedal ? (
                    <span className={cn('text-base', MEDAL_COLORS[i])}>{MEDAL[i]}</span>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                  )}
                </div>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-display font-bold flex-shrink-0',
                  isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                )}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold truncate', isMe ? 'text-primary' : 'text-foreground')}>
                    {entry.name}
                    {isMe && <span className="ml-1.5 text-[10px] font-mono text-primary/70">(you)</span>}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={cn('text-sm font-display font-bold tabular-nums', isMe ? 'text-primary' : 'text-foreground')}>
                    {score}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {sortBy === 'total' ? 'cans' : 'rare'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}