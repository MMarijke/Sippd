import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Trophy, Zap, Crown, Info, AlertCircle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useJumpToHighlight } from '@/hooks/useJumpToHighlight';
import { useRankDelta } from '@/hooks/useRankDelta';
import { withCompetitionRank } from '@/lib/ranking';

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

export default function CollectorsLeaderboard() {
  const [sortBy, setSortBy] = useState('total'); // 'total' | 'rare'
  const { user: currentUser } = useAuth();

  const metricColumn = sortBy === 'total' ? 'total_cans' : 'rare_pulls';

  const {
    data: scores = [],
    isLoading,
    isError: isScoresError,
    refetch: refetchScores,
  } = useQuery({
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

  useEffect(() => {
    if (isScoresError) toast.error('Could not load the leaderboard');
  }, [isScoresError]);

  // Ordering comes from the DB query above (per active tab) — this only
  // hides collectors with nothing in their vault yet.
  const ranked = scores.filter(s => s.total_cans > 0);

  const isEmpty = !isLoading && !isScoresError && ranked.length === 0;

  // Competition-style ranking (ties share a rank) — the same algorithm the
  // "Your Rank" banner's count query already uses. Previously each row used
  // its plain array index instead, so a tied score could show a different
  // number in a row than in the banner for the same person in the same view.
  // Shared with RegionalLeaderboard.jsx (src/lib/ranking.js), which had the
  // same bug and wasn't covered by this fix the first time (/impeccable critique).
  const rankedWithRank = withCompetitionRank(ranked, metricColumn);

  // Fetched directly rather than derived from `scores` (capped at 50 rows
  // above) — deriving it from that capped list meant any real collector
  // outside the top 50 had no matching entry, so their own metric silently
  // read as 0 and they were told "Not ranked yet" despite having a real,
  // just-not-top-50 rank.
  const { data: myScoreRow } = useQuery({
    queryKey: ['my-leaderboard-score', currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no row yet, not an error here
      return data ?? null;
    },
    enabled: !!currentUser?.id,
  });

  const myMetric = myScoreRow?.[metricColumn] ?? 0;
  const { targetRef: myRowRef, highlighted, jumpToTarget } = useJumpToHighlight();

  // /impeccable critique: the banner announced a rank number with no way to
  // act on it. myMetric === 0 means there's genuinely no row to jump to yet
  // (a real "not ranked" state, not just "outside the visible list") —
  // jumpToTarget()'s own false return covers the other real gap: ranked,
  // but outside the top 50 this tab actually renders.
  const handleJumpToRank = () => {
    if (myMetric === 0) {
      toast('Add cans to your vault to get ranked!');
      return;
    }
    if (!jumpToTarget()) {
      toast("You're outside the top 50 — keep climbing to see your row here!");
    }
  };

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

  const rankDelta = useRankDelta(`collectors:${sortBy}`, myRank, currentUser?.id);

  return (
    <div className="px-5">
      <div className="flex items-center gap-1.5 mb-3">
        <div className="flex flex-1 bg-secondary rounded-lg border border-border p-0.5">
          <Button
            variant="ghost"
            aria-pressed={sortBy === 'total'}
            className={cn('flex-1 h-11 font-mono text-xs', sortBy === 'total' ? 'bg-card text-primary' : 'text-muted-foreground')}
            onClick={() => setSortBy('total')}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" /> Total Cans
          </Button>
          <Button
            variant="ghost"
            aria-pressed={sortBy === 'rare'}
            className={cn('flex-1 h-11 font-mono text-xs', sortBy === 'rare' ? 'bg-card text-primary' : 'text-muted-foreground')}
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
              Total Cans ranks by raw can count. Rare Pulls ranks by how many Rare, Ultra Rare, and Legendary cans you've logged. Your Collection Score (on your profile) weights rarity into one number — that's what the Regional tab ranks by instead, not a metric here on Global.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {currentUser && (
        <button
          type="button"
          onClick={handleJumpToRank}
          aria-label="Jump to your rank"
          className="w-full bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="text-xs font-mono text-muted-foreground">Your Rank</span>
          <span className="flex items-center gap-1.5">
            {rankDelta != null && rankDelta !== 0 && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-[10px] font-mono font-semibold',
                  rankDelta > 0 ? 'text-success' : 'text-muted-foreground'
                )}
                title={`${rankDelta > 0 ? 'Up' : 'Down'} ${Math.abs(rankDelta)} rank${Math.abs(rankDelta) === 1 ? '' : 's'} since your last visit`}
              >
                {rankDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(rankDelta)}
              </span>
            )}
            <span className={cn('text-sm font-display font-bold', sortBy === 'rare' ? 'text-rarity-ultra' : 'text-primary')}>
              {isScoresError ? '—' : myMetric > 0 ? (myRank ? `#${myRank}` : '…') : 'Not ranked yet'}
            </span>
          </span>
        </button>
      )}

      {isLoading ? (
        <>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-card/40 border border-border/30 animate-pulse mb-2" />
          ))}
        </>
      ) : isScoresError ? (
        <div className="bg-card border border-destructive/30 rounded-2xl p-8 flex flex-col items-center text-center">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Couldn't load the leaderboard</p>
          <Button
            variant="outline"
            size="sm"
            className="h-11 mt-4 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => refetchScores()}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center">
          <Crown className="w-10 h-10 text-primary mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Be the first to claim #1</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">Add cans to your vault to appear here.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {rankedWithRank.map((entry) => {
            const isMe = entry.user_id === currentUser?.id;
            const isMedal = entry.rank <= 3;
            const score = entry[metricColumn];
            const name = entry.full_name || 'Collector';
            const initial = name.charAt(0).toUpperCase();
            return (
              <div
                key={entry.user_id}
                ref={isMe ? myRowRef : undefined}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  isMe && 'bg-primary/5 border-l-2 border-primary',
                  isMe && highlighted && 'bg-primary/15'
                )}
              >
                {/* Medal rows used to drop the numeric rank entirely, leaving
                    the one thing every row exists to convey (rank) less
                    legible exactly for the top 3 (/impeccable critique) —
                    "#N" now always renders, so the medal is decorative on
                    top of it rather than a replacement for it. */}
                <div className="w-7 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
                  {isMedal && (
                    <span className={cn('text-base leading-none', MEDAL_COLORS[entry.rank - 1])} aria-hidden="true">
                      {MEDAL[entry.rank - 1]}
                    </span>
                  )}
                  <span className="text-xs font-mono text-muted-foreground leading-none">#{entry.rank}</span>
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
