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
import { getItemScore, getDisplayRarity } from '@/lib/rarityConsensus';
import { useStreakStatus } from '@/lib/useStreak';
import { format } from 'date-fns';
import { computeAchievements } from '@/lib/achievements';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';

export default function Home() {
  const { user } = useAuth();
  const [selectedBrand, setSelectedBrand] = useState('All');

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
  const { current: toAnimate, dismissCurrent } = useAchievementUnlock(achievements);

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const collected = useMemo(
    () => collection.filter(c => c.status === 'collected'),
    [collection]
  );

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    return sc ? getDisplayRarity(sc) : (item.can_rarity || 'Common');
  };

  const rarePulls = useMemo(
    () => collected.filter(c =>
      ['Rare', 'Ultra Rare', 'Legendary'].includes(getEffectiveRarity(c))
    ).length,
    [collected, sharedCansMap]
  );

  const score = useMemo(
    () => collected.reduce((acc, c) => acc + getItemScore(c, sharedCansMap[c.can_id]), 0),
    [collected, sharedCansMap]
  );

  const wishlistCount = useMemo(
    () => collection.filter(c => c.status === 'wishlist').length,
    [collection]
  );

  const brands = useMemo(
    () => ['All', ...new Set(collected.map(c => c.can_brand).filter(Boolean))].slice(0, 9),
    [collected]
  );

  // Excludes hasCollectionError: a failed fetch also leaves `collected`
  // at its empty default, and a fetch failure is not the same thing as a
  // genuinely empty vault — it should show the retry card, not a
  // "welcome, add your first can" message.
  const isNewUser = !isLoading && !hasCollectionError && collected.length === 0;

  return (
    <div className="home-gradient-bg">
      {toAnimate && <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />}
      <PageHeader
        title="SIPPD"
        subtitle={profile?.full_name ? `${profile.full_name}'s vault` : 'Your Energy Drink Vault'}
        action={
          <Link to="/scan">
            <Button size="sm" className="h-11 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              <ScanLine className="w-4 h-4" /> Scan
            </Button>
          </Link>
        }
      />

      {hasCollectionError ? (
        <div className="px-5 mt-5">
          {/* Sits in the same gradient zone as the glass-card hero blocks below —
              matches that translucent treatment but keeps an explicit destructive
              border rather than .glass-card's own, so the error state stays visible
              rather than losing to the class's border in the cascade. */}
          <div className="bg-card/55 backdrop-blur-xl border border-destructive/30 rounded-2xl p-5 text-center">
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
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          {isNewUser && (
            <div className="px-5 mt-5">
              <div className="glass-card rounded-2xl p-5 text-center">
                <p className="text-sm font-display font-semibold text-foreground">Welcome to Sippd</p>
                <p className="text-xs font-mono text-muted-foreground mt-1.5">
                  Scan your first can to start building your vault.
                </p>
                <Link to="/scan" className="inline-block mt-3">
                  <Button size="sm" className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                    <ScanLine className="w-4 h-4" /> Scan Your First Can
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <div className="px-5 mt-5">
            <RarityHero collected={collected} sharedCansMap={sharedCansMap} isLoading={isLoading} />
          </div>

          {!isNewUser && (
            <div className="px-5 mt-5">
              {/* .glass-card-hero, not .glass-card — Score is the page's
                  headline metric and needs to read as categorically
                  different from the welcome/error cards' neutral glass,
                  not just another instance of it. */}
              <div className="glass-card-hero rounded-2xl p-5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
                  COLLECTION SCORE
                </p>
                <p className="text-5xl font-mono font-black text-foreground neon-text">
                  {isLoading ? '—' : score}
                </p>
                <p className="text-xs font-mono text-muted-foreground">
                  Your Energy Drink Vault
                </p>
              </div>
            </div>
          )}

          <div className="mt-5">
            <StatsRow
              rarePulls={isLoading ? '—' : rarePulls}
              streak={streakLoading ? '—' : `${streak}d`}
              wishlistCount={isLoading ? '—' : wishlistCount}
            />
          </div>
        </>
      )}

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
          <p className="px-5 mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Browse by Brand
          </p>
          <div className="flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
            {brands.map(brand => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                aria-pressed={selectedBrand === brand}
                className={cn(
                  'flex-shrink-0 h-10 px-4 flex items-center rounded-full text-xs font-mono font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedBrand === brand
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary border border-border text-muted-foreground hover:border-primary/30'
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
            <BarChart2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-semibold text-foreground tracking-wide">Monthly Report</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{format(new Date(), 'MMMM yyyy')} · Tap to view</p>
          </div>
          <span className="text-xs font-mono text-primary">→</span>
        </div>
      </Link>
    </div>
  );
}
