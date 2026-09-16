-- notifications.actor_name has been null-forever for every trade
-- notification -- the same fix already applied to follow/rare-pull
-- notifications (20260915000000_fix_follow_request_reinsert_and_rate_limit.sql,
-- 20260915000001_wire_rare_pull_follow_notifications.sql) was never applied
-- to send_trade_request()/respond_to_trade_request(). Every "X wants to
-- trade..." / "X accepted/declined your trade request..." notification has
-- rendered with a blank name. Bodies otherwise verbatim copies of the
-- current definitions (20260903000001_replace_auth_uid_in_sippd_rpc_functions.sql).

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
  v_uid uuid := sippd_auth_uid();
  v_actor_name text;
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

  select full_name into v_actor_name from profiles where id = v_uid;

  insert into notifications (
    recipient_id, type, actor_id, actor_name,
    trade_offer_can_name, trade_offer_can_brand, trade_offer_can_rarity,
    trade_want_can_name, trade_message, trade_status, is_read
  )
  values (
    p_target_id, 'trade_request', v_uid, v_actor_name,
    p_offer_can_name, p_offer_can_brand, p_offer_can_rarity,
    p_want_can_name, p_message, 'pending', false
  )
  returning * into v_notif;

  return v_notif;
end;
$$;

alter function send_trade_request(uuid, uuid, text, text, text, text, text) owner to sippd_rpc;
grant execute on function send_trade_request(uuid, uuid, text, text, text, text, text) to authenticated;

create or replace function respond_to_trade_request(p_caller_id uuid, p_notification_id uuid, p_accept boolean)
returns notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := sippd_auth_uid();
  v_actor_name text;
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

  select full_name into v_actor_name from profiles where id = v_uid;

  insert into notifications (
    recipient_id, type, actor_id, actor_name,
    trade_response_text, trade_offer_can_name, trade_want_can_name, is_read
  )
  values (
    v_notif.actor_id, 'trade_response', v_uid, v_actor_name,
    case when p_accept then 'accepted' else 'declined' end,
    v_notif.trade_offer_can_name, v_notif.trade_want_can_name, false
  );

  return v_notif;
end;
$$;

alter function respond_to_trade_request(uuid, uuid, boolean) owner to sippd_rpc;
grant execute on function respond_to_trade_request(uuid, uuid, boolean) to authenticated;
