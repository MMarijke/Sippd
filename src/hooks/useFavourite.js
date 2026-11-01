import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOffline } from '@/lib/offline/OfflineProvider';
import { setFavourite } from '@/lib/offline/outbox';

/**
 * Hook to toggle a favourite on a UserCollection item, online or offline.
 * The change lands locally at once; sync replays it through
 * toggle_favourite(), which keeps community_favourites on the shared can in
 * step server-side. The outbox stores the target value, not a toggle, so a
 * replay can never flip it back (see lib/offline/outbox.js).
 */
export function useFavourite() {
  const { write } = useOffline();

  const { mutate: toggleFavourite, isPending } = useMutation({
    mutationFn: ({ collectionItem }) =>
      write((db) => setFavourite(db, { id: collectionItem.id, value: !collectionItem.is_favourite })),
    onError: (error) => {
      toast.error(error.message || 'Failed to update favourite');
    },
  });

  return { toggleFavourite, isPending };
}
