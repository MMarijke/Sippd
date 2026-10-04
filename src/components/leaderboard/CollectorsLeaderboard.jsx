import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Crown, AlertCircle, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useJumpToHighlight } from '@/hooks/useJumpToHighlight';
import { useRankDelta } from '@/hooks/useRankDelta';
import { useProStatus } from '@/hooks/useProStatus';
import ProBadge from '@/components/shared/ProBadge';
import YourRankBar from '@/components/leaderboard/YourRankBar';
import { withCompetitionRank, rankLabel, medalIndex, rivalAbove, shortName } from '@/lib/ranking';

const MEDAL = ['🥇', '🥈', '🥉'];

// short: the chip's label on the control row; label: the sheet's option.
const CATEGORY_OPTIONS = [
  { value: 'all',          short: 'All drinks', label: 'All drinks'    },
  { value: 'energy_drink', short: 'Energy',     label: 'Energy drinks' },
  { value: 'soft_drink',   short: 'Soft',       label: 'Soft drinks'   },
];
const CATEGORY_VALUES = CATEGORY_OPTIONS.map(o => o.value);

// Score is the same weighted Collection Score shown on your Profile, where
// "Rank #N" links here, and the only metric Regional ranks by, so it's the
// default view. Labels are one word so three fit beside the drinks chip at
// 320px (the rows below carry the full unit).
const SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'rare',  label: 'Rare'  },
  { value: 'total', label: 'Cans'  },
];
const SORT_VALUES = SORT_OPTIONS.map(o => o.value);
const METRIC_COLUMN = { total: 'total_cans', rare: 'rare_pulls', score: 'score' };
const METRIC_UNIT = { total: 'cans', rare: 'rare', score: 'pts' };
const METRIC_SCOPE = { total: 'by cans', rare: 'by rare pulls', score: 'by Score' };
const GAP_UNIT = { total: 'cans', rare: 'rare pulls', score: 'pts' };

