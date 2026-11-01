// Offline-capable writes. Each one updates the local row (so the UI, which
// reads Dexie through live queries, changes at once) and queues an outbox
// entry in the SAME transaction, so a crash can never leave one without the
// other. The sync engine (sync.js) replays the outbox in `seq` order.
//
// Outbox entry: { seq, id, key, kind, payload, status, attempts,
//                 nextAttemptAt, lastError, createdAt }
//   key     the record it belongs to ('collection:<id>', 'profile'):
//           entries for one key replay strictly in order, and a failed
//           entry holds back the ones after it for that key only.
//   kind    blob.upload | collection.add | collection.upsert |
//           collection.delete | collection.favourite | profile.update
//   status  pending | failed
//
// Edits are coalesced: a record has at most one queued add/upsert/profile
// update, and the push always sends the record's LATEST local state, so
// ten offline edits cost one request.

const newId = () => globalThis.crypto.randomUUID();
const nowIso = (now = Date.now) => new Date(now()).toISOString();

const collectionKey = (id) => `collection:${id}`;

function entry(kind, key, payload, now) {
  return { id: newId(), key, kind, payload, status: 'pending', attempts: 0, nextAttemptAt: 0, lastError: null, createdAt: nowIso(now) };
}

async function pendingFor(db, key) {
  return db.outbox.where('key').equals(key).filter((e) => e.status === 'pending').toArray();
}

// Adds a can (collection or wishlist, by row.status). `catalog` is what
// vote_on_can needs: { canId?, alreadyVoted?, rarity, name, brand, flavour,
// edition, barcode, beverageType, imageUrl }, or { canId, skipVote: true }
// to add an existing catalog can with no rarity vote (a wishlist add). `photo` is an already
// compressed Blob taken offline; it uploads first, then the can is added
// with the uploaded URL (blob before row).
export async function addCan(db, { userId, row, catalog, photo = null, now = Date.now }) {
  const id = row.id ?? newId();
  const key = collectionKey(id);
  const stamp = nowIso(now);
  const blobId = photo ? newId() : null;
  const local = {
    ...row,
    id,
    owner_id: userId,
    can_id: catalog.canId ?? row.can_id ?? null,
    created_at: row.created_at ?? stamp,
    updated_at: stamp,
    is_favourite: false,
    _pending: 1,
    _deleted: 0,
    _blobId: blobId,
  };
  await db.transaction('rw', db.collection, db.outbox, db.blobs, async () => {
    await db.collection.put(local);
    if (photo) {
      await db.blobs.put({ id: blobId, blob: photo, type: photo.type || 'image/webp', path: `${userId}/${id}.webp`, uploadedUrl: null });
      await db.outbox.add(entry('blob.upload', key, { blobId, rowId: id }, now));
    }
    await db.outbox.add(entry('collection.add', key, { id, catalog }, now));
  });
  return local;
}

// Edits a collection row. `photo` (optional) replaces its image: uploaded
// first, then the edit is pushed with the new URL.
export async function updateCollection(db, { userId, id, patch, photo = null, now = Date.now }) {
  const key = collectionKey(id);
  await db.transaction('rw', db.collection, db.outbox, db.blobs, async () => {
    const current = await db.collection.get(id);
    if (!current || current._deleted) return;
    const blobId = photo ? newId() : current._blobId ?? null;
    await db.collection.put({ ...current, ...patch, id, updated_at: nowIso(now), _pending: 1, _blobId: blobId });
    const queued = await pendingFor(db, key);
    if (photo) {
      await db.blobs.put({ id: blobId, blob: photo, type: photo.type || 'image/webp', path: `${userId}/${id}-${Date.now()}.webp`, uploadedUrl: null });
      await db.outbox.add(entry('blob.upload', key, { blobId, rowId: id }, now));
    }
    // An unsent add or upsert already pushes the latest row: nothing to add,
    // unless a photo was just queued after it (the row must follow the photo).
    const hasRowWrite = queued.some((e) => e.kind === 'collection.add' || e.kind === 'collection.upsert');
    if (!hasRowWrite || photo) await db.outbox.add(entry('collection.upsert', key, { id }, now));
  });
}

