-- PROPOSED, NOT APPLIED. Offline sync support (see OFFLINE.md).
--
-- Lives in supabase/proposed/, not supabase/migrations/, so `supabase db
-- push` can't pick it up by accident. To apply: review, move it into
-- supabase/migrations/ with a fresh timestamp, push, then deploy as usual.
-- The client (src/lib/offline/remote.js) already works without it, with
-- weaker conflict handling; with it, it switches over automatically.
--
-- What it adds:
--   1. updated_at        set by the CLIENT when the user edits: decides
--                         last-write-wins between devices.
--      server_updated_at set by the SERVER on every write: the pull cursor.
--                         Two columns, so a phone with a wrong clock can
--                         neither win conflicts unfairly by a lot nor make
--                         other devices miss its rows when they pull.
--   2. (owner_id, server_updated_at) indexes for the incremental pull.
--   3. sync_upsert_user_collection / sync_update_profile: SECURITY INVOKER
--      upserts that apply last-write-wins and never touch locked columns.
--      INVOKER on purpose: RLS stays in force, so a user can only ever write
--      their own rows (CLAUDE.md: no DEFINER for client data paths).
--
-- Client UUIDs: user_collection.id already defaults to gen_random_uuid()
-- and accepts a client-supplied id under the existing insert policy, so no
-- change is needed; the offline layer always supplies one.
--
-- Deletes stay HARD (the existing delete_collection_entry RPC, replayed
-- idempotently by the client). A soft-delete alternative is sketched at the
-- end, commented out, with why it's not recommended.

-- ── 1. timestamps ───────────────────────────────────────────────────────────

alter table user_collection
  add column updated_at timestamptz not null default now(),
  add column server_updated_at timestamptz not null default now();

alter table profiles
  add column updated_at timestamptz not null default now(),
  add column server_updated_at timestamptz not null default now();

-- Existing rows: start both clocks at the row's creation time.
update user_collection set updated_at = created_at, server_updated_at = created_at;
update profiles set updated_at = created_at, server_updated_at = created_at;

create or replace function touch_server_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.server_updated_at := now();
  -- A writer that doesn't know about updated_at (every existing screen,
  -- RPC and trigger) still advances it, so its write wins as "latest".
  if tg_op = 'INSERT' then
    new.updated_at := coalesce(new.updated_at, now());
  elsif new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger user_collection_touch_server_updated_at
  before insert or update on user_collection
  for each row execute function touch_server_updated_at();

create trigger profiles_touch_server_updated_at
  before insert or update on profiles
  for each row execute function touch_server_updated_at();

-- ── 2. pull indexes ─────────────────────────────────────────────────────────

create index user_collection_owner_server_updated_idx on user_collection (owner_id, server_updated_at);

-- ── 3. last-write-wins upserts ─────────────────────────────────────────────

-- Inserts the row, or updates it only when the incoming updated_at is newer.
-- Writable columns match src/lib/offline/fields.js: never is_favourite
-- (toggle_favourite only) or can_rarity on update, never owner_id.
create or replace function sync_upsert_user_collection(p_row jsonb)
returns user_collection
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_in user_collection;
  v_out user_collection;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  v_in := jsonb_populate_record(null::user_collection, p_row);

  insert into user_collection (
    id, owner_id, can_id, status, notes, can_name, can_brand, can_image_url,
    can_rarity, can_flavour, can_edition, can_beverage_type, can_bg_color,
    user_rarity_vote, taste_rating, acquired_on, pinned_at, updated_at
  ) values (
    v_in.id, v_uid, v_in.can_id, coalesce(v_in.status, 'collected'), v_in.notes,
    v_in.can_name, v_in.can_brand, v_in.can_image_url, v_in.can_rarity,
    v_in.can_flavour, v_in.can_edition, coalesce(v_in.can_beverage_type, 'energy_drink'),
    coalesce(v_in.can_bg_color, '#0D2B2B'), v_in.user_rarity_vote, v_in.taste_rating,
    v_in.acquired_on, v_in.pinned_at, coalesce(v_in.updated_at, now())
  )
  on conflict (id) do update set
    can_id            = excluded.can_id,
    status            = excluded.status,
    notes             = excluded.notes,
    can_name          = excluded.can_name,
    can_brand         = excluded.can_brand,
    can_image_url     = excluded.can_image_url,
    can_flavour       = excluded.can_flavour,
    can_edition       = excluded.can_edition,
    can_beverage_type = excluded.can_beverage_type,
    can_bg_color      = excluded.can_bg_color,
    user_rarity_vote  = excluded.user_rarity_vote,
    taste_rating      = excluded.taste_rating,
    acquired_on       = excluded.acquired_on,
    pinned_at         = excluded.pinned_at,
    updated_at        = excluded.updated_at
  where user_collection.owner_id = v_uid
    and user_collection.updated_at < excluded.updated_at;

  -- Whether it inserted, updated or lost to a newer write, return what the
  -- server now holds, so the client converges on it.
  select * into v_out from user_collection where id = v_in.id and owner_id = v_uid;
  return v_out;
