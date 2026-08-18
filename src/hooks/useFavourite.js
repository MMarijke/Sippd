import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook to toggle a favourite on a UserCollection item.
 * Also increments/decrements community_favourites on the SharedCan.
 */
export function useFavourite() {
  const queryClient = useQueryClient();

  const { mutate: toggleFavourite, isPending } = useMutation({
    mutationFn: async ({ collectionItem, sharedCan }) => {
      const newValue = !collectionItem.is_favourite;

      // 1. Update the user's collection record
      await base44.entities.UserCollection.update(collectionItem.id, { is_favourite: newValue });

      // 2. Update community_favourites on the shared can
      if (sharedCan) {
        const current = sharedCan.community_favourites || 0;
        const updated = Math.max(0, newValue ? current + 1 : current - 1);
        await base44.entities.SharedCan.update(sharedCan.id, { community_favourites: updated });
      }

      return newValue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      queryClient.invalidateQueries({ queryKey: ['shared-cans'] });
    },
  });

  return { toggleFavourite, isPending };
}