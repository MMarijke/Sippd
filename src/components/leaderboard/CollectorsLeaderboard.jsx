import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Trophy, Zap, Crown, Info } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

export default function CollectorsLeaderboard() {
  const [sortBy, setSortBy] = useState('total'); // 'total' | 'rare'
  const { user: currentUser } = useAuth();

  const metricColumn = sortBy === 'total' ? 'total_cans' : 'rare_pulls';

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['leaderboard-scores', sortBy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select('*')
        .order(metricColumn, { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Ordering comes from the DB query above (per active tab) — this only
  // hides collectors with nothing in their vault yet.
  const ranked = scores.filter(s => s.total_cans > 0);

  const isEmpty = !isLoading && ranked.length === 0;

  const myEntry = scores.find(s => s.user_id === currentUser?.id);
  const myMetric = myEntry?.[metricColumn] ?? 0;

  const { data: myRank } = useQuery({
    queryKey: ['my-rank', sortBy, currentUser?.id, myMetric],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('leaderboard_scores')
        .select('*', { count: 'exact', head: true })
        .gt(metricColumn, myMetric);
      if (error) throw error;
      return (count || 0) + 1;
    },
    enabled: !!currentUser?.id && myMetric > 0,
  });

  return (
    <div className="px-5">
      <div className="flex items-center gap-1.5 mb-3">
        <div className="flex flex-1 bg-secondary rounded-lg border border-border p-0.5">
          <Button
            variant="ghost"
            aria-pressed={sortBy === 'total'}
            className={cn('flex-1 h-8 font-mono text-xs', sortBy === 'total' ? 'bg-card text-primary' : 'text-muted-foreground')}
            onClick={() => setSortBy('total')}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" /> Total Cans
          </Button>
          <Button
            variant="ghost"
            aria-pressed={sortBy === 'rare'}
            className={cn('flex-1 h-8 font-mono text-xs', sortBy === 'rare' ? 'bg-card text-primary' : 'text-muted-foreground')}
            onClick={() => setSortBy('rare')}
          >
            <Trophy className="w-3.5 h-3.5 mr-1.5" /> Rare Pulls
          </Button>
        </div>
        <Popover>
          <PopoverTrigger
            className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label="How ranking works"
          >
            <Info className="w-4 h-4" />
          </PopoverTrigger>
          <PopoverContent className="w-64 text-xs font-mono leading-relaxed" side="bottom" align="end">
            <p className="font-semibold text-foreground mb-1">How ranking works</p>
            <p className="text-muted-foreground">
              Total Cans ranks by raw can count. Rare Pulls ranks by how many Rare, Ultra Rare, and Legendary cans you've logged. Your Collection Score (on your profile) weights rarity into one number, but isn't a ranking tab here.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {currentUser && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">Your Rank</span>
          <span className={cn('text-sm font-display font-bold', sortBy === 'rare' ? 'text-rarity-ultra' : 'text-primary')}>
            {myMetric > 0 ? (myRank ? `#${myRank}` : '…') : 'Not ranked yet'}
          </span>
        </div>
      )}

      {isLoading ? (
        <>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-card/40 border border-border/30 animate-pulse mb-2" />
          ))}
        </>
      ) : isEmpty ? (
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center">
          <Crown className="w-10 h-10 text-primary mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Be the first to claim #1</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">Add cans to your vault to appear here.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {ranked.map((entry, i) => {
            const isMe = entry.user_id === currentUser?.id;
            const isMedal = i < 3;
            const score = entry[metricColumn];
            const name = entry.full_name || 'Collector';
            const initial = name.charAt(0).toUpperCase();
            return (
              <div
                key={entry.user_id}
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
                    {name}
                    {isMe && <span className="ml-1.5 text-[10px] font-mono text-primary/70">(you)</span>}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={cn(
                    'text-sm font-display font-bold tabular-nums',
                    sortBy === 'rare' ? 'text-rarity-ultra' : isMe ? 'text-primary' : 'text-foreground'
                  )}>
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
