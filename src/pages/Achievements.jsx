import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AchievementBadge from '@/components/achievements/AchievementBadge';
import AchievementUnlockAnimation from '@/components/achievements/AchievementUnlockAnimation';
import { computeAchievements } from '@/lib/achievements';
import { useStreak } from '@/lib/useStreak';
import { useAchievementUnlock } from '@/hooks/useAchievementUnlock';

export default function Achievements() {
  const navigate = useNavigate();
  const streak = useStreak();
  const { user } = useAuth();

  const { data: collection = [], isLoading } = useQuery({
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
  const unlocked = achievements.filter(a => a.unlocked).length;

  const { current: toAnimate, dismissCurrent } = useAchievementUnlock(achievements);

  return (
    <div className="bg-background">
      {toAnimate && (
        <AchievementUnlockAnimation achievement={toAnimate} onDismiss={dismissCurrent} />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/profile')}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground tracking-wide">Achievements</h1>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">
            {isLoading ? '...' : `${unlocked} / ${achievements.length} unlocked`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-5">
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 neon-glow"
            style={{ width: achievements.length ? `${(unlocked / achievements.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-5">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-card/40 border border-border/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-5">
          {achievements.map(a => (
            <AchievementBadge key={a.key} achievement={a} />
          ))}
        </div>
      )}
    </div>
  );
}
