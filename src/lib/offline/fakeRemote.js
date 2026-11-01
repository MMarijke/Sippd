import { COLLECTION_INSERT_FIELDS, COLLECTION_UPDATE_FIELDS, PROFILE_FIELDS, pick, ts } from './fields';

// An in-memory stand-in for remote.js, for the sync engine's tests. It
// keeps the SERVER-SIDE contract the proposed migration adds:
// last-write-wins by updated_at, server_updated_at from a server clock,
// locked columns ignored on update, idempotent uploads and deletes, and
// vote_on_can's catalog dedupe with one vote per user per can.
export function createFakeRemote({ userId }) {
  let clock = Date.parse('2026-11-01T00:00:00Z');
  const tick = () => new Date((clock += 1000)).toISOString();

  const state = {
    online: true,
    rows: new Map(),
    catalog: new Map(),
    votes: new Map(), // canId -> Set(userId)
    uploads: new Map(),
    profile: { id: userId, full_name: 'Collector', region: null, is_private: false, updated_at: '2026-01-01T00:00:00Z', server_updated_at: '2026-01-01T00:00:00Z' },
    calls: [],
    failures: [], // { method, error, times }
  };

  const guard = (method) => {
    state.calls.push(method);
    if (!state.online) throw new TypeError('Failed to fetch');
    const f = state.failures.find((x) => x.method === method && x.times > 0);
    if (f) {
      f.times -= 1;
      throw f.error;
    }
  };

  const api = {
    async uploadImage(path) {
      guard('uploadImage');
      state.uploads.set(path, (state.uploads.get(path) ?? 0) + 1);
      return `https://example.supabase.co/storage/v1/object/public/can-images/${path}`;
    },
    async voteOnCan(c) {
      guard('voteOnCan');
      let can = c.canId ? state.catalog.get(c.canId) : [...state.catalog.values()].find(
        (x) => (c.barcode && x.barcode === c.barcode) || (x.name.toLowerCase() === c.name.toLowerCase() && x.brand.toLowerCase() === c.brand.toLowerCase()),
      );
      if (!can) {
        can = { id: crypto.randomUUID(), name: c.name, brand: c.brand, barcode: c.barcode ?? null, image_url: c.imageUrl ?? null, consensus_rarity: c.rarity };
        state.catalog.set(can.id, can);
      }
      const voters = state.votes.get(can.id) ?? new Set();
      voters.add(userId);
      state.votes.set(can.id, voters);
      state.lastVote = c;
      return can;
    },
    async upsertCollection(row) {
      guard('upsertCollection');
      const existing = state.rows.get(row.id);
      if (existing && ts(existing.updated_at) > ts(row.updated_at)) return existing; // last write wins
      const fields = existing ? pick(row, COLLECTION_UPDATE_FIELDS) : pick({ ...row, owner_id: userId }, COLLECTION_INSERT_FIELDS);
      const next = { is_favourite: false, ...existing, ...fields, server_updated_at: tick() };
      state.rows.set(row.id, next);
      return next;
    },
    async deleteCollectionEntry(id) {
      guard('deleteCollectionEntry');
      state.rows.delete(id); // already gone is fine
    },
    async setFavourite(id, value) {
      guard('setFavourite');
      const row = state.rows.get(id);
      if (!row) return undefined;
      state.rows.set(id, { ...row, is_favourite: value, server_updated_at: tick() });
      return value;
    },
    async updateProfile(profile) {
      guard('updateProfile');
      if (ts(state.profile.updated_at) > ts(profile.updated_at)) return state.profile;
      state.profile = { ...state.profile, ...pick(profile, PROFILE_FIELDS), server_updated_at: tick() };
      return state.profile;
    },
    async pullCollection({ since, limit }) {
      guard('pullCollection');
      const rows = [...state.rows.values()]
        .filter((r) => ts(r.server_updated_at) > ts(since))
        .sort((a, b) => ts(a.server_updated_at) - ts(b.server_updated_at))
        .slice(0, limit);
      return { rows, mode: 'incremental' };
    },
    async listCollectionIds() {
      guard('listCollectionIds');
      return [...state.rows.keys()];
    },
    async pullProfile() {
      guard('pullProfile');
      return state.profile;
    },
    async fetchCatalog(ids) {
      guard('fetchCatalog');
      return ids.map((id) => state.catalog.get(id)).filter(Boolean);
    },
  };

  return {
    remote: api,
    state,
    tick,
    // Simulates another device (or the web app) writing directly.
    serverWrite(row) {
      state.rows.set(row.id, { ...state.rows.get(row.id), ...row, server_updated_at: tick() });
    },
    failNext(method, error, times = 1) {
      state.failures.push({ method, error, times });
    },
  };
}
