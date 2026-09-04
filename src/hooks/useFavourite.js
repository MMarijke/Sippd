import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

/**
 * Hook to toggle a favourite on a UserCollection item.
 * toggle_favourite() keeps community_favourites on the shared can in sync
 * atomically server-side — nothing else to do here.
 */
export function useFavourite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { mutate: toggleFavourite, isPending } = useMutation({
    mutationFn: async ({ collectionItem }) => {
      const { data, error } = await supabase.rpc('toggle_favourite', {
        p_caller_id: user.id,
        p_collection_id: collectionItem.id,
      });
      if (error) throw error;
      return data.is_favourite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      queryClient.invalidateQueries({ queryKey: ['shared-cans'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update favourite');
    },
  });

  return { toggleFavourite, isPending };
}
