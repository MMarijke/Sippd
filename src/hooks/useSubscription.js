import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { freshProCache, readProCache, writeProCache } from '@/lib/offline/proCache';

export function useSubscription() {
  const { user } = useAuth();
  // The last status the server confirmed, if under 7 days old, so Pro stays
  // Pro offline (lib/offline/proCache.js). The live query refreshes it.
  const cached = user?.id ? freshProCache(readProCache(user.id)) : null;

  const { data, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_status, paddle_customer_id')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      writeProCache(user.id, data);
      return data;
    },
    enabled: !!user?.id,
    initialData: cached ? { subscription_status: cached.subscription_status, paddle_customer_id: cached.paddle_customer_id ?? null } : undefined,
    // Still refetch on mount: initialData is a cache, not the truth.
    initialDataUpdatedAt: 0,
  });

  const status = data?.subscription_status || 'free';

  return { isPro: status === 'pro', status, paddleCustomerId: data?.paddle_customer_id ?? null, isLoading: isLoading && !cached };
}
