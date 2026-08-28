-- Sippd security layer: trusted role, column-lockdown triggers, RPCs, the
-- public-profile view, and RLS policies for every table in 20260815120000.
--
-- Reviewed and approved 2026-08-15:
--   - activity_items RLS deliberately enforces real privacy at the database
--     layer (stricter than the original app, which only hid private
--     posts client-side while shipping the data to every browser anyway).
--   - react_to_activity() + the reactions lockdown trigger are included
--     (same race-condition class as vote_on_can()/toggle_favourite()).
--
-- Still not applied to any database — awaiting the project to exist.

-- ── Trusted role for SECURITY DEFINER RPCs ──────────────────────────────────
-- bypassrls is what actually lets this role's writes get past RLS and the
-- column-lockdown triggers below — without it, a SECURITY DEFINER function
-- owned by this role would still be blocked by RLS like any other non-owner
-- role, and every RPC below would fail with a row-level security violation.
create role sippd_rpc noinherit nologin bypassrls;
grant sippd_rpc to postgres;
-- Postgres 15 dropped the old default CREATE-on-public-for-everyone grant, so a
-- freshly created role has zero standing in the public schema. ALTER ... OWNER TO
-- requires the *new* owner to hold CREATE on the containing schema, not just the
-- current role to be a member of the new owner — without this, every "alter
-- function ... owner to sippd_rpc" below fails with "permission denied for
-- schema public" (confirmed against the linked project on 2026-08-18).
grant usage, create on schema public to sippd_rpc;

-- ── compute_* helpers (ports src/lib/rarityConsensus.js math into SQL) ─────

create or replace function compute_confidence(p_total_votes integer)
returns can_confidence
language sql
immutable
as $$
  select case
    when p_total_votes is null or p_total_votes < 5 then 'unrated'::can_confidence
    when p_total_votes < 15 then 'low'::can_confidence
    else 'confirmed'::can_confidence
  end;
$$;

create or replace function compute_consensus_rarity(
  p_common integer, p_uncommon integer, p_rare integer, p_ultra_rare integer, p_legendary integer
) returns rarity_tier
language plpgsql
immutable
as $$
declare
  v_total integer := coalesce(p_common, 0) + coalesce(p_uncommon, 0) + coalesce(p_rare, 0)
                      + coalesce(p_ultra_rare, 0) + coalesce(p_legendary, 0);
  v_mean numeric;
  v_rank integer;
  v_order rarity_tier[] := array['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary']::rarity_tier[];
begin
  if v_total = 0 then
    return 'Common';
  end if;

  v_mean := (
    1 * coalesce(p_common, 0) + 2 * coalesce(p_uncommon, 0) + 3 * coalesce(p_rare, 0)
    + 4 * coalesce(p_ultra_rare, 0) + 5 * coalesce(p_legendary, 0)
  )::numeric / v_total;

  v_rank := least(5, greatest(1, round(v_mean)::int));
  return v_order[v_rank];
end;
$$;

-- ── Column-lockdown triggers ─────────────────────────────────────────────────
-- SECURITY INVOKER (the default — stated explicitly) is required here: these
-- functions read current_user to identify the caller, and a SECURITY DEFINER
-- trigger function would reset current_user to the function owner the moment
-- it starts executing, permanently breaking the check for every caller
-- including sippd_rpc itself.

create or replace function profiles_lock_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if auth.role() is distinct from 'service_role' and current_user is distinct from 'sippd_rpc' then
    if new.role is distinct from old.role then
      raise exception 'role is not client-writable';
    end if;
    if new.current_streak is distinct from old.current_streak then
      raise exception 'current_streak is not client-writable — use tick_streak()';
    end if;
    if new.last_active_date is distinct from old.last_active_date then
      raise exception 'last_active_date is not client-writable — use tick_streak()';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_lock_columns_trigger
  before update on profiles
  for each row execute function profiles_lock_columns();

create or replace function shared_cans_lock_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if auth.role() is distinct from 'service_role' and current_user is distinct from 'sippd_rpc' then
    if new.common_votes is distinct from old.common_votes
      or new.uncommon_votes is distinct from old.uncommon_votes
      or new.rare_votes is distinct from old.rare_votes
      or new.ultra_rare_votes is distinct from old.ultra_rare_votes
      or new.legendary_votes is distinct from old.legendary_votes
      or new.total_votes is distinct from old.total_votes
      or new.consensus_rarity is distinct from old.consensus_rarity
      or new.confidence is distinct from old.confidence
      or new.community_favourites is distinct from old.community_favourites
    then
      raise exception 'vote and favourite aggregate columns are not client-writable — use vote_on_can() / toggle_favourite()';
    end if;
  end if;
  return new;
