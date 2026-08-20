-- Adds an explicit p_caller_id parameter to every SECURITY DEFINER RPC and
-- validates it against auth.uid() before trusting it for anything. This is
-- NOT "replace auth.uid() with a client-supplied value" -- that would let any
-- authenticated client pass an arbitrary p_caller_id and act as any other
-- user (vote, favourite, follow, trade, react, tick streak on their behalf).
-- auth.uid() stays the actual source of truth; p_caller_id must match it or
-- the call is rejected. This also doubles as a live test of the theory that
-- auth.uid() doesn't resolve inside a SECURITY DEFINER function owned by the
-- NOLOGIN sippd_rpc role -- if that were true, every one of these would now
-- fail with 'caller mismatch' instead of silently doing the wrong thing.

-- ── tick_streak ──────────────────────────────────────────────────────────────
drop function if exists tick_streak();

create or replace function tick_streak(p_caller_id uuid)
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
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
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

alter function tick_streak(uuid) owner to sippd_rpc;
grant execute on function tick_streak(uuid) to authenticated;

-- ── vote_on_can ──────────────────────────────────────────────────────────────
drop function if exists vote_on_can(uuid, rarity_tier, text, text, text, text, text, text);

create or replace function vote_on_can(
  p_caller_id uuid,
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
  if p_caller_id is distinct from v_voter then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_voter;
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
      -- exact barcode, most likely a concurrent scan. Don't fail the request --
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

alter function vote_on_can(uuid, uuid, rarity_tier, text, text, text, text, text, text) owner to sippd_rpc;
grant execute on function vote_on_can(uuid, uuid, rarity_tier, text, text, text, text, text, text) to authenticated;

-- ── toggle_favourite ─────────────────────────────────────────────────────────
drop function if exists toggle_favourite(uuid);

create or replace function toggle_favourite(p_caller_id uuid, p_collection_id uuid)
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
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
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

alter function toggle_favourite(uuid, uuid) owner to sippd_rpc;
grant execute on function toggle_favourite(uuid, uuid) to authenticated;

-- ── request_follow ───────────────────────────────────────────────────────────
drop function if exists request_follow(uuid);

create or replace function request_follow(p_caller_id uuid, p_target_id uuid)
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
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
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

alter function request_follow(uuid, uuid) owner to sippd_rpc;
grant execute on function request_follow(uuid, uuid) to authenticated;

-- ── accept_follow_request ────────────────────────────────────────────────────
drop function if exists accept_follow_request(uuid);

create or replace function accept_follow_request(p_caller_id uuid, p_follow_id uuid)
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
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
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

alter function accept_follow_request(uuid, uuid) owner to sippd_rpc;
grant execute on function accept_follow_request(uuid, uuid) to authenticated;

-- ── deny_follow_request ──────────────────────────────────────────────────────
drop function if exists deny_follow_request(uuid);

create or replace function deny_follow_request(p_caller_id uuid, p_follow_id uuid)
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
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
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

alter function deny_follow_request(uuid, uuid) owner to sippd_rpc;
grant execute on function deny_follow_request(uuid, uuid) to authenticated;

-- ── send_trade_request ───────────────────────────────────────────────────────
drop function if exists send_trade_request(uuid, text, text, text, text, text);

create or replace function send_trade_request(
  p_caller_id uuid,
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
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
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

alter function send_trade_request(uuid, uuid, text, text, text, text, text) owner to sippd_rpc;
grant execute on function send_trade_request(uuid, uuid, text, text, text, text, text) to authenticated;

-- ── respond_to_trade_request ─────────────────────────────────────────────────
drop function if exists respond_to_trade_request(uuid, boolean);

create or replace function respond_to_trade_request(p_caller_id uuid, p_notification_id uuid, p_accept boolean)
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
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
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

alter function respond_to_trade_request(uuid, uuid, boolean) owner to sippd_rpc;
grant execute on function respond_to_trade_request(uuid, uuid, boolean) to authenticated;

-- ── react_to_activity ────────────────────────────────────────────────────────
drop function if exists react_to_activity(uuid, reaction_emoji);

create or replace function react_to_activity(p_caller_id uuid, p_activity_id uuid, p_emoji reaction_emoji)
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
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
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

alter function react_to_activity(uuid, uuid, reaction_emoji) owner to sippd_rpc;
grant execute on function react_to_activity(uuid, uuid, reaction_emoji) to authenticated;
