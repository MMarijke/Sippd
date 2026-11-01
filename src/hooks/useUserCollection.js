import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useOffline } from '@/lib/offline/OfflineProvider';
import { useOnline } from '@/hooks/useOnline';

// The signed-in user's collection (and wishlist: filter on status), read
// from the local-first store, newest first, exactly the shape the pages
// used to fetch from Supabase. Works offline; changes appear the moment a
// write lands locally, and again when sync brings in edits made elsewhere.
//
// A photo taken offline isn't uploaded yet, so its row has no remote URL:
// can_image_url is swapped for a local object URL until the upload lands.
//
// Returns { data, isLoading, isError, error, refetch } like the useQuery it
// replaces.

const objectUrls = new Map(); // blobId -> object URL, shared by every caller

export function useUserCollection() {
  const { db, hydrated, requestSync } = useOffline();
  const online = useOnline();

  const rows = useLiveQuery(async () => {
    if (!db) return [];
    const live = await db.collection.filter((r) => !r._deleted).toArray();
    const blobIds = live.map((r) => r._blobId).filter(Boolean);
    const blobs = blobIds.length ? await db.blobs.bulkGet(blobIds) : [];
    const byId = new Map(blobs.filter(Boolean).map((b) => [b.id, b]));
    return live.map((r) => ({ row: r, blob: r._blobId ? byId.get(r._blobId) : null }));
  }, [db]);

  // Object URLs for photos not yet uploaded; released once synced.
  const data = useMemo(() => {
    if (!rows) return undefined;
    const out = rows.map(({ row, blob }) => {
      // Local-only flags never leave this hook: a row spread into a request
      // must not carry columns the server doesn't have.
      const { _pending: _p, _deleted: _d, _blobId: _b, ...visible } = row;
      if (blob && !blob.uploadedUrl) {
        if (!objectUrls.has(blob.id)) objectUrls.set(blob.id, URL.createObjectURL(blob.blob));
        visible.can_image_url = objectUrls.get(blob.id);
      }
      return visible;
    });
    return out.sort((a, b) => Date.parse(b.created_at ?? 0) - Date.parse(a.created_at ?? 0));
  }, [rows]);

  useEffect(() => {
    if (!rows) return;
    const live = new Set(rows.map(({ blob }) => blob?.id).filter(Boolean));
    for (const [id, url] of objectUrls) {
      if (!live.has(id)) {
        URL.revokeObjectURL(url);
        objectUrls.delete(id);
      }
    }
  }, [rows]);

  return {
    data: data ?? [],
    // Before this device's first sync, an empty table means "not loaded yet",
    // not "no cans": keep showing loading while online.
    isLoading: data === undefined || (!hydrated && online && data.length === 0),
    // Local reads have no network to fail on; sync problems surface in the
    // sync indicator instead of as an error screen over cached data.
    error: null,
    isError: false,
    refetch: requestSync,
  };
}