end;
$$;

create trigger shared_cans_lock_columns_trigger
  before update on shared_cans
  for each row execute function shared_cans_lock_columns();

create or replace function user_collection_lock_favourite()
returns trigger
language plpgsql
security invoker
as $$
begin
  if auth.role() is distinct from 'service_role' and current_user is distinct from 'sippd_rpc' then
    if new.is_favourite is distinct from old.is_favourite then
      raise exception 'is_favourite is not client-writable — use toggle_favourite()';
    end if;
  end if;
  return new;
end;
$$;

create trigger user_collection_lock_favourite_trigger
  before update on user_collection
  for each row execute function user_collection_lock_favourite();

create or replace function notifications_lock_status_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if auth.role() is distinct from 'service_role' and current_user is distinct from 'sippd_rpc' then
    if new.trade_status is distinct from old.trade_status then
      raise exception 'trade_status is not client-writable — use respond_to_trade_request()';
    end if;
    if new.follow_status is distinct from old.follow_status then
      raise exception 'follow_status is not client-writable — use accept_follow_request() / deny_follow_request()';
    end if;
  end if;
  return new;
end;
$$;

create trigger notifications_lock_status_columns_trigger
  before update on notifications
  for each row execute function notifications_lock_status_columns();

-- Flagged extra, see file header.
create or replace function activity_items_lock_reaction_counts()
returns trigger
language plpgsql
security invoker
as $$
begin
  if auth.role() is distinct from 'service_role' and current_user is distinct from 'sippd_rpc' then
    if new.reactions_fire is distinct from old.reactions_fire
      or new.reactions_star is distinct from old.reactions_star
      or new.reactions_wow is distinct from old.reactions_wow
    then
      raise exception 'reaction counts are not client-writable — use react_to_activity()';
    end if;
  end if;
  return new;
end;
$$;

create trigger activity_items_lock_reaction_counts_trigger
  before update on activity_items
  for each row execute function activity_items_lock_reaction_counts();

-- ── New-user provisioning ────────────────────────────────────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Public profile view ──────────────────────────────────────────────────────
-- Replaces every full-user-table read call site (notifyRarePull.js,
-- TradeLogDialog.jsx, FindCollectors.jsx, CollectorsLeaderboard.jsx) with a
-- narrow, name-only surface. Deliberately owned by the migration role (not
-- created with security_invoker), so it runs with the view owner's privileges
-- and is NOT subject to the profiles table's owner-only RLS below — that's
-- what makes "list other users' display names" possible at all without
-- reopening the full profiles table. It never selects email, role, streak,
-- or any other sensitive column, so that's the entire access grant.
create view public_profiles as
select id, full_name, is_private
from profiles;

grant select on public_profiles to authenticated;

-- ── RPCs ──────────────────────────────────────────────────────────────────────

create or replace function tick_streak()
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row profiles;
  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := v_today - 1;
  v_new_streak integer;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  select * into v_row from profiles where id = v_uid for update;
  if not found then
    raise exception 'profile not found';
  end if;

  if v_row.last_active_date = v_today then
    return v_row;
  elsif v_row.last_active_date = v_yesterday then
    v_new_streak := v_row.current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  update profiles
  set current_streak = v_new_streak, last_active_date = v_today
  where id = v_uid
  returning * into v_row;

  return v_row;
end;
$$;

alter function tick_streak() owner to sippd_rpc;
grant execute on function tick_streak() to authenticated;

create or replace function vote_on_can(
  p_can_id uuid,
  p_rarity rarity_tier,
  p_name text default null,
  p_brand text default null,
  p_flavour text default null,
  p_edition text default null,
  p_image_url text default null,
  p_barcode text default null
)
returns shared_cans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter uuid := auth.uid();
  v_can shared_cans;
  v_can_id uuid := p_can_id;
  v_barcode text := nullif(trim(p_barcode), '');   -- blank input must never collide with other blanks
  v_delta_common integer := case when p_rarity = 'Common' then 1 else 0 end;
  v_delta_uncommon integer := case when p_rarity = 'Uncommon' then 1 else 0 end;
  v_delta_rare integer := case when p_rarity = 'Rare' then 1 else 0 end;
  v_delta_ultra integer := case when p_rarity = 'Ultra Rare' then 1 else 0 end;
  v_delta_legendary integer := case when p_rarity = 'Legendary' then 1 else 0 end;
