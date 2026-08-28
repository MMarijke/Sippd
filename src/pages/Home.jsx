import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { ScanLine, Zap, BarChart2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import StatsRow from '@/components/dashboard/StatsRow';
import RarityChart from '@/components/dashboard/RarityChart';
import RecentPulls from '@/components/dashboard/RecentPulls';
import { getItemScore, getDisplayRarity } from '@/lib/rarityConsensus';
import { useStreak } from '@/lib/useStreak';
import { format } from 'date-fns';
import { computeAchievements } from '@/lib/achievements';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';
import { useNotifications } from '@/hooks/useNotifications';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications(user);

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

  return (
    <div className="space-y-5">
      {toAnimate && <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />}
      <PageHeader
        title="SIPPD"
        subtitle="Your Energy Drink Vault"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/notifications')}
              className="relative w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center text-[9px] font-mono font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <Link to="/scan">
              <Button size="sm" className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                <ScanLine className="w-4 h-4" /> Scan
              </Button>
            </Link>
          </div>
        }
      />

      {/* Hero Stat */}
      <div className="px-5">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-2xl p-6 neon-border">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          <div className="flex items-center gap-3 mb-1">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-xs font-mono text-primary uppercase tracking-widest">Collection Score</span>
          </div>
          <p className="text-5xl font-body font-black text-foreground neon-text">
            {isLoading ? '—' : score}
          </p>
          <p className="text-xs font-mono text-muted-foreground mt-2">
            {isLoading ? '…' : `${totalCans} cans in your vault`}
          </p>
        </div>
      </div>

      <StatsRow
        totalCans={isLoading ? '—' : totalCans}
        rarePulls={isLoading ? '—' : rarePulls}
        streak={streak}
        wishlistCount={isLoading ? '—' : wishlistCount}
      />

      <div className="px-5 space-y-4">
        <RarityChart collection={collected} sharedCansMap={sharedCansMap} />

        {/* Monthly Report CTA */}
        <Link to="/monthly-report">
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

        <RecentPulls recentItems={collected.slice(0, 5)} />
      </div>
    </div>
  );
}
