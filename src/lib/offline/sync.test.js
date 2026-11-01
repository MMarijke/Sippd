import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteUserDb, openUserDb } from './db';
import { createFakeRemote } from './fakeRemote';
import { addCan, deleteCollection, discardFailed, outboxCounts, retryFailed, setFavourite, updateCollection, updateProfile } from './outbox';
import { createSyncEngine } from './sync';
import { startAutoSync } from './autoSync';
import { MAX_ATTEMPTS } from './errors';

const netError = () => new TypeError('Failed to fetch');
const photo = () => new Blob(['jpegbytes'], { type: 'image/webp' });

const catalogFor = (name, extra = {}) => ({ rarity: 'Rare', name, brand: 'Monster', flavour: null, edition: null, barcode: null, beverageType: 'energy_drink', ...extra });
const rowFor = (name, extra = {}) => ({ status: 'collected', can_name: name, can_brand: 'Monster', user_rarity_vote: 'Rare', can_bg_color: '#0D2B2B', ...extra });

let userId;
let db;
let fake;
let clock;
let online;

function engine(extra = {}) {
  return createSyncEngine({ db, remote: fake.remote, isOnline: () => online, now: () => clock, random: () => 0.5, locks: null, ...extra });
}

beforeEach(() => {
  userId = `user-${crypto.randomUUID()}`;
  db = openUserDb(userId);
  fake = createFakeRemote({ userId });
  clock = Date.parse('2026-11-01T10:00:00Z');
  online = true;
});

afterEach(async () => {
  db.close();
  await deleteUserDb(userId);
});

const tickClock = (ms = 1000) => { clock += ms; };
const write = async (fn) => { tickClock(); await fn(() => clock); };

describe('outbox replay', () => {
  it('replays offline adds, edits and favourites in order, sending the latest state once', async () => {
    online = false;
    let id;
    await write(async (now) => { ({ id } = await addCan(db, { userId, row: rowFor('Ultra Gold'), catalog: catalogFor('Ultra Gold'), now })); });
    await write((now) => updateCollection(db, { userId, id, patch: { notes: 'first' }, now }));
    await write((now) => updateCollection(db, { userId, id, patch: { notes: 'second' }, now }));
    await write((now) => setFavourite(db, { id, value: true, now }));

    const sync = engine();
    expect((await sync.sync()).state).toBe('offline');
    expect(fake.state.calls).toEqual([]); // nothing leaves the device offline
    expect(await outboxCounts(db)).toEqual({ pending: 2, failed: 0 }); // add (edits coalesced) + favourite

    online = true;
    const status = await sync.sync();
    expect(status.state).toBe('synced');
    expect(fake.state.calls.slice(0, 3)).toEqual(['voteOnCan', 'upsertCollection', 'setFavourite']);
    const server = fake.state.rows.get(id);
    expect(server.notes).toBe('second');
    expect(server.is_favourite).toBe(true);
    expect(await outboxCounts(db)).toEqual({ pending: 0, failed: 0 });
    expect((await db.collection.get(id))._pending).toBe(0);
  });
});

describe('idempotency', () => {
  it('never re-runs vote_on_can when only the row insert failed', async () => {
    let id;
    await write(async (now) => { ({ id } = await addCan(db, { userId, row: rowFor('Mango Loco'), catalog: catalogFor('Mango Loco'), now })); });
    fake.failNext('upsertCollection', netError());
    await engine().sync();
    expect(fake.state.rows.has(id)).toBe(false);

    tickClock(60_000); // past the backoff
    await engine().sync();
    expect(fake.state.calls.filter((c) => c === 'voteOnCan')).toHaveLength(1);
    expect(fake.state.rows.has(id)).toBe(true);
  });

  it('does not upload a photo twice when the add after it failed', async () => {
    await write((now) => addCan(db, { userId, row: rowFor('Pipeline Punch'), catalog: catalogFor('Pipeline Punch'), photo: photo(), now }));
    fake.failNext('voteOnCan', netError());
    await engine().sync();
    tickClock(60_000);
    await engine().sync();
    expect(fake.state.calls.filter((c) => c === 'uploadImage')).toHaveLength(1);
    expect(await outboxCounts(db)).toEqual({ pending: 0, failed: 0 });
  });

  it('treats a delete of an already-deleted row as done', async () => {
    let id;
    await write(async (now) => { ({ id } = await addCan(db, { userId, row: rowFor('Khaotic'), catalog: catalogFor('Khaotic'), now })); });
    await engine().sync();
    await write((now) => deleteCollection(db, { id, now }));
    fake.state.rows.delete(id); // another device got there first
    await engine().sync();
    expect(await db.collection.get(id)).toBeUndefined();
    expect(await outboxCounts(db)).toEqual({ pending: 0, failed: 0 });
  });

  it('replaying a favourite sets the target value instead of toggling it back', async () => {
    let id;
    await write(async (now) => { ({ id } = await addCan(db, { userId, row: rowFor('Rehab'), catalog: catalogFor('Rehab'), now })); });
    await engine().sync();
    await write((now) => setFavourite(db, { id, value: true, now }));
    await write((now) => setFavourite(db, { id, value: true, now }));
    await engine().sync();
    expect(fake.state.rows.get(id).is_favourite).toBe(true);
  });
});

