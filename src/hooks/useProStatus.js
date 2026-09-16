import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

/**
 * Batched Pro-status lookup for Trophy Case badges — one call per surface
 * (Feed, Leaderboard, Search, Public Profile) covering every visible user
 * id, not one call per row. Returns a Set of ids that are currently Pro;
 * `.has(userId)` is all a caller needs.
 */
export function useProStatus(userIds = []) {
  const ids = useMemo(() => [...new Set(userIds.filter(Boolean))].sort(), [userIds]);

  const { data: proUserIds = new Set() } = useQuery({
    queryKey: ['pro-status', ids],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pro_status', { p_user_ids: ids });
      if (error) throw error;
      return new Set(data.filter(row => row.is_pro).map(row => row.user_id));
    },
    enabled: ids.length > 0,
  });

  return proUserIds;
}
