// Which columns the offline layer may write, per table. Everything else is
// either server-owned or LOCKED by a BEFORE UPDATE trigger (CLAUDE.md:
// column-level protection), and sending a locked column, even unchanged in
// intent, fails the whole write. Keep in step with
// supabase/proposed/20261101000000_offline_sync.sql.

// user_collection columns a client may set on INSERT.
export const COLLECTION_INSERT_FIELDS = [
  'id', 'owner_id', 'can_id', 'status', 'notes',
  'can_name', 'can_brand', 'can_image_url', 'can_rarity', 'can_flavour', 'can_edition',
  'can_beverage_type', 'can_bg_color', 'user_rarity_vote', 'taste_rating', 'acquired_on',
  'pinned_at', 'updated_at',
];

// ...and on UPDATE: never is_favourite (toggle_favourite() only) or
// can_rarity (set once at add time), never the owner.
const UPDATE_EXCLUDED = new Set(['id', 'owner_id', 'can_rarity']);
export const COLLECTION_UPDATE_FIELDS = COLLECTION_INSERT_FIELDS.filter((f) => !UPDATE_EXCLUDED.has(f));

// profiles columns a user edits themselves (Profile and Settings). Role,
// streak, subscription_status, paddle_* and pro_expires_at are locked;
// theme is Pro-guarded server-side and already cached by useTheme, so it
// stays online-only.
export const PROFILE_FIELDS = ['full_name', 'region', 'is_private', 'notify_follows_pref', 'notify_rare_follows', 'updated_at'];

export function pick(row, fields) {
  const out = {};
  for (const f of fields) if (row[f] !== undefined) out[f] = row[f];
  return out;
}

export const isLocalField = (key) => key.startsWith('_');

export function stripLocal(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) if (!isLocalField(k)) out[k] = v;
  return out;
}

// Timestamps compare as instants: the server returns +00:00 offsets, the
// client writes Z, so string comparison would lie.
export const ts = (value) => (value ? Date.parse(value) : 0);
