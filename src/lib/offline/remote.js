import { COLLECTION_INSERT_FIELDS, COLLECTION_UPDATE_FIELDS, PROFILE_FIELDS, pick } from './fields';

// The sync engine's only door to Supabase (anon key + the user's session,
// so RLS applies to every call; there is no service-role key in the client).
//
// It works before AND after supabase/proposed/20261101000000_offline_sync.sql
// is applied:
//   - pull: incremental by server_updated_at when the column exists, else a
//     full pull of the user's rows (mode 'full');
//   - push: the last-write-wins RPCs (sync_upsert_user_collection,
//     sync_update_profile) when they exist, else a plain insert/update that
//     never sends a locked column. Without the RPCs a stale offline edit can
//     overwrite a newer one: see OFFLINE.md, "Before the migration".

const BUCKET = 'can-images';
const UNDEFINED_COLUMN = '42703';
const UNKNOWN_FUNCTION = 'PGRST202';
const UNKNOWN_COLUMN_IN_PAYLOAD = 'PGRST204';
const UNIQUE_VIOLATION = '23505';

const fail = (error) => { throw Object.assign(new Error(error.message || String(error)), error); };

const withoutSyncColumns = (row) => {
  const { updated_at: _u, server_updated_at: _s, ...rest } = row;
  return rest;
};

export function createSupabaseRemote(supabase, userId) {
  let hasSyncSchema = null; // learned from the first response

  return {
    async uploadImage(path, blob, contentType) {
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: false, contentType });
      // Idempotent: a retry after a lost response finds its own file there.
      if (error && !/already exists|duplicate/i.test(error.message ?? '') && String(error.statusCode) !== '409') fail(error);
      return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },

    async voteOnCan(c) {
      const { data, error } = await supabase.rpc('vote_on_can', {
        p_caller_id: userId,
        p_can_id: c.canId ?? null,
        p_rarity: c.rarity,
        p_name: c.name || null,
        p_brand: c.brand || null,
        p_flavour: c.flavour || null,
        p_edition: c.edition || null,
        p_image_url: c.imageUrl || null,
        p_barcode: c.barcode || null,
        p_beverage_type: c.beverageType,
      });
      if (error) fail(error);
      return data;
    },

    async upsertCollection(row) {
      if (hasSyncSchema !== false) {
        const { data, error } = await supabase.rpc('sync_upsert_user_collection', { p_row: pick({ ...row, owner_id: userId }, COLLECTION_INSERT_FIELDS) });
        if (!error) { hasSyncSchema = true; return data; }
        if (error.code !== UNKNOWN_FUNCTION) fail(error);
        hasSyncSchema = false;
      }
      // Before the migration: insert, or on conflict update the client-
      // writable columns (never can_rarity / is_favourite / owner_id).
      const insert = withoutSyncColumns(pick({ ...row, owner_id: userId }, COLLECTION_INSERT_FIELDS));
      const inserted = await supabase.from('user_collection').insert(insert).select().single();
      if (!inserted.error) return inserted.data;
      if (inserted.error.code !== UNIQUE_VIOLATION) fail(inserted.error);
      const update = withoutSyncColumns(pick(row, COLLECTION_UPDATE_FIELDS));
      const updated = await supabase.from('user_collection').update(update).eq('id', row.id).eq('owner_id', userId).select().single();
      if (updated.error) fail(updated.error);
      return updated.data;
    },

    async deleteCollectionEntry(id) {
      const { error } = await supabase.rpc('delete_collection_entry', { p_caller_id: userId, p_entry_id: id });
      // Idempotent: already gone (an earlier attempt, or another device).
      if (error && !/entry not found/i.test(error.message ?? '')) fail(error);
    },

    // toggle_favourite() flips; we want a SET. Read, then toggle only if the
    // server disagrees. Returns the server's value, or undefined if gone.
    async setFavourite(id, value) {
      const { data, error } = await supabase.from('user_collection').select('is_favourite').eq('id', id).maybeSingle();
      if (error) fail(error);
      if (!data) return undefined;
      if (data.is_favourite === value) return value;
      const toggled = await supabase.rpc('toggle_favourite', { p_caller_id: userId, p_collection_id: id });
      if (toggled.error) fail(toggled.error);
      return toggled.data?.is_favourite ?? value;
    },

    async updateProfile(profile) {
      const fields = pick(profile, PROFILE_FIELDS);
      if (hasSyncSchema !== false) {
        const { data, error } = await supabase.rpc('sync_update_profile', { p_row: fields });
        if (!error) return data;
        if (error.code !== UNKNOWN_FUNCTION) fail(error);
      }
      const { data, error } = await supabase.from('profiles').update(withoutSyncColumns(fields)).eq('id', userId).select().single();
      if (error) fail(error);
      return data;
    },

    async pullCollection({ since, limit }) {
      if (hasSyncSchema !== false) {
        const { data, error } = await supabase
          .from('user_collection')
          .select('*')
          .eq('owner_id', userId)
          .gt('server_updated_at', since ?? '1970-01-01T00:00:00Z')
          .order('server_updated_at', { ascending: true })
          .limit(limit);
        if (!error) { hasSyncSchema = true; return { rows: data, mode: 'incremental' }; }
        if (error.code !== UNDEFINED_COLUMN && error.code !== UNKNOWN_COLUMN_IN_PAYLOAD) fail(error);
        hasSyncSchema = false;
      }
      const { data, error } = await supabase.from('user_collection').select('*').eq('owner_id', userId);
      if (error) fail(error);
      return { rows: data, mode: 'full' };
    },

    async listCollectionIds() {
      const { data, error } = await supabase.from('user_collection').select('id').eq('owner_id', userId);
      if (error) fail(error);
      return data.map((r) => r.id);
    },

    async pullProfile() {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) fail(error);
      return data;
    },

    async fetchCatalog(ids) {
      const out = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from('shared_cans').select('*').in('id', ids.slice(i, i + 100));
        if (error) fail(error);
        out.push(...data);
      }
      return out;
    },
  };
}
