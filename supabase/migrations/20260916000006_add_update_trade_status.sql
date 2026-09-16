-- TradeHistory.jsx's updateStatus mutation was a plain client-side
-- `.from('trades').update({status})` under RLS, with a
-- `// TODO: notify trade partner via RPC (deferred)` comment that was never
-- picked up. Converts it to an RPC matching this schema's own established
-- pattern for cross-user side effects (send_trade_request/
-- respond_to_trade_request), so the status change and its notification are
-- atomic. traded_with_id is null whenever the trade was logged against a
-- free-text partner name (not a connected Sippd user) -- there's no one to
-- notify in that case, so this silently no-ops rather than erroring.
-- Reuses trade_offer_can_name/trade_want_can_name (traded_away -> offer,
-- received -> want) rather than adding dedicated columns for what would
-- otherwise be a second, unrelated "trade" concept.

create or replace function update_trade_status(p_caller_id uuid, p_trade_id uuid, p_status trade_log_status)
returns trades
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := sippd_auth_uid();
  v_trade trades;
  v_old_status trade_log_status;
  v_actor_name text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
  end if;

  select * into v_trade from trades where id = p_trade_id for update;
  if not found then
    raise exception 'trade not found';
  end if;
  if v_trade.owner_id <> v_uid then
    raise exception 'not your trade to update';
  end if;
  v_old_status := v_trade.status;

  update trades set status = p_status where id = p_trade_id returning * into v_trade;

  if v_trade.traded_with_id is not null and p_status is distinct from v_old_status then
    select full_name into v_actor_name from profiles where id = v_uid;
    insert into notifications (
      recipient_id, type, actor_id, actor_name,
      trade_offer_can_name, trade_offer_can_brand, trade_offer_can_rarity,
      trade_want_can_name, trade_new_status, is_read
    )
    values (
      v_trade.traded_with_id, 'trade_status_update', v_uid, v_actor_name,
      v_trade.traded_away_name, v_trade.traded_away_brand, v_trade.traded_away_rarity,
      v_trade.received_name, p_status::text, false
    );
  end if;

  return v_trade;
end;
$$;

alter function update_trade_status(uuid, uuid, trade_log_status) owner to sippd_rpc;
grant execute on function update_trade_status(uuid, uuid, trade_log_status) to authenticated;
