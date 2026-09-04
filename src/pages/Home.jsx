import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { ScanLine, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import StatsRow from '@/components/dashboard/StatsRow';
import RarityHero from '@/components/dashboard/RarityHero';
import FeedPreview from '@/components/dashboard/FeedPreview';
import RecentPullsGrid from '@/components/dashboard/RecentPullsGrid';
import { getItemScore, getDisplayRarity } from '@/lib/rarityConsensus';
import { useStreak } from '@/lib/useStreak';
import { format } from 'date-fns';
import { computeAchievements } from '@/lib/achievements';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';

export default function Home() {
  const { user } = useAuth();

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

  return (
    <div>
      {toAnimate && <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />}
      <PageHeader
        title="SIPPD"
        subtitle={profile?.full_name ? `${profile.full_name}'s vault` : 'Your Energy Drink Vault'}
        action={
          <Link to="/scan">
            <Button size="sm" className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              <ScanLine className="w-4 h-4" /> Scan
            </Button>
          </Link>
        }
      />

      <div className="px-5 mt-5">
        <RarityHero collected={isLoading ? [] : collected} sharedCansMap={sharedCansMap} />
      </div>

      <div className="px-5 mt-5">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary/60">
            COLLECTION SCORE
          </p>
          <p className="text-5xl font-mono font-black text-foreground">
            {isLoading ? '—' : score}
          </p>
          <p className="text-xs font-mono text-muted-foreground">
            Your Energy Drink Vault
          </p>
        </div>
      </div>

      <div className="mt-5">
        <StatsRow
          rarePulls={isLoading ? '—' : rarePulls}
          streak={streak}
          wishlistCount={isLoading ? '—' : wishlistCount}
        />
      </div>

      <div className="px-5 mt-5">
        <FeedPreview />
      </div>

      {!isLoading && (
        <div className="mt-5">
          <RecentPullsGrid collected={collected} sharedCansMap={sharedCansMap} />
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