describe('conflict resolution (last write wins by updated_at)', () => {
  it("keeps a newer local edit through a pull, then pushes it over the server's older value", async () => {
    let id;
    await write(async (now) => { ({ id } = await addCan(db, { userId, row: rowFor('Juice'), catalog: catalogFor('Juice'), now })); });
    await engine().sync();
    fake.serverWrite({ id, notes: 'from the web', updated_at: new Date(clock + 1000).toISOString() });
    online = false;
    tickClock(5000);
    await write((now) => updateCollection(db, { userId, id, patch: { notes: 'from the phone' }, now }));

    online = true;
    await engine().pull();
    expect((await db.collection.get(id)).notes).toBe('from the phone'); // pull didn't clobber the newer edit
    await engine().sync();
    expect(fake.state.rows.get(id).notes).toBe('from the phone');
  });

  it('lets a newer server edit beat an older offline edit', async () => {
    let id;
    await write(async (now) => { ({ id } = await addCan(db, { userId, row: rowFor('Assault'), catalog: catalogFor('Assault'), now })); });
    await engine().sync();
    online = false;
    await write((now) => updateCollection(db, { userId, id, patch: { notes: 'stale phone edit' }, now }));
    fake.serverWrite({ id, notes: 'newer web edit', updated_at: new Date(clock + 60_000).toISOString() });

    online = true;
    await engine().sync();
    expect(fake.state.rows.get(id).notes).toBe('newer web edit');
    expect((await db.collection.get(id)).notes).toBe('newer web edit');
  });
});

describe('pull cursor', () => {
  it('pages through everything once, then fetches only what changed', async () => {
    for (let i = 0; i < 1200; i += 1) fake.serverWrite({ id: crypto.randomUUID(), owner_id: userId, can_name: `Can ${i}`, updated_at: '2026-10-01T00:00:00Z' });
    const sync = engine();
    await sync.pull();
    expect(await db.collection.count()).toBe(1200);
    expect(fake.state.calls.filter((c) => c === 'pullCollection')).toHaveLength(3); // 500 + 500 + 200

    const cursor = (await db.meta.get('cursor:user_collection')).value;
    const changed = [...fake.state.rows.keys()][7];
    fake.serverWrite({ id: changed, notes: 'edited later' });
    fake.state.calls.length = 0;
    await sync.pull();
    expect(fake.state.calls.filter((c) => c === 'pullCollection')).toHaveLength(1);
    expect((await db.collection.get(changed)).notes).toBe('edited later');
    expect((await db.meta.get('cursor:user_collection')).value > cursor).toBe(true);
  });

  it('removes cans deleted on another device, but keeps local adds that have not synced', async () => {
    const elsewhere = crypto.randomUUID();
    fake.serverWrite({ id: elsewhere, owner_id: userId, can_name: 'Gone soon', updated_at: '2026-10-01T00:00:00Z' });
    await engine().pull();
    online = false;
    let local;
    await write(async (now) => { ({ id: local } = await addCan(db, { userId, row: rowFor('Not yet synced'), catalog: catalogFor('Not yet synced'), now })); });
    fake.state.rows.delete(elsewhere);

    online = true;
    await engine().pull();
    expect(await db.collection.get(elsewhere)).toBeUndefined();
    expect(await db.collection.get(local)).toBeDefined();
  });
});

