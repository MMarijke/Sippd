import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { MapPin, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

export default function RegionalLeaderboard() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['my-profile', currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['leaderboard-scores-regional', profile?.region],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select('*')
        .ilike('region', profile?.region || '')
        .order('score', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.region,
  });

  if (!profile?.region) {
    return (
      <div className="px-5">
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center">
          <MapPin className="w-10 h-10 text-primary mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Set your region in Settings to see local collectors</p>
          <Button
            className="mt-4 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => navigate('/settings')}
          >
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  const ranked = scores.filter(s => s.total_cans > 0);
  const isEmpty = !isLoading && ranked.length === 0;

  return (
    <div className="px-5">
      {isEmpty ? (
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center">
          <Crown className="w-10 h-10 text-primary mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">You're the first Sippd collector in your area! 🎉</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">{profile.region}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {ranked.map((entry, i) => {
            const isMe = entry.user_id === currentUser?.id;
            const isMedal = i < 3;
            const name = entry.full_name || 'Collector';
            const initial = name.charAt(0).toUpperCase();
            return (
              <div
                key={entry.user_id}
                className={cn('flex items-center gap-3 px-4 py-3', isMe && 'bg-primary/5 border-l-2 border-primary')}
              >
                <div className="w-7 flex-shrink-0 text-center">
                  {isMedal ? (
                    <span className={cn('text-base', MEDAL_COLORS[i])}>{MEDAL[i]}</span>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                  )}
                </div>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-display font-bold flex-shrink-0',
                  isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                )}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold truncate', isMe ? 'text-primary' : 'text-foreground')}>
                    {name}
                    {isMe && <span className="ml-1.5 text-[10px] font-mono text-primary/70">(you)</span>}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={cn('text-sm font-display font-bold tabular-nums', isMe ? 'text-primary' : 'text-foreground')}>
                    {entry.score}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">score</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
