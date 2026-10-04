import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { computeTrustedStats, pointsAddedSince } from '@/lib/rarityConsensus';
import { useCollectionHighlights } from '@/hooks/useCollectionHighlights';

/**
 * The one definition of a collector's showcase, shared by Profile (your
 * own) and PublicProfile (anyone's, including the link you share). They
 * used to compute it separately and had drifted: the public page showed
 * every can uncapped, counted rare pulls by a different rule, and never
 * showed rank -- so what you shared wasn't what you'd curated.
 *
 * - showcase: pinned first, then rarest, capped at the OWNER's pin limit.
 * - score / rarePulls / rank: the leaderboard's own numbers. Read from the
 *   user's synced leaderboard_scores row (server-computed from community
 *   consensus, never the client-writable can_rarity; see
 *   20260914000000_harden_leaderboard_rarity_trust.sql), so a profile can
 *   never disagree with the Ranks tab. That table is readable by signed-in
 *   users only, so a signed-out visitor falls back to computeTrustedStats,
 *   a client mirror of the same SQL rule, and gets no rank.
 * - streak: passed in, because its source genuinely differs by viewer --
 *   the owner's comes from tick_streak(), everyone else's from
 *   public_profiles.current_streak, which applies the same lapse rule
 *   (20260929200000_public_profile_effective_streak.sql).
 */
export function useProfileShowcase({
  userId,
  collection,
  sharedCansMap,
  isOwnerPro = false,
  canReadLeaderboard = true,
  streak = 0,
  voteCount = 0,
  userCreatedDate = null,
  // Owner-only: "6 pts to #3" is motivation for you, not something to show
  // a stranger about someone else.
  withRankGap = false,
}) {
  const { collected, getEffectiveRarity, topPulls, rarityBreakdown } = useCollectionHighlights({
    collection,
    sharedCansMap,
    streak,
    voteCount,
    userCreatedDate,
    isPro: isOwnerPro,
  });

  const localStats = useMemo(
    () => computeTrustedStats(collected, sharedCansMap),
    [collected, sharedCansMap]
  );

  const { data: boardRow, isLoading: isBoardLoading, isError: isBoardError } = useQuery({
    queryKey: ['leaderboard-row', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select('score, rare_pulls')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!userId && canReadLeaderboard,
  });

  // No row yet (a brand-new collector the sync hasn't reached) or no access:
  // fall back to the mirror rather than showing 0.
  const score = boardRow?.score ?? localStats.score;
  const rarePulls = boardRow?.rare_pulls ?? localStats.rarePulls;

  // Rank is only meaningful against the real table, so it's only shown when
  // this user actually has a row in it. Same "count strictly higher + 1"
  // rule the leaderboard uses, which gives tied scores the same rank.
  const { data: rank, isError: isRankError } = useQuery({
    queryKey: ['profile-rank', userId, boardRow?.score],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('leaderboard_scores')
        .select('*', { count: 'exact', head: true })
        .gt('score', boardRow.score);
      if (error) throw error;
      return (count || 0) + 1;
    },
    enabled: !!userId && canReadLeaderboard && !!boardRow && boardRow.score > 0,
  });

  // "of N": everyone the Score leaderboard actually lists (it filters to
  // collectors with at least one can, same as its other views).
  const { data: rankTotal } = useQuery({
    queryKey: ['leaderboard-total'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('leaderboard_scores')
        .select('*', { count: 'exact', head: true })
        .gt('total_cans', 0);
      if (error) throw error;
      return count || 0;
    },
    enabled: canReadLeaderboard && !!rank,
  });

  // The next rank up: the nearest higher score, and the rank that score
  // holds (competition ranking, so ties above share it). Reaching that
  // score ties them there.
  const { data: nextUp } = useQuery({
    queryKey: ['leaderboard-next-up', boardRow?.score],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select('score, full_name')
        .gt('score', boardRow.score)
        .order('score', { ascending: true })
        .limit(1);
      if (error) throw error;
      const nextScore = data?.[0]?.score;
      // Who's there: the collector you'd pass next (one of them, on a tie).
      const rivalName = data?.[0]?.full_name ?? null;
      if (nextScore == null) return null;
      const { count, error: countError } = await supabase
        .from('leaderboard_scores')
        .select('*', { count: 'exact', head: true })
        .gt('score', nextScore);
      if (countError) throw countError;
      return { gap: nextScore - boardRow.score, rank: (count || 0) + 1, rivalName };
    },
    enabled: withRankGap && canReadLeaderboard && !!rank && rank > 1,
  });

  // "+N pts this week": additions only (there's no score history); see
  // pointsAddedSince. Recomputed from the collection, so it's live.
  const weeklyPoints = useMemo(
    () => pointsAddedSince(collected, sharedCansMap, new Date(Date.now() - 7 * 86400000)),
    [collected, sharedCansMap]
  );

  return {
    collected,
    showcase: topPulls,
    totalCount: collected.length,
    rarityBreakdown,
    getEffectiveRarity,
    score,
    rarePulls,
    rank: rank ?? null,
    rankTotal: rankTotal ?? null,
    nextRank: nextUp?.rank ?? null,
    pointsToNextRank: nextUp?.gap ?? null,
    rivalName: nextUp?.rivalName ?? null,
    weeklyPoints,
    streak,
    isStatsLoading: canReadLeaderboard && !!userId && isBoardLoading,
    isRankError: isBoardError || isRankError,
  };
}