export default function CollectorsLeaderboard() {
  // View state lives in the URL (?sort=, ?drink=) so a reload or a shared
  // link keeps it. ?sort=score&jump=me is Profile's "Rank #N" deep link:
  // open on that view and scroll to your own row once it's rendered.
  const [searchParams, setSearchParams] = useSearchParams();
  const sortBy = SORT_VALUES.includes(searchParams.get('sort')) ? searchParams.get('sort') : 'score';
  // Query-time filter, not a schema split or a second leaderboard system:
  // 'all' reads the existing denormalized leaderboard_scores table exactly
  // as before; any other category calls get_category_leaderboard() to
  // compute a live, filtered ranking on demand instead.
  const categoryChoice = CATEGORY_VALUES.includes(searchParams.get('drink')) ? searchParams.get('drink') : 'all';
  const setView = (key, value) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.set(key, value);
    next.delete('jump');
    return next;
  }, { replace: true });
  const setSortBy = value => setView('sort', value);
  const setCategoryChoice = value => setView('drink', value);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Score is ranked across all drinks only: get_category_leaderboard doesn't
  // return a per-category score, so the Score view pins the filter to All
  // (buttons disabled below) rather than showing wrong numbers.
  const category = sortBy === 'score' ? 'all' : categoryChoice;
  const { user: currentUser } = useAuth();

  const metricColumn = METRIC_COLUMN[sortBy];

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
      return data ?? [];
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

  // The collector directly above you, for "6 pts behind Priya S.". 'all'
  // asks the table (you may be outside the top 50 it lists); a category's
  // list is already complete.
  const { data: rivalAll } = useQuery({
    queryKey: ['rival-above', sortBy, myMetric],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select('*')
        .gt(metricColumn, myMetric)
        .order(metricColumn, { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!currentUser?.id && category === 'all' && myMetric > 0,
  });
  const rival = category === 'all'
    ? (rivalAll ? { entry: rivalAll, gap: rivalAll[metricColumn] - myMetric } : null)
    : rivalAbove(ranked, metricColumn, myMetric);

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

  // Deep-link arrival: jump once, after your row can actually be in the DOM.
  const jumpedOnArrival = useRef(false);
  useEffect(() => {
    if (jumpedOnArrival.current || searchParams.get('jump') !== 'me') return;
    if (isLoading || !myRank || displayedRows.length === 0) return;
    jumpedOnArrival.current = true;
    requestAnimationFrame(() => handleJumpToRank());
     
  }, [isLoading, myRank, displayedRows.length]);

  const rankDelta = useRankDelta(`collectors:${sortBy}:${category}`, myRank, currentUser?.id);

  const drinkOption = CATEGORY_OPTIONS.find(o => o.value === category);
  const rankScope = category === 'all' ? METRIC_SCOPE[sortBy] : `${METRIC_SCOPE[sortBy]} · ${drinkOption.label}`;
  const rankStatus = isFilteredError ? 'error' : myMetric > 0 ? (myRank ? 'ranked' : 'loading') : 'unranked';

  return (
    <div className="px-5">
      {/* One row instead of two stacked bars: the metric stays one tap away,
          the drink type (a less frequent choice) and the ranking explainer
          move into a sheet. The old sort bar, info button and drink bar took
          ~112px, and at 320px "Total Cans"/"Rare Pulls" ran into each other
          (/impeccable critique). */}
      <div className="flex items-center gap-2 mb-3">
        <div role="group" aria-label="Rank by" className="flex flex-1 min-w-0 bg-secondary rounded-lg p-0.5">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={sortBy === opt.value}
              onClick={() => setSortBy(opt.value)}
              className={cn('flex-1 min-w-0 h-11 px-1 rounded-md font-mono text-xs transition-colors',
                sortBy === opt.value ? 'bg-card text-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Drinks: ${drinkOption.label}. Change drinks or see how ranking works`}
          className={cn('h-12 pl-3 pr-2 rounded-lg border flex items-center gap-1 font-mono text-xs flex-shrink-0 transition-colors',
            category === 'all' ? 'border-border text-muted-foreground hover:text-foreground' : 'border-primary/50 text-foreground'
          )}
        >
          {drinkOption.short}
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto p-5 pb-8">
          <SheetTitle className="text-base font-display font-bold text-foreground pr-12">Drinks</SheetTitle>
          <SheetDescription className="text-xs font-mono text-muted-foreground mt-1 pr-12">
            {sortBy === 'score'
              ? 'Score always covers all drinks. Switch to Rare or Cans to rank one drink type.'
              : 'Rank collectors by one drink type, or all of them.'}
          </SheetDescription>
          <div role="radiogroup" aria-label="Drink type" className="mt-4 divide-y divide-border border border-border rounded-xl overflow-hidden">
            {CATEGORY_OPTIONS.map(opt => {
              const locked = sortBy === 'score' && opt.value !== 'all';
              const checked = category === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={locked}
                  onClick={() => { setCategoryChoice(opt.value); setSheetOpen(false); }}
                  className="w-full min-h-12 px-4 flex items-center justify-between text-sm text-foreground hover:bg-secondary transition-colors disabled:text-muted-foreground disabled:hover:bg-transparent"
                >
                  {opt.label}
                  {checked && <Check className="w-4 h-4 text-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <h3 className="text-sm font-display font-semibold text-foreground mt-6">How ranking works</h3>
          <dl className="mt-2 space-y-2 text-xs font-mono leading-relaxed text-muted-foreground">
            <div><dt className="inline text-foreground">Score: </dt><dd className="inline">your Collection Score from your profile, which weights rarity into one number. Regional ranks by it too.</dd></div>
            <div><dt className="inline text-foreground">Rare: </dt><dd className="inline">how many Rare, Ultra Rare and Legendary cans you've logged.</dd></div>
            <div><dt className="inline text-foreground">Cans: </dt><dd className="inline">your raw can count.</dd></div>
          </dl>
        </SheetContent>
      </Sheet>

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
        <ol aria-label={`Collectors ${rankScope}`} className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {displayedRows.map((entry) => {
            const isMe = entry.user_id === currentUser?.id;
            const medal = medalIndex(entry);
            const score = entry[metricColumn];
            const name = entry.full_name || 'Collector';
            const initial = name.charAt(0).toUpperCase();
            return (
              <li
                key={entry.user_id}
                ref={isMe ? myRowRef : undefined}
                tabIndex={isMe ? -1 : undefined}
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
                    top of it rather than a replacement for it. Shared ranks
                    read "=3", and a big tie gets no medal at all. */}
                <div className="w-7 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
                  {medal != null && (
                    <span className="text-base leading-none" aria-hidden="true">
                      {MEDAL[medal]}
                    </span>
                  )}
                  <span className="text-xs font-mono text-muted-foreground leading-none" aria-hidden="true">{rankLabel(entry)}</span>
                  <span className="sr-only">Rank {entry.rank}{entry.tieSize > 1 ? ', tied' : ''}</span>
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
                    {METRIC_UNIT[sortBy]}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {currentUser && (
        <YourRankBar
          status={rankStatus}
          rank={myRank}
          scope={rankScope}
          rival={rival ? { name: shortName(rival.entry.full_name), gap: rival.gap } : null}
          unit={GAP_UNIT[sortBy]}
          rankDelta={rankDelta}
          rowRef={myRowRef}
          onJump={handleJumpToRank}
        />
      )}
    </div>
  );
}

