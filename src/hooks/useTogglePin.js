import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOffline } from '@/lib/offline/OfflineProvider';
import { updateCollection } from '@/lib/offline/outbox';

export const MAX_PINS_FREE = 6;
export const MAX_PINS_PRO = 10;

export function getMaxPins(isPro) {
  return isPro ? MAX_PINS_PRO : MAX_PINS_FREE;
}

/**
 * Hook to pin/unpin a UserCollection item for the Profile page's Top Pulls
 * showcase. Purely personal (no cross-table aggregate), so it's an ordinary
 * offline row edit: local at once, synced under the user_collection RLS
 * policies (see lib/offline/outbox.js).
 */
export function useTogglePin() {
  const { write } = useOffline();

  const { mutate: togglePin, isPending } = useMutation({
    mutationFn: async ({ collectionItem, pinnedCount, isPro }) => {
      const isPinned = !!collectionItem.pinned_at;
      const maxPins = getMaxPins(isPro);
      if (!isPinned && pinnedCount >= maxPins) {
        throw new Error(`You can pin up to ${maxPins} cans — unpin one first.`);
      }
      await write((db, userId) => updateCollection(db, {
        userId,
        id: collectionItem.id,
        patch: { pinned_at: isPinned ? null : new Date().toISOString() },
      }));
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update pin');
    },
  });

  return { togglePin, isPending };
}
