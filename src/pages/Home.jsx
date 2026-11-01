import { lazy, Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSharedCansByIds } from '@/hooks/useSharedCansByIds';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { ScanLine, BarChart2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import PageHeader from '@/components/shared/PageHeader';
import StatsRow from '@/components/dashboard/StatsRow';
import FeedPreview from '@/components/dashboard/FeedPreview';
import SpotlightCarousel from '@/components/dashboard/SpotlightCarousel';
import { useProfileShowcase } from '@/hooks/useProfileShowcase';
import { useStreakStatus } from '@/lib/useStreak';
import { format } from 'date-fns';
import { computeAchievements } from '@/lib/achievements';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';
import { useUserCollection } from '@/hooks/useUserCollection';
import { useMyProfile } from '@/hooks/useMyProfile';

// Loaded on demand: it carries the charting library (recharts), the
// biggest dependency in the first download. Home and Login load eagerly,
// so anything they import directly ships to every visitor before the
// first paint; the placeholder holds the gauge's space meanwhile.
const RarityHero = lazy(() => import('@/components/dashboard/RarityHero'));

function GaugePlaceholder() {
  return (
    <div className="relative w-full max-w-[330px] mx-auto mt-6 flex items-end justify-center" style={{ aspectRatio: '2 / 1' }} aria-hidden="true">
      <div className="w-3/4 h-3/4 rounded-t-full bg-secondary/60 animate-pulse" />
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [selectedBrand, setSelectedBrand] = useState('All');

  const { data: profile } = useMyProfile();

  const {
    data: collection = [],
    isLoading: loadingCollection,
    isError: isCollectionError,
    refetch: refetchCollection,
  } = useUserCollection();

  const {
    data: sharedCans = [],
    isLoading: loadingShared,
    isError: isSharedCansError,
    refetch: refetchSharedCans,
  } = useSharedCansByIds(collection.map(i => i.can_id));

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

  // The leaderboard's own score and rare-pull count (the synced
  // leaderboard_scores row, with a client mirror of the same rule as
  // fallback), so Home can't show a different number from Ranks and
  // Profile. It used to compute its own with getItemScore/getDisplayRarity.
  const { score, rarePulls } = useProfileShowcase({
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

  return (
    <div>
      {toAnimate && <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />}

      {/* Hero zone: header + whichever of welcome-card/RarityHero/Score/
          error-card is showing. The gradient layer is absolutely
          positioned and fills this wrapper, so it's sized to this
          zone's actual rendered content, not a fixed pixel guess —
          a short first-time-user stack and a taller returning-user one
          each get a gradient that fits them specifically. */}
      <div className="relative">
        <div className="home-gradient-bg-layer" aria-hidden="true" />
        <div className="relative z-10">
          <PageHeader
            title="SIPPD"
            subtitle={profile?.full_name ? `${profile.full_name}'s vault` : 'Your Vault'}
            // Scan and the selected brand chip wear --cta: the theme's own button
            // fill, so the main action is never quieter than Save.
            action={
              <Button asChild size="sm" className="h-11 rounded-control font-mono text-xs gap-1.5 bg-cta text-cta-foreground hover:bg-cta/90">
                <Link to="/scan">
                  <ScanLine className="w-4 h-4" aria-hidden="true" /> Scan
                </Link>
              </Button>
            }
          />

          {/* mt-1: PageHeader already ends in 16px of padding, so the first
              block under it sits 20px from the header like every other gap
              in this stack (it was 36px: pb-4 + mt-5). */}
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
          ) : (
            <>
              {isNewUser && (
                <div className="px-5 mt-1">
                  <div className="glass-card rounded-2xl p-5 text-center">
                    <p className="text-sm font-display font-semibold text-foreground">Welcome to Sippd</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1.5">
                      Scan your first can to start building your vault.
                    </p>
                    <Button asChild size="sm" className="h-11 mt-3 rounded-control font-mono text-xs gap-1.5 bg-cta text-cta-foreground hover:bg-cta/90">
                      <Link to="/scan">
                        <ScanLine className="w-4 h-4" aria-hidden="true" /> Scan Your First Can
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {!isNewUser && (
                <div className="px-5 mt-1">
                  <Suspense fallback={<GaugePlaceholder />}>
                    <RarityHero collected={collected} sharedCansMap={sharedCansMap} isLoading={isLoading} />
                  </Suspense>
                </div>
              )}

              {!isNewUser && (
                <div className="px-5 mt-5">
                  {/* .glass-card-hero, not .glass-card — Score is the page's
                      headline metric and needs to read as categorically
                      different from the welcome/error cards' neutral glass,
                      not just another instance of it. */}
                  <div className="glass-card-hero rounded-2xl px-5 py-4">
                    {/* text-foreground, not text-primary — on Ultra/Voidglass
                        this label's own theme color measured ~4.2:1 against
                        .glass-card-hero's translucent surface, under WCAG
                        AA's 4.5:1 floor for 10px text. --foreground stays
                        theme-invariant at ~17.5:1+ margins on every theme
                        (see index.css's theme-redesign comment), so this
                        guarantees the fix without per-theme tuning. The
                        card's own primary-tinted border/glow still carries
                        the themed identity. */}
                    <p className="text-2xs font-mono uppercase tracking-widest text-foreground">
                      COLLECTION SCORE
                    </p>
                    {/* No "Your Vault" line under it: it repeated the header's
                        subtitle ("<name>'s vault") a few lines above. */}
                    <p className="text-5xl font-num font-black text-foreground tabular-nums neon-text leading-none mt-2">
                      {isLoading ? (
                        <span className="inline-block h-10 w-24 rounded bg-foreground/10 animate-pulse align-middle" />
                      ) : score}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* StatsRow's own cards are opaque (bg-card), so the gradient
              layer doesn't show through them directly -- but keeping it
              inside the hero-zone wrapper still extends the ambient
              atmosphere into the gaps and margins around them, rather
              than cutting off abruptly right after the Score card. */}
          {!hasCollectionError && (
            <div className="mt-5">
              <StatsRow
                rarePulls={rarePulls}
                streak={streak}
                wishlistCount={wishlistCount}
                isLoadingRarePulls={isLoading}
                isLoadingStreak={isLoading || streakLoading}
                isLoadingWishlist={isLoading}
              />
            </div>
          )}
        </div>
      </div>

      <InstallPrompt />

      <div className="px-5 mt-5">
        {isNewUser && (
          <p className="text-xs font-mono text-muted-foreground mb-2">
            While you're getting started, see what other collectors are up to:
          </p>
        )}
        <FeedPreview />
      </div>

      {!isLoading && !hasCollectionError && collected.length > 0 && brands.length > 1 && (
        <div className="mt-5">
          <div className="px-5 mb-2 flex items-center justify-between">
            <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground">
              Browse by Brand
            </p>
            {brands.length > 4 && (
              <span className="text-2xs font-mono text-muted-foreground">Swipe →</span>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-1 scrollbar-none">
            {brands.map(brand => (
              <button
                key={brand}
                type="button"
                onClick={() => setSelectedBrand(brand)}
                aria-pressed={selectedBrand === brand}
                className={cn(
                  'flex-shrink-0 h-11 px-4 flex items-center rounded-full text-xs font-mono font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedBrand === brand
                    // Border in the fill's colour so the chip keeps the
                    // same 44px box as the outlined ones (no shift on select).
                    ? 'bg-cta text-cta-foreground border border-cta'
                    // Outlined, not filled bg-secondary: muted text there
                    // measured 4.08:1 (Power-Up) and 3.96:1 (Sage).
                    : 'bg-transparent border border-border text-foreground/80 hover:border-cta/60 hover:text-foreground'
                )}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasCollectionError && (
        <div className="mt-5">
          <SpotlightCarousel
            collected={collected}
            sharedCansMap={sharedCansMap}
            selectedBrand={selectedBrand}
            isLoading={isLoading}
          />
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
