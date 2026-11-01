import { getMeta, setMeta } from './db';
import { MAX_ATTEMPTS, backoffMs, classifyError } from './errors';
import { outboxCounts } from './outbox';
import { ts } from './fields';

// The sync engine: push the outbox, then pull the server's changes into
// Dexie. It talks to Supabase only through `remote` (remote.js), so tests
// run it against an in-memory server. See OFFLINE.md.
//
// Push: outbox entries in `seq` order. Entries for the same record (`key`)
//   run strictly in order; a waiting or failed entry holds back the rest of
//   ITS record only. Every operation is idempotent, so a crash between "the
//   server did it" and "we noted it" just repeats it harmlessly.
// Pull: rows whose server_updated_at is past the stored cursor (a server
//   clock, so a phone's wrong clock can't make us miss rows), merged by
//   last-write-wins on updated_at; then a cheap id reconciliation catches
//   cans deleted on another device.
// Status: 'offline' | 'syncing' | 'synced' | 'error', plus pending/failed
//   counts, for the sync indicator.

const CURSOR_KEY = 'cursor:user_collection';
const LAST_SYNC_KEY = 'lastSyncedAt';
const PULL_PAGE = 500;

export function createSyncEngine({ db, remote, isOnline = () => true, now = Date.now, random = Math.random, locks = globalThis.navigator?.locks, lockName = 'sippd-sync' }) {
  const listeners = new Set();
  let status = { state: 'synced', pending: 0, failed: 0, lastSyncedAt: null, error: null };
  let running = null;

  const emit = (patch) => {
    status = { ...status, ...patch };
    for (const fn of listeners) fn(status);
  };

  async function refreshCounts(patch = {}) {
    const counts = await outboxCounts(db);
    emit({ ...counts, ...patch });
    return counts;
  }

  // ── push ───────────────────────────────────────────────────────────────
  const handlers = {
    async 'blob.upload'(e) {
      const blob = await db.blobs.get(e.payload.blobId);
      if (!blob) return; // its row was deleted before it synced
      const url = blob.uploadedUrl ?? (await remote.uploadImage(blob.path, blob.blob, blob.type));
      await db.transaction('rw', db.blobs, db.collection, async () => {
        await db.blobs.update(blob.id, { uploadedUrl: url });
        const row = await db.collection.get(e.payload.rowId);
        if (row) await db.collection.put({ ...row, can_image_url: url });
      });
    },

    async 'collection.add'(e) {
      let row = await db.collection.get(e.payload.id);
      if (!row || row._deleted) return;
      const { catalog } = e.payload;
      // Already resolved on an earlier attempt, or the user had voted on
      // this existing can before: no vote to cast.
      const known = e.payload.canId ?? (catalog.alreadyVoted ? catalog.canId : null);
      if (known) {
        if (row.can_id !== known) {
          row = { ...row, can_id: known };
          await db.collection.put(row);
        }
      } else {
        // Records the rarity vote and resolves (or creates) the catalog can.
        const can = await remote.voteOnCan({ ...catalog, imageUrl: row.can_image_url ?? catalog.imageUrl ?? null });
        // Remember it before anything else can fail, so a retry never
        // re-runs vote_on_can (it would count against the rate limits).
        await db.outbox.update(e.seq, { payload: { ...e.payload, canId: can.id } });
        await db.catalog.put(can);
        row = { ...row, can_id: can.id, can_rarity: can.consensus_rarity || row.user_rarity_vote || row.can_rarity };
        await db.collection.put(row);
      }
      await pushRow(row.id);
    },

    async 'collection.upsert'(e) {
      await pushRow(e.payload.id);
    },

    async 'collection.delete'(e) {
      await remote.deleteCollectionEntry(e.payload.id); // "entry not found" counts as done
      await db.collection.delete(e.payload.id);
    },

    async 'collection.favourite'(e) {
      const value = await remote.setFavourite(e.payload.id, e.payload.value);
      const row = await db.collection.get(e.payload.id);
      if (row && value !== undefined) await db.collection.put({ ...row, is_favourite: value });
    },

    async 'profile.update'() {
      const profile = (await db.profile.toArray())[0];
      if (!profile) return;
      const pushedAt = profile.updated_at;
      const server = await remote.updateProfile(profile);
      const latest = (await db.profile.toArray())[0];
      const changedMeanwhile = ts(latest?.updated_at) > ts(pushedAt);
      await db.profile.put({ ...latest, ...(changedMeanwhile ? {} : server), _pending: changedMeanwhile ? 1 : 0 });
    },
  };

  // Sends a collection row's latest local state; keeps it pending if the
  // user edited it again while the request was in flight.
  async function pushRow(id) {
    const row = await db.collection.get(id);
    if (!row || row._deleted) return;
    if (row._blobId) {
      const blob = await db.blobs.get(row._blobId);
      if (blob && !blob.uploadedUrl) throw Object.assign(new Error('photo not uploaded yet'), { status: 503 });
    }
    const server = await remote.upsertCollection(row);
    await db.transaction('rw', db.collection, db.blobs, async () => {
      const latest = await db.collection.get(id);
      if (!latest || latest._deleted) return;
      const changedMeanwhile = ts(latest.updated_at) > ts(row.updated_at);
      if (changedMeanwhile) return;
      if (latest._blobId) await db.blobs.delete(latest._blobId);
      await db.collection.put({ ...latest, ...server, _pending: 0, _deleted: 0, _blobId: null });
    });
  }

  async function push() {
    const entries = await db.outbox.orderBy('seq').toArray();
    const held = new Set(); // keys with an earlier entry still outstanding
    for (const e of entries) {
      if (held.has(e.key)) continue;
      if (e.status === 'failed' || e.nextAttemptAt > now()) {
        held.add(e.key);
        continue;
      }
      if (!isOnline()) return;
      try {
        await handlers[e.kind](e);
        await db.outbox.delete(e.seq);
      } catch (error) {
        held.add(e.key);
        const { kind, message } = classifyError(error);
        const attempts = e.attempts + 1;
        if (kind === 'retry' && attempts < MAX_ATTEMPTS) {
          await db.outbox.update(e.seq, { attempts, nextAttemptAt: now() + backoffMs(attempts, random), lastError: message });
        } else {
          await db.outbox.update(e.seq, { attempts, status: 'failed', lastError: message });
        }
        if (kind === 'retry' && !isOnline()) return;
      }
    }
  }

  // ── pull ───────────────────────────────────────────────────────────────
  async function mergeCollectionRow(remoteRow) {
    const local = await db.collection.get(remoteRow.id);
    if (local?._deleted) return; // our delete is queued; it wins
    if (local?._pending && ts(local.updated_at) >= ts(remoteRow.updated_at)) return; // our newer edit will push
    await db.collection.put({ ...remoteRow, _pending: 0, _deleted: 0, _blobId: local?._blobId ?? null });
  }

  async function pull() {
    let cursor = await getMeta(db, CURSOR_KEY, null);
    for (;;) {
      const { rows, mode } = await remote.pullCollection({ since: cursor, limit: PULL_PAGE });
      for (const row of rows) await mergeCollectionRow(row);
      if (mode !== 'incremental' || rows.length === 0) break;
      const last = rows[rows.length - 1].server_updated_at;
      if (last && ts(last) > ts(cursor)) {
        cursor = last;
        await setMeta(db, CURSOR_KEY, cursor);
      }
      if (rows.length < PULL_PAGE) break;
    }

    // Deletions made elsewhere: rows we hold that the server no longer has,
    // except local adds that haven't reached it yet.
    const serverIds = new Set(await remote.listCollectionIds());
    const stale = await db.collection.filter((r) => !serverIds.has(r.id) && !r._pending && !r._deleted).primaryKeys();
    if (stale.length) await db.collection.bulkDelete(stale);

    const profile = await remote.pullProfile();
    if (profile) {
      const local = await db.profile.get(profile.id);
      if (!(local?._pending && ts(local.updated_at) >= ts(profile.updated_at))) await db.profile.put({ ...profile, _pending: 0 });
    }

    // Catalog reference data for every can the user holds.
    const canIds = [...new Set((await db.collection.toArray()).map((r) => r.can_id).filter(Boolean))];
    if (canIds.length) {
      const cans = await remote.fetchCatalog(canIds);
      if (cans.length) await db.catalog.bulkPut(cans);
    }
  }

  // ── orchestration ──────────────────────────────────────────────────────
  async function runOnce() {
    if (!isOnline()) {
      await refreshCounts({ state: 'offline' });
      return status;
    }
    emit({ state: 'syncing', error: null });
    try {
      await push();
      await pull();
      const counts = await outboxCounts(db);
      const lastSyncedAt = new Date(now()).toISOString();
      await setMeta(db, LAST_SYNC_KEY, lastSyncedAt);
      emit({ ...counts, lastSyncedAt, state: counts.failed ? 'error' : isOnline() ? 'synced' : 'offline' });
    } catch (error) {
      const { kind, message } = classifyError(error);
      await refreshCounts({ state: kind === 'retry' && !isOnline() ? 'offline' : 'error', error: message });
    }
    return status;
  }

  // One run at a time: in this tab (the shared promise) and across tabs
  // (Web Locks, where available: a second tab skips rather than queues).
  function sync() {
    if (running) return running;
    const run = locks?.request
      ? locks.request(lockName, { ifAvailable: true }, (lock) => (lock ? runOnce() : refreshCounts()))
      : runOnce();
    running = Promise.resolve(run).finally(() => { running = null; });
    return running;
  }

  return {
    sync,
    push,
    pull,
    getStatus: () => status,
    refreshCounts,
    subscribe(fn) {
      listeners.add(fn);
      fn(status);
      return () => listeners.delete(fn);
    },
  };
}
