import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { shortName } from '@/lib/ranking';

// Your rank opens to your own row on the Score board.
const RANKS_HREF = '/leaderboard?tab=collectors&sort=score&jump=me';

// Home's hero: where you stand and who you pass next. Competition is the
// product's first principle (PRODUCT.md), yet Home never said where you
// ranked; its "Collection Score" also used a different formula from Ranks,
// so the two could disagree (/impeccable critique). Every number here is
// the leaderboard's own (useProfileShowcase reads the synced
// leaderboard_scores row).
//
// It leads with the race, not a lone number: your rank, the gap to the
// collector directly above, and a track from your score to theirs.
export default function StandingCard({
  rank, rankTotal, score, rarePulls, weeklyPoints,
  gap, rivalName, nextRank, isLoading, isRankError,
}) {
  if (isLoading) {
    return (
      <div className="glass-card-hero rounded-2xl p-5" aria-busy="true" aria-label="Loading your standing">
        <div className="h-12 w-28 rounded bg-foreground/10 animate-pulse" />
        <div className="h-4 w-48 rounded bg-foreground/10 animate-pulse mt-3" />
        <div className="h-1.5 w-full rounded-full bg-foreground/10 animate-pulse mt-4" />
      </div>
    );
  }

  const rival = rivalName ? shortName(rivalName) : 'the next collector';
  const rivalScore = gap != null ? score + gap : null;
  // How much of the way from 0 to the rival's score you are; never shows
  // as empty or full, since you're neither.
  const progress = rivalScore ? Math.min(0.96, Math.max(0.04, score / rivalScore)) : null;

  return (
    <Link
      to={RANKS_HREF}
      className="group block glass-card-hero rounded-2xl p-5 transition-colors hover:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        {rank ? (
          <p className="flex items-baseline gap-2 min-w-0">
            <span className="text-5xl font-display font-black text-foreground tabular-nums leading-none">#{rank}</span>
            {rankTotal ? (
              <span className="text-sm font-mono text-foreground/80">of {rankTotal} collectors</span>
            ) : null}
          </p>
        ) : (
          <p className="text-2xl font-display font-bold text-foreground leading-tight">
            {isRankError ? 'Rank unavailable' : 'Not on the board yet'}
          </p>
        )}
        <span className="flex items-center gap-0.5 text-xs font-mono text-foreground/80 group-hover:text-foreground flex-shrink-0 mt-1">
          Ranks <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </span>
      </div>

      {rank === 1 ? (
        <p className="text-sm font-mono text-foreground mt-3">Top of the board. Everyone else is chasing you.</p>
      ) : rank && gap != null ? (
        <>
          <p className="text-sm font-mono text-foreground mt-3">
            <span className="font-bold">{gap} {gap === 1 ? 'pt' : 'pts'}</span> behind {rival}
            {nextRank ? <span className="text-foreground/80"> for #{nextRank}</span> : null}
          </p>
          {/* The race: you on the left, them on the right. */}
          <div className="mt-3" aria-hidden="true">
            <div className="h-1.5 rounded-full bg-foreground/15 overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-xs font-mono text-foreground/80 tabular-nums">
              <span>You · {score}</span>
              <span className="truncate ml-3">{rival} · {rivalScore}</span>
            </div>
          </div>
        </>
      ) : !rank && !isRankError ? (
        <p className="text-sm font-mono text-foreground/80 mt-2">
          {score > 0 ? 'Your score joins the board shortly after your latest can.' : 'Add a can to get on the board.'}
        </p>
      ) : null}

      <p className="flex flex-wrap gap-x-3 gap-y-1 mt-4 pt-3 border-t border-foreground/10 text-xs font-mono text-foreground/80 tabular-nums">
        <span><span className="text-foreground font-semibold">{score}</span> pts</span>
        <span><span className="text-foreground font-semibold">{rarePulls}</span> rare {rarePulls === 1 ? 'pull' : 'pulls'}</span>
        {weeklyPoints > 0 && <span className="text-foreground font-semibold">+{weeklyPoints} this week</span>}
      </p>
      <span className="sr-only">. Open Ranks.</span>
    </Link>
  );
}
