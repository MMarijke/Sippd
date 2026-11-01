import { useLiveQuery } from 'dexie-react-hooks';
import { useOffline } from '@/lib/offline/OfflineProvider';
import { useOnline } from '@/hooks/useOnline';

// The signed-in user's own profiles row, from the local-first store (synced
// with `select *`), so Profile and Settings show it and edit it offline.
// Edits go through lib/offline/outbox.js updateProfile. Theme has its own
// guarded online path in useTheme and isn't edited through here.
//
// Returns { data, isLoading, isError, refetch } like the useQuery it replaces.
export function useMyProfile() {
  const { db, userId, hydrated, requestSync } = useOffline();
  const online = useOnline();
  const row = useLiveQuery(() => (db && userId ? db.profile.get(userId) : undefined), [db, userId]);

  let data;
  if (row) {
    const { _pending: _p, ...profile } = row;
    data = profile;
  }

  return {
    data,
    // Before this device's first sync, a missing row means "not loaded yet".
    isLoading: !data && (!hydrated && online),
    isError: false,
    refetch: requestSync,
  };
}
