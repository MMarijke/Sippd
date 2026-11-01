import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '@/lib/supabaseClient';
import { fetchSharedCansByIds, uniqueIds } from '@/lib/sharedCans';
import { useOffline } from '@/lib/offline/OfflineProvider';

/**
 * The shared_cans rows behind a set of collection items — exactly those, not
 * a newest-500 window that older cans fall out of. Pass the can ids the page
 * shows (e.g. collection.map(i => i.can_id)). Keyed under 'shared-cans' so
 * the existing invalidateQueries({ queryKey: ['shared-cans'] }) calls after
 * a vote or favourite still refresh it. Keeps the previous rows while a
 * changed id set loads, so adding a can doesn't blank every tile.
 *
 * Offline-friendly: every row fetched is kept in the local catalog
 * (lib/offline), and while offline (React Query pauses the fetch) the page
 * gets those last-known rows instead of nothing. Signed out, there is no
 * local catalog and it behaves exactly as before.
 */
export function useSharedCansByIds(canIds = []) {
  const ids = useMemo(() => uniqueIds(canIds), [canIds]);
  const { db } = useOffline();

  const local = useLiveQuery(
    async () => (db && ids.length ? (await db.catalog.bulkGet(ids)).filter(Boolean) : []),
    [db, ids.join(',')],
  );

  const query = useQuery({
    queryKey: ['shared-cans', 'by-id', ids],
    queryFn: async () => {
      const rows = await fetchSharedCansByIds(supabase, ids);
      if (db && rows.length) db.catalog.bulkPut(rows).catch(() => { /* a full disk only costs the offline copy */ });
      return rows;
    },
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });

  const useLocal = query.data === undefined && local?.length > 0;
  return useLocal ? { ...query, data: local, isLoading: false } : query;
}
