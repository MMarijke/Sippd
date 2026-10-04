import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { ScanLine, BarChart2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/shared/PageHeader';
import StatsRow from '@/components/dashboard/StatsRow';
import RarityHero from '@/components/dashboard/RarityHero';
import FeedPreview from '@/components/dashboard/FeedPreview';
import SpotlightCarousel from '@/components/dashboard/SpotlightCarousel';
import StandingCard from '@/components/dashboard/StandingCard';
import { useProfileShowcase } from '@/hooks/useProfileShowcase';
import { useStreakStatus } from '@/lib/useStreak';
import { format } from 'date-fns';
import { computeAchievements } from '@/lib/achievements';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';

export default function Home() {
  const { user } = useAuth();
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [canView, setCanView] = useState('recent');

  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    data: collection = [],
    isLoading: loadingCollection,
    isError: isCollectionError,
    refetch: refetchCollection,
  } = useQuery({
    queryKey: ['user-collection', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchOnMount: true,
  });

  const {
    data: sharedCans = [],
    isLoading: loadingShared,
    isError: isSharedCansError,
    refetch: refetchSharedCans,
  } = useQuery({
    queryKey: ['shared-cans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_cans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    refetchOnMount: true,
  });

  const { streak, isLoading: streakLoading } = useStreakStatus();
  const isLoading = !user || loadingCollection || loadingShared;
  // Profile and votes fetch failures already degrade gracefully (subtitle
  // falls back to default text; achievements just see 0 votes) without
  // misrepresenting the user's data, so only these two — which otherwise
  // silently render as "0 cans" on a fetch failure — get a visible retry.
  const hasCollectionError = isCollectionError || isSharedCansError;
  const retryCollection = () => {
    refetchCollection();
    refetchSharedCans();
  };

  const { data: votes = [] } = useQuery({
    queryKey: ['my-votes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rarity_votes')
        .select('*')
        .eq('voter_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const achievements = useMemo(
    () => computeAchievements(collection, streak, votes.length, user?.created_at),
    [collection, streak, votes.length, user?.created_at]
  );
  const { current: toAnimate, dismissCurrent } = useAchievementUnlock(achievements, user?.id);

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const collected = useMemo(
    () => collection.filter(c => c.status === 'collected'),
    [collection]
  );

  // The leaderboard's own numbers (the synced leaderboard_scores row, with a
  // client mirror of the same rule as fallback), so Home can never show a
  // different score or rare-pull count from Ranks and Profile. Home used to
  // compute its own with getItemScore/getDisplayRarity, which could differ.
  const standing = useProfileShowcase({
    withRankGap: true,
    userId: user?.id,
    collection,
    sharedCansMap,
    streak,
    voteCount: votes.length,
    userCreatedDate: user?.created_at,
  });

  const wishlistCount = useMemo(
    () => collection.filter(c => c.status === 'wishlist').length,
    [collection]
  );

  // Capped at 6 (was 9) — more than double the ~4-item working-memory
  // guideline for a single decision point, per the Home critique's
  // cognitive-load finding (.impeccable/critique/2026-09-11T13-24-04Z).
  const brands = useMemo(
    () => ['All', ...new Set(collected.map(c => c.can_brand).filter(Boolean))].slice(0, 6),
    [collected]
  );

  // Excludes hasCollectionError: a failed fetch also leaves `collected`
  // at its empty default, and a fetch failure is not the same thing as a
  // genuinely empty vault — it should show the retry card, not a
  // "welcome, add your first can" message.
  const isNewUser = !isLoading && !hasCollectionError && collected.length === 0;

  // Brand chips, now inside the "Your cans" section they filter.
  const brandChips = brands.length > 1 ? (
    <div className="flex gap-2 overflow-x-auto scroll-px-5 px-5 pb-3 scrollbar-none" role="group" aria-label="Filter your cans by brand">
      {brands.map(brand => (
        <button
          key={brand}
          type="button"
          onClick={() => setSelectedBrand(brand)}
          aria-pressed={selectedBrand === brand}
          className={cn(
            'flex-shrink-0 h-11 px-4 flex items-center rounded-full text-xs font-mono font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selectedBrand === brand
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary border border-border text-muted-foreground hover:border-primary/30'
          )}
        >
          {brand}
        </button>
      ))}
    </div>
  ) : null;

  const statsRow = (
    <StatsRow
      showRarePulls={isNewUser}
      rarePulls={standing.rarePulls}
      streak={`${streak}d`}
      wishlistCount={wishlistCount}
      isLoadingRarePulls={isLoading}
      isLoadingStreak={isLoading || streakLoading}
      isLoadingWishlist={isLoading}
    />
  );

  // Reading order (/impeccable layout): where you stand, your cans, your
  // collection's make-up, then what everyone else is doing. It used to open
  // on a rarity gauge, a score card and three stat boxes, with the first
  // can ~1000px down and no rank anywhere.
  return (
    <div className="pb-2">
      {toAnimate && <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />}

      {/* Hero zone: header plus your standing (or the welcome/error card).
          The gradient layer fills this wrapper, so it fits whichever is
          showing. */}
      <div className="relative">
        <div className="home-gradient-bg-layer" aria-hidden="true" />
        <div className="relative z-10 pb-1">
          <PageHeader
            title="SIPPD"
            subtitle={profile?.full_name ? `${profile.full_name}'s vault` : 'Your Vault'}
            action={
              // asChild: one focusable link styled as a button, not a button
              // nested inside a link (two Tab stops for one action).
              <Button asChild size="sm" className="h-11 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/scan">
                  <ScanLine className="w-4 h-4" aria-hidden="true" /> Scan
                </Link>
              </Button>
            }
          />

          {hasCollectionError ? (
            <div className="px-5 mt-1">
              <div className="glass-card-destructive rounded-2xl p-5 text-center">
                <p className="text-sm font-display font-semibold text-foreground">Couldn't load your vault</p>
                <p className="text-xs font-mono text-muted-foreground mt-1.5">
                  Check your connection and try again.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 font-mono text-xs gap-1.5 mt-3 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={retryCollection}
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" /> Retry
                </Button>
              </div>
            </div>
          ) : isNewUser ? (
            <div className="px-5 mt-1">
              <div className="glass-card rounded-2xl p-5 text-center">
                <p className="text-sm font-display font-semibold text-foreground">Welcome to Sippd</p>
                <p className="text-xs font-mono text-muted-foreground mt-1.5">
                  Scan your first can to start building your vault.
                </p>
                <Button asChild size="sm" className="h-11 mt-3 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to="/scan">
                    <ScanLine className="w-4 h-4" aria-hidden="true" /> Scan Your First Can
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-5 mt-1">
              <StandingCard
                isLoading={isLoading || standing.isStatsLoading}
                isRankError={standing.isRankError}
                rank={standing.rank}
                rankTotal={standing.rankTotal}
                score={standing.score}
                rarePulls={standing.rarePulls}
                weeklyPoints={standing.weeklyPoints}
                gap={standing.pointsToNextRank}
                nextRank={standing.nextRank}
                rivalName={standing.rivalName}
              />
            </div>
          )}
        </div>
      </div>

      {!hasCollectionError && !isNewUser && (
        <div className="mt-8">
          <SpotlightCarousel
            collected={collected}
            sharedCansMap={sharedCansMap}
            selectedBrand={selectedBrand}
            isLoading={isLoading}
            view={canView}
            onViewChange={setCanView}
            filters={brandChips}
          />
        </div>
      )}

      {!hasCollectionError && !isNewUser && (
        <section className="mt-8" aria-labelledby="home-collection-heading">
          <h2 id="home-collection-heading" className="px-5 mb-3 text-base font-display font-bold text-foreground">
            Your collection
          </h2>
          <div className="px-5">
            <div className="bg-card border border-border rounded-2xl px-4 pt-4 pb-3">
              <RarityHero compact collected={collected} sharedCansMap={sharedCansMap} isLoading={isLoading} />
            </div>
          </div>
          <div className="mt-3">{statsRow}</div>
        </section>
      )}

      {isNewUser && <div className="mt-5">{statsRow}</div>}

      <div className="px-5 mt-8">
        {isNewUser && (
          <p className="text-xs font-mono text-muted-foreground mb-2">
            While you're getting started, see what other collectors are up to:
          </p>
        )}
        <FeedPreview />
      </div>

      {isNewUser && (
        <div className="mt-5">
          <SpotlightCarousel collected={collected} sharedCansMap={sharedCansMap} selectedBrand="All" isLoading={isLoading} />
        </div>
      )}

      {/* Monthly Report CTA */}
      <Link to="/monthly-report" className="block px-5 mt-5">
        <div className="flex items-center gap-4 bg-card border border-primary/20 rounded-xl p-4 hover:border-primary/40 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <BarChart2 className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-semibold text-foreground tracking-wide">Monthly Report</p>
            <p className="text-2xs font-mono text-muted-foreground mt-0.5">{format(new Date(), 'MMMM yyyy')} · Tap to view</p>
          </div>
          <span className="text-xs font-mono text-primary" aria-hidden="true">→</span>
        </div>
      </Link>
    </div>
  );
}
