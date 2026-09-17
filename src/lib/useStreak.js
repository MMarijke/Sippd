import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

/**
 * Ticks the caller's streak server-side via tick_streak() on mount and
 * returns the current streak value (number). All date/streak logic lives
 * in the RPC — this hook just triggers it and reads the result.
 */
export function useStreak() {
  return useStreakStatus().streak;
}

/**
 * Same data as useStreak(), plus isLoading, for callers that need to gate
 * their own display (e.g. Home's StatsRow, which shows a skeleton for its
 * other two stats while loading and would otherwise flash "0d" here first).
 */
export function useStreakStatus() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['streak', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tick_streak', { p_caller_id: user.id });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  return { streak: data?.current_streak ?? 0, isLoading: !user || isLoading };
}
