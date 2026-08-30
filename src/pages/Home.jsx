import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { ScanLine, BarChart2, Rss } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/shared/PageHeader';
import StatsRow from '@/components/dashboard/StatsRow';
import RarityChart from '@/components/dashboard/RarityChart';
import SpotlightCarousel from '@/components/dashboard/SpotlightCarousel';
import { getItemScore, getDisplayRarity } from '@/lib/rarityConsensus';
import { useStreak } from '@/lib/useStreak';
import { format } from 'date-fns';
import { computeAchievements } from '@/lib/achievements';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';

export default function Home() {
  const { user } = useAuth();
  const [selectedBrand, setSelectedBrand] = useState('All');

  const { data: collection = [], isLoading: loadingCollection } = useQuery({
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

  const { data: sharedCans = [], isLoading: loadingShared } = useQuery({
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

  const streak = useStreak();
  const isLoading = !user || loadingCollection || loadingShared;

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

  const achievements = computeAchievements(collection, streak, votes.length, user?.created_at);
  const { current: toAnimate, dismissCurrent } = useAchievementUnlock(achievements);

  const sharedCansMap = Object.fromEntries(sharedCans.map(c => [c.id, c]));

  const collected = collection.filter(c => c.status === 'collected');

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    return sc ? getDisplayRarity(sc) : (item.can_rarity || 'Common');
  };

  const totalCans = collected.length;

  const rarePulls = collected.filter(c =>
    ['Rare', 'Ultra Rare', 'Legendary'].includes(getEffectiveRarity(c))
  ).length;

  const score = collected.reduce((acc, c) => {
    return acc + getItemScore(c, sharedCansMap[c.can_id]);
  }, 0);

  const wishlistCount = collection.filter(c => c.status === 'wishlist').length;

  const brands = ['All', ...new Set(collected.map(c => c.can_brand).filter(Boolean))].slice(0, 9);

  return (
    <div>
      {toAnimate && <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />}
      <PageHeader
        title="SIPPD"
        subtitle="Your Energy Drink Vault"
        action={
          <Link to="/scan">
            <Button size="sm" className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              <ScanLine className="w-4 h-4" /> Scan
            </Button>
          </Link>
        }
      />

      {/* Hero Stat */}
      <div className="px-5 relative mt-5">
        <div className="relative w-full min-h-[160px] rounded-2xl bg-gradient-to-br from-[#0D2B2B] to-[#080C14] border border-primary/30 p-6">
          {/* Left column: text */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary/60">
              COLLECTION SCORE
            </p>
            <p className="text-5xl font-mono font-black text-foreground">
              {isLoading ? '—' : score}
            </p>
            <p className="text-xs font-mono text-muted-foreground">
              Your Energy Drink Vault
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-mono text-primary">
              {isLoading ? '—' : `${totalCans} cans`}
            </div>
          </div>

          {/* Right column: floating image */}
          {collected.length === 0 || !collected[0]?.can_image_url ? (
            <span className="absolute right-4 -top-6 w-28 h-28 flex items-center justify-center text-6xl opacity-20">⚡</span>
          ) : (
            <img
              src={collected[0].can_image_url}
              alt={collected[0].can_name}
              className="absolute right-4 -top-6 w-28 h-28 object-contain drop-shadow-2xl"
            />
          )}
        </div>
      </div>

      <div className="mt-5">
        <StatsRow
          totalCans={isLoading ? '—' : totalCans}
          rarePulls={isLoading ? '—' : rarePulls}
          streak={streak}
          wishlistCount={isLoading ? '—' : wishlistCount}
        />
      </div>

      {!isLoading && collected.length > 0 && brands.length > 1 && (
        <div className="mt-5">
          <p className="px-5 mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Browse by Brand
          </p>
          <div className="flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
            {brands.map(brand => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={cn(
                  'flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-mono font-semibold transition-all',
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

      {!isLoading && (
        <div className="mt-5">
          <SpotlightCarousel
            collected={collected}
            sharedCansMap={sharedCansMap}
            selectedBrand={selectedBrand}
          />
        </div>
      )}

      {!isLoading && (
        <div className="px-5 mt-5">
          <RarityChart collection={collected} sharedCansMap={sharedCansMap} />
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

      {/* Feed CTA — Feed has no BottomNav entry, this is its primary discovery path */}
      <Link to="/feed" className="block px-5 mt-5">
        <div className="flex items-center gap-4 bg-card border border-primary/20 rounded-xl p-4 hover:border-primary/40 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Rss className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-semibold text-foreground tracking-wide">Activity Feed</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">See what other collectors are pulling</p>
          </div>
          <span className="text-xs font-mono text-primary">→</span>
        </div>
      </Link>
    </div>
  );
}
