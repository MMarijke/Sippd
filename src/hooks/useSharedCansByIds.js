import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { fetchSharedCansByIds, uniqueIds } from '@/lib/sharedCans';

/**
 * The shared_cans rows behind a set of collection items — exactly those, not
 * a newest-500 window that older cans fall out of. Pass the can ids the page
 * shows (e.g. collection.map(i => i.can_id)). Keyed under 'shared-cans' so
 * the existing invalidateQueries({ queryKey: ['shared-cans'] }) calls after
 * a vote or favourite still refresh it. Keeps the previous rows while a
 * changed id set loads, so adding a can doesn't blank every tile.
 */
export function useSharedCansByIds(canIds = []) {
  const ids = useMemo(() => uniqueIds(canIds), [canIds]);

  return useQuery({
    queryKey: ['shared-cans', 'by-id', ids],
    queryFn: () => fetchSharedCansByIds(supabase, ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });
}
