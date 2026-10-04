import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import AchievementBadge from '@/components/achievements/AchievementBadge';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';
import { ACHIEVEMENT_DEFINITIONS, computeAchievements, sortAchievementsForGallery } from '@/lib/achievements';
import { useStreak } from '@/lib/useStreak';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';

export default function Achievements() {
  const navigate = useNavigate();
  const streak = useStreak();
  const { user } = useAuth();

  const {
    data: collection = [],
    isLoading: isLoadingCollection,
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
  });

  const {
    data: votes = [],
    isLoading: isLoadingVotes,
    isError: isVotesError,
    refetch: refetchVotes,
  } = useQuery({
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

  const isLoading = isLoadingCollection || isLoadingVotes;
  const isError = isCollectionError || isVotesError;

  useEffect(() => {
    if (isCollectionError) toast.error('Could not load your collection');
    if (isVotesError) toast.error('Could not load your votes');
  }, [isCollectionError, isVotesError]);

  const achievements = useMemo(
    () => computeAchievements(collection, streak, votes.length, user?.created_at),
    [collection, streak, votes.length, user?.created_at]
  );
  const unlocked = achievements.filter(a => a.unlocked).length;
  // Unlocked-first, then closest-to-unlocking — the same ordering already
  // used for Profile's compact strip, so the dedicated gallery page is at
  // least as well-organized as the preview that links to it.
  const sortedAchievements = useMemo(
    () => sortAchievementsForGallery(achievements),
    [achievements]
  );

  const { current: toAnimate, dismissCurrent } = useAchievementUnlock(achievements, user?.id);

  return (
    <div className="min-h-screen bg-background">
      {toAnimate && (
        <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />
      )}

      <PageHeader
        title="Achievements"
        subtitle={isLoading ? '...' : isError ? 'Unavailable' : `${unlocked} / ${achievements.length} unlocked`}
        onBack={() => navigate('/profile')}
        showBell={false}
      />

      {/* Progress bar */}
      <div className="px-5 mb-5">
        <div className={cn('h-1.5 bg-secondary rounded-full overflow-hidden', isLoading && 'animate-pulse')}>
          {!isLoading && !isError && (
            <div
              className="h-full bg-primary rounded-full transition-all duration-700 neon-glow"
              style={{ width: achievements.length ? `${(unlocked / achievements.length) * 100}%` : '0%' }}
            />
          )}
        </div>
      </div>

      {/* Grid */}
      {isError ? (
        <div className="px-5">
          <div className="bg-card border border-destructive/30 rounded-2xl p-10 flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <p className="text-sm font-display font-semibold text-foreground">Couldn't load your achievements</p>
            <Button
              variant="outline"
              size="sm"
              className="h-11 mt-4 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => { refetchCollection(); refetchVotes(); }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-5">
          {Array.from({ length: ACHIEVEMENT_DEFINITIONS.length }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-card/40 border border-border/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-5">
          {sortedAchievements.map(a => (
            <AchievementBadge key={a.key} achievement={a} />
          ))}
        </div>
      )}
    </div>
  );
}
