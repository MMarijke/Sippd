import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
import { useProStatus } from '@/hooks/useProStatus';
import ProBadge from '@/components/shared/ProBadge';
import { withCompetitionRank } from '@/lib/ranking';

const MEDAL = ['🥇', '🥈', '🥉'];

const CATEGORY_OPTIONS = [
  { value: 'all',          label: 'All'          },
  { value: 'energy_drink', label: 'Energy Drinks' },
  { value: 'soft_drink',   label: 'Soft Drinks'  },
];

export default function CollectorsLeaderboard() {
  const [sortBy, setSortBy] = useState('total'); // 'total' | 'rare'
  // Query-time filter, not a schema split or a second leaderboard system:
  // 'all' reads the existing denormalized leaderboard_scores table exactly
  // as before; any other category calls get_category_leaderboard() to
  // compute a live, filtered ranking on demand instead.
  const [category, setCategory] = useState('all');
  const { user: currentUser } = useAuth();

  const metricColumn = sortBy === 'total' ? 'total_cans' : 'rare_pulls';

  const {
    data: scores = [],
    isLoading: isLoadingAll,
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
    enabled: category === 'all',
  });

  // get_category_leaderboard() returns every collector for that category,
  // not capped at 50 — unlike the 'all' branch above, there's no separate
  // myScoreRow/myRank query needed below; both are derived from this same
  // full result set once it's in, instead of two extra round trips.
  const {
    data: categoryScores = [],
    isLoading: isLoadingCategory,
    isError: isCategoryError,
    refetch: refetchCategoryScores,
  } = useQuery({
    queryKey: ['category-leaderboard', category],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_category_leaderboard', { p_beverage_type: category });
      if (error) throw error;
      return data;
    },
    enabled: category !== 'all',
  });

  const isLoading = category === 'all' ? isLoadingAll : isLoadingCategory;
  const isFilteredError = category === 'all' ? isScoresError : isCategoryError;
  const refetchFiltered = category === 'all' ? refetchScores : refetchCategoryScores;

  useEffect(() => {
    if (isFilteredError) toast.error('Could not load the leaderboard');
  }, [isFilteredError]);

  // Ordering comes from the DB for the 'all' branch (already sorted +
  // capped there); the category branch sorts client-side since
  // get_category_leaderboard() returns every collector unsorted.
  const activeScores = category === 'all' ? scores : categoryScores;
  const ranked = category === 'all'
    ? activeScores.filter(s => s.total_cans > 0)
    : [...activeScores].filter(s => s[metricColumn] > 0).sort((a, b) => b[metricColumn] - a[metricColumn]);

  const isEmpty = !isLoading && !isFilteredError && ranked.length === 0;

  // Competition-style ranking (ties share a rank) — the same algorithm the
  // "Your Rank" banner's count query already uses. Previously each row used
  // its plain array index instead, so a tied score could show a different
  // number in a row than in the banner for the same person in the same view.
  // Shared with RegionalLeaderboard.jsx (src/lib/ranking.js), which had the
  // same bug and wasn't covered by this fix the first time (/impeccable critique).
  // Ranked over the FULL result set (uncapped for a category filter, capped
  // at 50 for 'all') so rank numbers are correct even for rows outside the
  // rendered slice below.
  const rankedWithRank = withCompetitionRank(ranked, metricColumn);
  // Render only ever shows the top 50, same as 'all' always has (its query
  // itself is capped there) — a category filter's own RPC is uncapped
  // precisely so "Your Rank"/"Your Score" below can resolve correctly for
  // someone outside that slice, not so the list itself grows unbounded.
  const displayedRows = rankedWithRank.slice(0, 50);

  // Trophy Case badge — one batched lookup per page for every collector
  // currently visible, not one query per row.
  const proUserIds = useProStatus(displayedRows.map(entry => entry.user_id));

  // 'all': fetched directly rather than derived from `scores` (capped at 50
  // rows above) — deriving it from that capped list meant any real
  // collector outside the top 50 had no matching entry, so their own metric
  // silently read as 0 and they were told "Not ranked yet" despite having a
  // real, just-not-top-50 rank.
  const { data: myScoreRowAll } = useQuery({
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
    enabled: !!currentUser?.id && category === 'all',
  });

  const { data: myRankAll } = useQuery({
    queryKey: ['my-rank', sortBy, currentUser?.id, myScoreRowAll?.[metricColumn] ?? 0],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('leaderboard_scores')
        .select('*', { count: 'exact', head: true })
        .gt(metricColumn, myScoreRowAll?.[metricColumn] ?? 0);
      if (error) throw error;
      return (count || 0) + 1;
    },
    enabled: !!currentUser?.id && category === 'all' && (myScoreRowAll?.[metricColumn] ?? 0) > 0,
  });

  // category !== 'all': get_category_leaderboard() already returned every
  // collector (uncapped), and rankedWithRank above computed a real rank for
  // all of them — no separate row/count query needed, just find the caller.
  const myCategoryEntry = category !== 'all' ? rankedWithRank.find(entry => entry.user_id === currentUser?.id) : null;

  const myMetric = category === 'all' ? (myScoreRowAll?.[metricColumn] ?? 0) : (myCategoryEntry?.[metricColumn] ?? 0);
  const myRank = category === 'all' ? myRankAll : (myCategoryEntry?.rank ?? null);

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

  const rankDelta = useRankDelta(`collectors:${sortBy}:${category}`, myRank, currentUser?.id);

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

      <div className="flex bg-secondary rounded-lg border border-border p-0.5 mb-3" aria-label="Filter by beverage type">
        {CATEGORY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={category === opt.value}
            className={cn('flex-1 h-11 font-mono text-xs rounded-md transition-colors',
              category === opt.value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setCategory(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {currentUser && (
        <button
          type="button"
          onClick={handleJumpToRank}
          aria-label="Jump to your rank"
          className="w-full min-h-11 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="text-xs font-mono text-muted-foreground">Your Rank</span>
          <span className="flex items-center gap-1.5">
            {rankDelta != null && rankDelta !== 0 && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-2xs font-mono font-semibold',
                  rankDelta > 0 ? 'text-success' : 'text-muted-foreground'
                )}
                title={`${rankDelta > 0 ? 'Up' : 'Down'} ${Math.abs(rankDelta)} rank${Math.abs(rankDelta) === 1 ? '' : 's'} since your last visit`}
              >
                {rankDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(rankDelta)}
              </span>
            )}
            <span className={cn('text-sm font-display font-bold', sortBy === 'rare' ? 'text-rarity-ultra-text' : 'text-primary')}>
              {isFilteredError ? 'Unavailable' : myMetric > 0 ? (myRank ? `#${myRank}` : '…') : 'Not ranked yet'}
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
      ) : isFilteredError ? (
        <div className="bg-card border border-destructive/30 rounded-2xl p-8 flex flex-col items-center text-center">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Couldn't load the leaderboard</p>
          <Button
            variant="outline"
            size="sm"
            className="h-11 mt-4 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => refetchFiltered()}
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
          {displayedRows.map((entry) => {
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
                    <span className="text-base leading-none" aria-hidden="true">
                      {MEDAL[entry.rank - 1]}
                    </span>
                  )}
                  <span className="text-xs font-mono text-muted-foreground leading-none">#{entry.rank}</span>
                </div>
                {/* Previously plain, unclickable divs — the only way to reach
                    a collector's profile (and the Follow button that lives
                    there) was to search for them by name in Find Collectors
                    below, even from a row that's already showing you exactly
                    who they are. Wrapping avatar+name in a Link surfaces
                    that same follow option one tap away from the rank list
                    itself. */}
                <Link to={`/u/${entry.user_id}`} className="group/row flex items-center gap-3 flex-1 min-w-0">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-display font-bold flex-shrink-0',
                    isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                  )}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('flex items-center gap-1 text-sm font-semibold truncate group-hover/row:underline', isMe ? 'text-primary' : 'text-foreground')}>
                      <span className="truncate">{name}</span>
                      {proUserIds.has(entry.user_id) && <ProBadge />}
                      {isMe && <span className="ml-0.5 text-2xs font-mono text-primary/70">(you)</span>}
                    </p>
                  </div>
                </Link>
                <div className="flex-shrink-0 text-right">
                  <p className={cn(
                    'text-sm font-display font-bold tabular-nums',
                    sortBy === 'rare' ? 'text-rarity-ultra-text' : isMe ? 'text-primary' : 'text-foreground'
                  )}>
                    {score}
                  </p>
                  <p className="text-2xs font-mono text-muted-foreground">
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
