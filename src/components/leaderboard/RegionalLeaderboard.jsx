import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { MapPin, Crown, AlertCircle, RefreshCw, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect } from 'react';
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

export default function RegionalLeaderboard() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const {
    data: profile,
    isLoading: isLoadingProfile,
    isError: isProfileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['my-profile', currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const {
    data: scores = [],
    isLoading,
    isError: isScoresError,
    refetch: refetchScores,
  } = useQuery({
    queryKey: ['leaderboard-scores-regional', profile?.region],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select('*')
        .ilike('region', profile?.region || '')
        .order('score', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.region,
  });

  // Trophy Case badge — one batched lookup per page for every collector
  // currently visible, not one query per row. Called unconditionally here
  // (before this component's early returns below) since hooks can't be
  // called conditionally — derived from the raw `scores` query rather than
  // the later rankedWithRank, which needs data only available past those
  // early returns.
  const proUserIds = useProStatus(scores.map(s => s.user_id));

  useEffect(() => {
    if (isProfileError) toast.error('Could not load your profile');
    if (isScoresError) toast.error('Could not load the regional leaderboard');
  }, [isProfileError, isScoresError]);

  // /impeccable critique: Collectors has a "Your Rank" banner, Regional had
  // no equivalent at all. Same query key as CollectorsLeaderboard's own
  // myScoreRow fetch — react-query caches by key, so switching tabs reuses
  // the already-fetched row instead of a redundant request.
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

  const myScore = myScoreRow?.score ?? 0;

  // Fetched directly (not derived from `scores`, capped at 50 above) for
  // the same reason CollectorsLeaderboard.jsx's myRank query is — a real
  // regional collector outside the top 50 still has a real rank.
  const { data: myRegionalRank } = useQuery({
    queryKey: ['my-regional-rank', profile?.region, currentUser?.id, myScore],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('leaderboard_scores')
        .select('*', { count: 'exact', head: true })
        .ilike('region', profile?.region || '')
        .gt('score', myScore);
      if (error) throw error;
      return (count || 0) + 1;
    },
    enabled: !!currentUser?.id && !!profile?.region && myScore > 0,
  });

  const { targetRef: myRowRef, highlighted, jumpToTarget } = useJumpToHighlight();
  const rankDelta = useRankDelta('regional', myRegionalRank, currentUser?.id);

  const handleJumpToRank = () => {
    if (myScore === 0) {
      toast('Add cans to your vault to get ranked!');
      return;
    }
    if (!jumpToTarget()) {
      toast("You're outside the top 50 — keep climbing to see your row here!");
    }
  };

  if (isProfileError) {
    return (
      <div className="px-5">
        <div className="bg-card border border-destructive/30 rounded-2xl p-8 flex flex-col items-center text-center">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Couldn't load your profile</p>
          <Button
            variant="outline"
            size="sm"
            className="h-11 mt-4 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => refetchProfile()}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!isLoadingProfile && !profile?.region) {
    return (
      <div className="px-5">
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center">
          <MapPin className="w-10 h-10 text-primary mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Set your region in Settings to see local collectors</p>
          <Button
            className="mt-4 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => navigate('/settings')}
          >
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  const ranked = scores.filter(s => s.total_cans > 0);
  const isEmpty = !isLoading && !isScoresError && ranked.length === 0;

  // Was plain array index (i + 1) — the same tie-disagreement bug already
  // fixed on CollectorsLeaderboard's rows this cycle, just not ported here:
  // two regional collectors tied on score got sequential row numbers that
  // disagreed with what the tie-aware "Your Rank" banner above would tell
  // either of them. (/impeccable critique)
  const rankedWithRank = withCompetitionRank(ranked, 'score');

  return (
    <div className="px-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide truncate">
          {profile?.region}
        </span>
        <Popover>
          <PopoverTrigger
            className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 -mr-3.5"
            aria-label="How regional ranking works"
          >
            <Info className="w-4 h-4" />
          </PopoverTrigger>
          <PopoverContent className="w-64 text-xs font-mono leading-relaxed" side="bottom" align="end">
            <p className="font-semibold text-foreground mb-1">How regional ranking works</p>
            <p className="text-muted-foreground">
              Regional ranks by your Collection Score (the same number shown on your profile, weighting rarity into one figure) — not raw can count or Rare Pulls, which is what the Global tab ranks by instead.
            </p>
          </PopoverContent>
        </Popover>
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
                  'flex items-center gap-0.5 text-[10px] font-mono font-semibold',
                  rankDelta > 0 ? 'text-success' : 'text-muted-foreground'
                )}
                title={`${rankDelta > 0 ? 'Up' : 'Down'} ${Math.abs(rankDelta)} rank${Math.abs(rankDelta) === 1 ? '' : 's'} since your last visit`}
              >
                {rankDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(rankDelta)}
              </span>
            )}
            <span className="text-sm font-display font-bold text-primary">
              {isScoresError ? 'Unavailable' : myScore > 0 ? (myRegionalRank ? `#${myRegionalRank}` : '…') : 'Not ranked yet'}
            </span>
          </span>
        </button>
      )}
      {isLoadingProfile || isLoading ? (
        <>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-card/40 border border-border/30 animate-pulse mb-2" />
          ))}
        </>
      ) : isScoresError ? (
        <div className="bg-card border border-destructive/30 rounded-2xl p-8 flex flex-col items-center text-center">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Couldn't load the regional leaderboard</p>
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
          <p className="text-sm font-display font-semibold text-foreground">You're the first Sippd collector in your area! 🎉</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">{profile.region}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {rankedWithRank.map((entry) => {
            const isMe = entry.user_id === currentUser?.id;
            const isMedal = entry.rank <= 3;
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
                {/* See CollectorsLeaderboard.jsx's matching row for why this
                    is now a Link — same fix, same reasoning, ported here so
                    Regional doesn't stay the one tab still requiring a
                    Find Collectors search just to reach a Follow option. */}
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
                      {isMe && <span className="ml-0.5 text-[10px] font-mono text-primary/70">(you)</span>}
                    </p>
                  </div>
                </Link>
                <div className="flex-shrink-0 text-right">
                  <p className={cn('text-sm font-display font-bold tabular-nums', isMe ? 'text-primary' : 'text-foreground')}>
                    {entry.score}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">score</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
