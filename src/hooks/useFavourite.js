import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

/**
 * Hook to toggle a favourite on a UserCollection item.
 * toggle_favourite() keeps community_favourites on the shared can in sync
 * atomically server-side — nothing else to do here.
 */
export function useFavourite() {
  const queryClient = useQueryClient();

  const { mutate: toggleFavourite, isPending } = useMutation({
    mutationFn: async ({ collectionItem }) => {
      const { data, error } = await supabase.rpc('toggle_favourite', {
        p_collection_id: collectionItem.id,
      });
      if (error) throw error;
      return data.is_favourite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      queryClient.invalidateQueries({ queryKey: ['shared-cans'] });
    },
  });

  return { toggleFavourite, isPending };
}
