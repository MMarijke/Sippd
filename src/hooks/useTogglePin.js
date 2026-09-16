import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

export const MAX_PINS_FREE = 6;
export const MAX_PINS_PRO = 10;

export function getMaxPins(isPro) {
  return isPro ? MAX_PINS_PRO : MAX_PINS_FREE;
}

/**
 * Hook to pin/unpin a UserCollection item for the Profile page's Top Pulls
 * showcase. Purely personal — no cross-table aggregate to keep in sync, so
 * (unlike useFavourite) this writes directly under the existing
 * user_collection RLS policies rather than through an RPC.
 */
export function useTogglePin() {
  const queryClient = useQueryClient();

  const { mutate: togglePin, isPending } = useMutation({
    mutationFn: async ({ collectionItem, pinnedCount, isPro }) => {
      const isPinned = !!collectionItem.pinned_at;
      const maxPins = getMaxPins(isPro);
      if (!isPinned && pinnedCount >= maxPins) {
        throw new Error(`You can pin up to ${maxPins} cans — unpin one first.`);
      }
      const { error } = await supabase
        .from('user_collection')
        .update({ pinned_at: isPinned ? null : new Date().toISOString() })
        .eq('id', collectionItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update pin');
    },
  });

  return { togglePin, isPending };
}