end;
$$;

grant execute on function sync_upsert_user_collection(jsonb) to authenticated;

-- The user-editable profile fields only (src/lib/offline/fields.js,
-- PROFILE_FIELDS). Role, streak, subscription_status, paddle_* and
-- pro_expires_at stay locked; theme stays on its own guarded path.
create or replace function sync_update_profile(p_row jsonb)
returns profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out profiles;
  v_updated timestamptz := coalesce((p_row->>'updated_at')::timestamptz, now());
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  update profiles set
    full_name           = case when p_row ? 'full_name' then p_row->>'full_name' else full_name end,
    region              = case when p_row ? 'region' then p_row->>'region' else region end,
    is_private          = case when p_row ? 'is_private' then (p_row->>'is_private')::boolean else is_private end,
    notify_follows_pref = case when p_row ? 'notify_follows_pref' then (p_row->>'notify_follows_pref')::follow_notify_pref else notify_follows_pref end,
    notify_rare_follows = case when p_row ? 'notify_rare_follows' then (p_row->>'notify_rare_follows')::boolean else notify_rare_follows end,
    updated_at          = v_updated
  where id = v_uid
    and updated_at < v_updated;

  select * into v_out from profiles where id = v_uid;
  return v_out;
end;
$$;

grant execute on function sync_update_profile(jsonb) to authenticated;

-- ── RLS review (no policy changes needed for these tables) ─────────────────
--
-- user_collection: select/insert/update/delete own (security.sql) cover the
--   upsert: INSERT ... ON CONFLICT DO UPDATE needs the insert, select and
--   update policies, all `owner_id = auth.uid()`. The lock trigger still
--   guards is_favourite / can_rarity; the upsert never sets them on update.
-- profiles: update own covers sync_update_profile; the lock trigger guards
--   the locked columns, which it never sets.
--
-- FLAGGED, NOT CHANGED: storage bucket `can-images`. Its policies were set
-- in the Dashboard and are not in this repo, so they can't be reviewed
-- here. Offline photos upload to `<user id>/<row id>.webp`. Please confirm
-- uploads are restricted to the caller's own folder, e.g.:
--
--   create policy can_images_insert_own on storage.objects
--     for insert to authenticated
--     with check (bucket_id = 'can-images' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- If a policy instead allows any authenticated user to write any path, a
-- user could overwrite another user's photo; this sync never does, but the
-- bucket should not rely on that.

-- ── Not recommended: soft deletes ──────────────────────────────────────────
--
-- Requested originally; kept here as a sketch. Hard deletes are kept
-- because a soft delete would (a) need `deleted_at is null` on ~15 direct
-- user_collection reads across the app, (b) need the leaderboard trigger
-- and delete_collection_entry's catalog cleanup rewritten, and (c) keep
-- deleted personal data around, which GDPR/POPIA retention would then
-- have to cover. The client catches deletions made on other devices by an
-- id reconciliation on each pull instead.
--
--   alter table user_collection add column deleted_at timestamptz;
--   create index user_collection_owner_live_idx on user_collection (owner_id) where deleted_at is null;
--   -- then: every read filters deleted_at is null; delete_collection_entry
--   -- sets deleted_at instead of deleting; a scheduled purge hard-deletes
--   -- rows older than the retention period.