begin
  if v_voter is null then
    raise exception 'must be authenticated to vote';
  end if;

  if v_can_id is null then
    if p_name is null or p_brand is null then
      raise exception 'name and brand are required to add a new can';
    end if;

    begin
      insert into shared_cans (
        name, brand, flavour, edition, image_url, barcode,
        common_votes, uncommon_votes, rare_votes, ultra_rare_votes, legendary_votes,
        total_votes, consensus_rarity, confidence
      )
      values (
        p_name, p_brand, p_flavour, p_edition, p_image_url, v_barcode,
        v_delta_common, v_delta_uncommon, v_delta_rare, v_delta_ultra, v_delta_legendary,
        1, p_rarity, 'unrated'
      )
      returning * into v_can;

      insert into rarity_votes (can_id, voter_id, voted_rarity)
      values (v_can.id, v_voter, p_rarity);

      return v_can;
    exception when unique_violation then
      -- shared_cans_barcode_unique_idx fired: someone else already added this
      -- exact barcode, most likely a concurrent scan. Don't fail the request —
      -- fall through and vote on their entry instead of creating a duplicate.
      select id into v_can_id from shared_cans where barcode = v_barcode;
    end;
  end if;

  perform 1 from shared_cans where id = v_can_id for update;
  if not found then
    raise exception 'can not found';
  end if;

  begin
    insert into rarity_votes (can_id, voter_id, voted_rarity)
    values (v_can_id, v_voter, p_rarity);
  exception when unique_violation then
    raise exception 'you have already voted on this can';
  end;

  update shared_cans set
    common_votes     = common_votes + v_delta_common,
    uncommon_votes   = uncommon_votes + v_delta_uncommon,
    rare_votes       = rare_votes + v_delta_rare,
    ultra_rare_votes = ultra_rare_votes + v_delta_ultra,
    legendary_votes  = legendary_votes + v_delta_legendary,
    total_votes      = total_votes + 1,
    consensus_rarity = compute_consensus_rarity(
      common_votes + v_delta_common, uncommon_votes + v_delta_uncommon, rare_votes + v_delta_rare,
      ultra_rare_votes + v_delta_ultra, legendary_votes + v_delta_legendary
    ),
    confidence = compute_confidence(total_votes + 1)
  where id = v_can_id
  returning * into v_can;

  return v_can;
end;
$$;

alter function vote_on_can(uuid, rarity_tier, text, text, text, text, text, text) owner to sippd_rpc;
grant execute on function vote_on_can(uuid, rarity_tier, text, text, text, text, text, text) to authenticated;

create or replace function toggle_favourite(p_collection_id uuid)
returns user_collection
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item user_collection;
  v_new_value boolean;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  select * into v_item from user_collection where id = p_collection_id for update;
  if not found then
    raise exception 'collection item not found';
  end if;
  if v_item.owner_id <> v_uid then
    raise exception 'not your collection item';
  end if;

  v_new_value := not v_item.is_favourite;

  update user_collection set is_favourite = v_new_value
  where id = p_collection_id
  returning * into v_item;

  update shared_cans
  set community_favourites = greatest(0, community_favourites + case when v_new_value then 1 else -1 end)
  where id = v_item.can_id;

  return v_item;
end;
$$;

alter function toggle_favourite(uuid) owner to sippd_rpc;
grant execute on function toggle_favourite(uuid) to authenticated;

create or replace function request_follow(p_target_id uuid)
returns follows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target profiles;
  v_status follow_status;
  v_follow follows;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if v_uid = p_target_id then
    raise exception 'cannot follow yourself';
  end if;

  select * into v_target from profiles where id = p_target_id;
  if not found then
    raise exception 'target user not found';
  end if;

  v_status := case when v_target.is_private then 'pending' else 'accepted' end;

  insert into follows (follower_id, following_id, status)
  values (v_uid, p_target_id, v_status)
  returning * into v_follow;

  insert into notifications (recipient_id, type, actor_id, follow_id, is_read)
  values (
    p_target_id,
    case when v_status = 'pending' then 'follow_request' else 'new_follower' end,
    v_uid,
    v_follow.id,
    false
  );

  return v_follow;
end;
$$;

alter function request_follow(uuid) owner to sippd_rpc;
grant execute on function request_follow(uuid) to authenticated;

