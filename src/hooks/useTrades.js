import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

/**
 * A collector's own trade log. One query shared by the Trades page (the
 * full ledger with filters and actions) and Profile's summary row
 * ("12 trades · 2 pending"), so both read the same cache and a status
 * change on one shows on the other. TradeHistory's mutations invalidate
 * ['trades'], which covers this key.
 */
export function useTrades(userId) {
  return useQuery({
    queryKey: ['trades', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}
