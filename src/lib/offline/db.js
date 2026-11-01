import Dexie from 'dexie';

// The local-first store (IndexedDB via Dexie). One database per signed-in
// user, so nothing one account wrote can ever be read by the next account
// on the device; signing out deletes it (deleteUserDb). See OFFLINE.md.
//
// Tables:
//   collection  user_collection rows (collection + wishlist, by `status`),
//               plus local-only flags:
//                 _pending  1 while a local change hasn't reached the server
//                 _deleted  1 for a tombstone awaiting its server delete
//                 _blobId   a photo taken offline, not uploaded yet
//   profile     the user's own profiles row (one record)
//   catalog     shared_cans reference rows the user has seen
//   outbox      queued writes, replayed in `seq` order (see outbox.js)
//   blobs       compressed photos waiting to upload
//   meta        pull cursors, last-sync time, cached subscription status

export const dbName = (userId) => `sippd-offline-${userId}`;

export function openUserDb(userId) {
  if (!userId) throw new Error('openUserDb needs a user id');
  const db = new Dexie(dbName(userId));
  db.version(1).stores({
    collection: 'id, can_id, status, updated_at, _pending, _deleted',
    profile: 'id',
    catalog: 'id, barcode',
    outbox: '++seq, id, key, status',
    blobs: 'id',
    meta: 'key',
  });
  return db;
}

export async function deleteUserDb(userId) {
  await Dexie.delete(dbName(userId));
}

export async function getMeta(db, key, fallback = null) {
  const row = await db.meta.get(key);
  return row ? row.value : fallback;
}

export async function setMeta(db, key, value) {
  await db.meta.put({ key, value });
}