create or replace function accept_follow_request(p_follow_id uuid)
returns follows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_follow follows;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  select * into v_follow from follows where id = p_follow_id for update;
  if not found then
    raise exception 'follow request not found';
  end if;
  if v_follow.following_id <> v_uid then
    raise exception 'not your follow request to accept';
  end if;

  update follows set status = 'accepted' where id = p_follow_id returning * into v_follow;

  update notifications
  set is_read = true, follow_status = 'accepted'
  where follow_id = p_follow_id and recipient_id = v_uid;

  return v_follow;
end;
$$;

alter function accept_follow_request(uuid) owner to sippd_rpc;
grant execute on function accept_follow_request(uuid) to authenticated;

create or replace function deny_follow_request(p_follow_id uuid)
returns follows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_follow follows;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  select * into v_follow from follows where id = p_follow_id for update;
  if not found then
    raise exception 'follow request not found';
  end if;
  if v_follow.following_id <> v_uid then
    raise exception 'not your follow request to deny';
  end if;

  update follows set status = 'denied' where id = p_follow_id returning * into v_follow;

  update notifications
  set is_read = true, follow_status = 'denied'
  where follow_id = p_follow_id and recipient_id = v_uid;

  return v_follow;
end;
$$;

alter function deny_follow_request(uuid) owner to sippd_rpc;
grant execute on function deny_follow_request(uuid) to authenticated;

-- Companion to respond_to_trade_request(): without this, locking down direct
-- notification inserts (below) would leave no way to ever send a trade
-- request in the first place.
create or replace function send_trade_request(
  p_target_id uuid,
  p_offer_can_name text,
  p_offer_can_brand text,
  p_offer_can_rarity text,
  p_want_can_name text,
  p_message text default null
)
returns notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_notif notifications;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if v_uid = p_target_id then
    raise exception 'cannot trade with yourself';
  end if;
  if p_want_can_name is null or length(trim(p_want_can_name)) = 0 then
    raise exception 'must specify what you want in return';
  end if;

  insert into notifications (
    recipient_id, type, actor_id,
    trade_offer_can_name, trade_offer_can_brand, trade_offer_can_rarity,
    trade_want_can_name, trade_message, trade_status, is_read
  )
  values (
    p_target_id, 'trade_request', v_uid,
    p_offer_can_name, p_offer_can_brand, p_offer_can_rarity,
    p_want_can_name, p_message, 'pending', false
  )
  returning * into v_notif;

  return v_notif;
end;
$$;

alter function send_trade_request(uuid, text, text, text, text, text) owner to sippd_rpc;
grant execute on function send_trade_request(uuid, text, text, text, text, text) to authenticated;

create or replace function respond_to_trade_request(p_notification_id uuid, p_accept boolean)
returns notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_notif notifications;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  select * into v_notif from notifications where id = p_notification_id for update;
  if not found then
    raise exception 'trade request not found';
  end if;
  if v_notif.recipient_id <> v_uid then
    raise exception 'not your trade request to respond to';
  end if;
  if v_notif.type <> 'trade_request' then
    raise exception 'notification is not a trade request';
  end if;

  update notifications
  set is_read = true, trade_status = case when p_accept then 'accepted' else 'declined' end
  where id = p_notification_id
  returning * into v_notif;

  insert into notifications (
    recipient_id, type, actor_id,
    trade_response_text, trade_offer_can_name, trade_want_can_name, is_read
  )
  values (
    v_notif.actor_id, 'trade_response', v_uid,
    case when p_accept then 'accepted' else 'declined' end,
    v_notif.trade_offer_can_name, v_notif.trade_want_can_name, false
  );

  return v_notif;
end;
$$;

alter function respond_to_trade_request(uuid, boolean) owner to sippd_rpc;
grant execute on function respond_to_trade_request(uuid, boolean) to authenticated;

-- Flagged extra, see file header — same race-condition class as vote_on_can /
-- toggle_favourite (Feed.jsx does the create-Reaction-then-update-count
-- sequence as two separate, non-atomic, client-trusted calls today).
create or replace function react_to_activity(p_activity_id uuid, p_emoji reaction_emoji)
returns activity_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item activity_items;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  begin
    insert into reactions (activity_id, reactor_id, emoji) values (p_activity_id, v_uid, p_emoji);
  exception when unique_violation then
    raise exception 'already reacted to this activity';
  end;

  if p_emoji = 'fire' then
    update activity_items set reactions_fire = reactions_fire + 1 where id = p_activity_id returning * into v_item;
  elsif p_emoji = 'star' then
    update activity_items set reactions_star = reactions_star + 1 where id = p_activity_id returning * into v_item;
  elsif p_emoji = 'wow' then
    update activity_items set reactions_wow = reactions_wow + 1 where id = p_activity_id returning * into v_item;
  end if;

  if not found then
    raise exception 'activity not found';
  end if;

  return v_item;