describe('photo before row', () => {
  it('uploads the photo, then adds the can with the uploaded URL', async () => {
    let id;
    await write(async (now) => { ({ id } = await addCan(db, { userId, row: rowFor('Ultra Fiesta'), catalog: catalogFor('Ultra Fiesta'), photo: photo(), now })); });
    expect(await outboxCounts(db)).toEqual({ pending: 1, failed: 0 }); // one can, not can + photo
    await engine().sync();
    expect(fake.state.calls.slice(0, 3)).toEqual(['uploadImage', 'voteOnCan', 'upsertCollection']);
    const url = `https://example.supabase.co/storage/v1/object/public/can-images/${userId}/${id}.webp`;
    expect(fake.state.lastVote.imageUrl).toBe(url);
    expect(fake.state.rows.get(id).can_image_url).toBe(url);
    const local = await db.collection.get(id);
    expect(local.can_image_url).toBe(url);
    expect(local._blobId).toBeNull();
    expect(await db.blobs.count()).toBe(0); // the local copy is released once synced
  });

  it('holds the row back while its photo upload is failing', async () => {
    let id;
    await write(async (now) => { ({ id } = await addCan(db, { userId, row: rowFor('Ultra Paradise'), catalog: catalogFor('Ultra Paradise'), photo: photo(), now })); });
    fake.failNext('uploadImage', netError());
    await engine().sync();
    expect(fake.state.calls).not.toContain('voteOnCan');
    expect(fake.state.rows.has(id)).toBe(false);
  });

  it('a photo added while editing uploads before the edit is pushed', async () => {
    let id;
    await write(async (now) => { ({ id } = await addCan(db, { userId, row: rowFor('Lewis Hamilton'), catalog: catalogFor('Lewis Hamilton'), now })); });
    await engine().sync();
    fake.state.calls.length = 0;
    await write((now) => updateCollection(db, { userId, id, patch: { notes: 'new pic' }, photo: photo(), now }));
    await engine().sync();
    expect(fake.state.calls.indexOf('uploadImage')).toBeLessThan(fake.state.calls.indexOf('upsertCollection'));
    expect(fake.state.rows.get(id).can_image_url).toMatch(/can-images\//);
  });
});

describe('offline to online', () => {
  it('queues while offline and syncs on the online event', async () => {
    const target = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    online = false;
    const sync = engine();
    const auto = startAutoSync(sync, { target, doc, isOnline: () => online, setInterval: () => 0, clearInterval: () => {} });
    await sync.sync();
    await write((now) => updateProfile(db, { userId, patch: { full_name: 'Offline Name' }, now }));
    auto.requestSync();
    expect(fake.state.calls).toEqual([]);

    online = true;
    target.dispatchEvent(new Event('online'));
    await sync.sync(); // the run the event started
    expect(fake.state.profile.full_name).toBe('Offline Name');
    expect(sync.getStatus().state).toBe('synced');
    auto.stop();
  });

  it('runs a single sync even when triggers overlap', async () => {
    const sync = engine();
    await Promise.all([sync.sync(), sync.sync(), sync.sync()]);
    expect(fake.state.calls.filter((c) => c === 'pullCollection')).toHaveLength(1);
  });
});

describe('failures', () => {
  it(`marks an entry failed after ${MAX_ATTEMPTS} network attempts, and Retry resets it`, async () => {
    await write((now) => addCan(db, { userId, row: rowFor('Nitro'), catalog: catalogFor('Nitro'), now }));
    fake.failNext('voteOnCan', netError(), MAX_ATTEMPTS);
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await engine().sync();
      tickClock(10 * 60_000);
    }
    expect(await outboxCounts(db)).toEqual({ pending: 0, failed: 1 });
    expect(engine().getStatus().state).toBe('synced'); // fresh engine; the run below reports
    expect((await engine().sync()).state).toBe('error');

    await retryFailed(db);
    await engine().sync();
    expect(await outboxCounts(db)).toEqual({ pending: 0, failed: 0 });
  });

  it('fails the free daily scan cap straight away, with a message, holding back only that can', async () => {
    let capped;
    await write(async (now) => { ({ id: capped } = await addCan(db, { userId, row: rowFor('Scanned'), catalog: catalogFor('Scanned', { barcode: '123' }), now })); });
    await write((now) => addCan(db, { userId, row: rowFor('Typed in'), catalog: catalogFor('Typed in'), now }));
    fake.failNext('voteOnCan', new Error('daily_scan_limit_reached'));
    await engine().sync();

    const failed = await db.outbox.where('status').equals('failed').toArray();
    expect(failed).toHaveLength(1);
    expect(failed[0].attempts).toBe(1);
    expect(failed[0].lastError).toMatch(/10 barcodes/);
    expect(fake.state.rows.has(capped)).toBe(false);
    expect([...fake.state.rows.values()].map((r) => r.can_name)).toEqual(['Typed in']);

    await discardFailed(db, failed[0].seq);
    await engine().sync();
    expect(await db.collection.get(capped)).toBeUndefined(); // never reached the server: gone after reconciliation
  });

  it('deleting a can that never synced removes it without touching the server', async () => {
    online = false;
    let id;
    await write(async (now) => { ({ id } = await addCan(db, { userId, row: rowFor('Oops'), catalog: catalogFor('Oops'), photo: photo(), now })); });
    await write((now) => deleteCollection(db, { id, now }));
    expect(await db.collection.get(id)).toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
    online = true;
    await engine().sync();
    expect(fake.state.calls).not.toContain('deleteCollectionEntry');
  });
});
