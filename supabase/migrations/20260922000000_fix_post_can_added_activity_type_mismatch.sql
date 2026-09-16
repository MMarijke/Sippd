-- The real, complete root cause of "adding a can fails" — confirmed live by
-- reproducing the exact insert user_collection RLS/PostgREST would run:
--
--   ERROR: 42804: COALESCE types text and rarity_tier cannot be matched
--   CONTEXT: PL/pgSQL function post_can_added_activity() line 11 at SQL statement
--
-- post_can_added_activity() (20260916000001_post_can_added_activity.sql)
-- declared v_rarity as text, then read shared_cans.consensus_rarity (type
-- rarity_tier) into it, then did coalesce(v_rarity, new.can_rarity) where
-- new.can_rarity (user_collection.can_rarity) is also rarity_tier. Postgres
-- has no implicit cast between rarity_tier and text usable inside COALESCE,
-- so the statement fails to plan at all -- not a runtime/value-dependent
-- failure, every single insert into user_collection with status =
-- 'collected' hit this, for every user, since that migration landed. The
-- AFTER INSERT trigger raising rolled back the whole insert transaction,
-- so the can was never actually added -- exactly matching the real bug
-- report (confirmed against a live test account: 6 of 7 recent
-- rarity_votes rows had no matching user_collection row at all, each for a
-- different can, ruling out the earlier already_collected fix as the
-- cause here).
--
-- The 20260920000000 vote_on_can() fix was a real, separate, legitimate
-- bug (re-voting on an already-voted can blocked the whole add) -- this is
-- an independent second bug that was never triggered by SQL-only review,
-- only by an actual live add.
--
-- Fix: v_rarity now matches shared_cans.consensus_rarity's real type
-- (rarity_tier), so it unifies cleanly with new.can_rarity (also
-- rarity_tier) inside COALESCE -- the result is cast to text exactly once,
-- at the end, matching activity_items.can_rarity's actual text column.
create or replace function post_can_added_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_private boolean;
  v_full_name text;
  v_rarity rarity_tier;
begin
  if new.status = 'collected' then
    select is_private, full_name into v_is_private, v_full_name from profiles where id = new.owner_id;
    select consensus_rarity into v_rarity from shared_cans where id = new.can_id;

    insert into activity_items (user_id, user_name, type, can_id, can_name, can_image_url, can_rarity, is_private_user)
    values (new.owner_id, coalesce(v_full_name, 'Collector'), 'can_added', new.can_id, new.can_name, new.can_image_url, coalesce(v_rarity, new.can_rarity)::text, coalesce(v_is_private, false));
  end if;
  return new;
end;
$$;

alter function post_can_added_activity() owner to sippd_rpc;