// Removes a can. If it never reached the server, it just disappears (with
// its queued writes and photo); otherwise it becomes a tombstone until the
// server delete lands.
export async function deleteCollection(db, { id, now = Date.now }) {
  const key = collectionKey(id);
  await db.transaction('rw', db.collection, db.outbox, db.blobs, async () => {
    const current = await db.collection.get(id);
    if (!current) return;
    const queued = await db.outbox.where('key').equals(key).toArray();
    const neverSynced = queued.some((e) => e.kind === 'collection.add');
    if (neverSynced) {
      await db.outbox.bulkDelete(queued.map((e) => e.seq));
      for (const e of queued) if (e.kind === 'blob.upload') await db.blobs.delete(e.payload.blobId);
      await db.collection.delete(id);
      return;
    }
    // Earlier edits to a row that's going away are moot.
    await db.outbox.bulkDelete(queued.filter((e) => e.status === 'pending').map((e) => e.seq));
    await db.collection.put({ ...current, updated_at: nowIso(now), _pending: 1, _deleted: 1 });
    await db.outbox.add(entry('collection.delete', key, { id }, now));
  });
}

// Favourites go through toggle_favourite(), which is a toggle, not a set:
// the outbox stores the TARGET value and the push only toggles when the
// server disagrees, so replays can never flip it back.
export async function setFavourite(db, { id, value, now = Date.now }) {
  const key = collectionKey(id);
  await db.transaction('rw', db.collection, db.outbox, async () => {
    const current = await db.collection.get(id);
    if (!current || current._deleted) return;
    await db.collection.put({ ...current, is_favourite: Boolean(value) });
    const queued = (await pendingFor(db, key)).find((e) => e.kind === 'collection.favourite');
    if (queued) await db.outbox.update(queued.seq, { payload: { id, value: Boolean(value) } });
    else await db.outbox.add(entry('collection.favourite', key, { id, value: Boolean(value) }, now));
  });
}

export async function updateProfile(db, { userId, patch, now = Date.now }) {
  await db.transaction('rw', db.profile, db.outbox, async () => {
    const current = (await db.profile.get(userId)) ?? { id: userId };
    await db.profile.put({ ...current, ...patch, id: userId, updated_at: nowIso(now), _pending: 1 });
    const queued = (await pendingFor(db, 'profile')).find((e) => e.kind === 'profile.update');
    if (!queued) await db.outbox.add(entry('profile.update', 'profile', {}, now));
  });
}

export async function outboxCounts(db) {
  const all = await db.outbox.toArray();
  return {
    pending: all.filter((e) => e.status === 'pending').length,
    failed: all.filter((e) => e.status === 'failed').length,
  };
}

export async function failedEntries(db) {
  return db.outbox.where('status').equals('failed').toArray();
}

export async function retryFailed(db) {
  const failed = await failedEntries(db);
  await db.outbox.bulkPut(failed.map((e) => ({ ...e, status: 'pending', attempts: 0, nextAttemptAt: 0, lastError: null })));
}

// Gives up on a failed entry: drops it and every later entry for the same
// record. The record itself is re-pulled from the server on the next sync.
export async function discardFailed(db, seq) {
  const failed = await db.outbox.get(seq);
  if (!failed) return;
  const later = await db.outbox.where('key').equals(failed.key).filter((e) => e.seq >= seq).toArray();
  await db.outbox.bulkDelete(later.map((e) => e.seq));
  if (failed.key.startsWith('collection:')) {
    const id = failed.key.slice('collection:'.length);
    const row = await db.collection.get(id);
    if (row) await db.collection.put({ ...row, _pending: 0, _deleted: 0 });
  }
}