end;
$$;

alter function react_to_activity(uuid, reaction_emoji) owner to sippd_rpc;
grant execute on function react_to_activity(uuid, reaction_emoji) to authenticated;

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table profiles enable row level security;
create policy profiles_select_own on profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- no insert policy: rows are created only by handle_new_user() on signup
-- no delete policy: account deletion is a later migration (Auth Admin API + cascade)

alter table shared_cans enable row level security;
create policy shared_cans_select_all on shared_cans for select to authenticated using (true);
-- no insert/update/delete policy for plain authenticated: every write goes through
-- vote_on_can(), which runs as sippd_rpc and bypasses RLS

alter table rarity_votes enable row level security;
create policy rarity_votes_select_own on rarity_votes for select to authenticated using (voter_id = auth.uid());
-- no insert policy: only vote_on_can() may insert — this is what makes the
-- "one vote per can" unique constraint actually trustworthy

alter table user_collection enable row level security;
create policy user_collection_select_own on user_collection for select to authenticated using (owner_id = auth.uid());
create policy user_collection_insert_own on user_collection for insert to authenticated with check (owner_id = auth.uid());
create policy user_collection_update_own on user_collection for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy user_collection_delete_own on user_collection for delete to authenticated using (owner_id = auth.uid());

alter table crates enable row level security;
create policy crates_select_own on crates for select to authenticated using (owner_id = auth.uid());
create policy crates_insert_own on crates for insert to authenticated with check (owner_id = auth.uid());
create policy crates_update_own on crates for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy crates_delete_own on crates for delete to authenticated using (owner_id = auth.uid());

alter table follows enable row level security;
-- both sides of the relationship can read it — the followee needs to see an
-- incoming pending request, which the original app's declared owner-only
-- (=creator-only) read would not have allowed. Real behavior improvement,
-- flagged in chat.
create policy follows_select_participant on follows for select to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());
-- no insert policy: request_follow() only, so status + the matching
-- notification are never created out of sync
-- no update policy: transitions only via accept_follow_request() / deny_follow_request()
create policy follows_delete_own on follows for delete to authenticated using (follower_id = auth.uid());

alter table notifications enable row level security;
create policy notifications_select_own on notifications for select to authenticated using (recipient_id = auth.uid());
-- no insert policy: request_follow(), accept/deny_follow_request(), send_trade_request(),
-- respond_to_trade_request() are the only writers — this is what closes the "any
-- client can create a notification for any recipient" gap found in
-- notifyRarePull.js and TradeRequestDialog.jsx today
create policy notifications_update_is_read on notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- (the lockdown trigger still blocks trade_status/follow_status changes even
--  though this policy technically permits the UPDATE statement itself)

alter table activity_items enable row level security;
-- Enforces at the DB layer the privacy Feed.jsx only fakes today: right now
-- ActivityItem.list() ships every row, including private users', to every
-- client, and is_private_user is filtered client-side in the "global" tab
-- only. This policy is a deliberate fix, not a silent behavior change — flagged
-- in the chat summary.
create policy activity_items_select_visible on activity_items for select to authenticated
  using (
    user_id = auth.uid()
    or not is_private_user
    or exists (
      select 1 from follows
      where follower_id = auth.uid() and following_id = activity_items.user_id and status = 'accepted'
    )
  );
create policy activity_items_insert_own on activity_items for insert to authenticated with check (user_id = auth.uid());

alter table reactions enable row level security;
create policy reactions_select_own on reactions for select to authenticated using (reactor_id = auth.uid());
-- no insert policy: react_to_activity() only (see the "flagged extra" note above —
-- if you'd rather defer this RPC, this table's writes need a different plan)

alter table trades enable row level security;
create policy trades_select_own on trades for select to authenticated using (owner_id = auth.uid());
create policy trades_insert_own on trades for insert to authenticated with check (owner_id = auth.uid());
create policy trades_update_own on trades for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy trades_delete_own on trades for delete to authenticated using (owner_id = auth.uid());

alter table trade_templates enable row level security;
create policy trade_templates_select_own on trade_templates for select to authenticated using (owner_id = auth.uid());
create policy trade_templates_insert_own on trade_templates for insert to authenticated with check (owner_id = auth.uid());
create policy trade_templates_update_own on trade_templates for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy trade_templates_delete_own on trade_templates for delete to authenticated using (owner_id = auth.uid());
