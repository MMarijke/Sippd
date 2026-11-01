-- PROPOSED, NOT APPLIED. Fixes two gaps in the free 10-cans-per-crate limit
-- (enforce_crate_can_limit, 20260901000000_add_pro_subscription.sql, as
-- re-created in 20260914000001_guard_is_pro_caller.sql). Found by
-- supabase/tests/pro_entitlements_test.sql, whose last checks fail until
-- this is applied.
--
-- 1. The trigger fires BEFORE UPDATE only, so a crate INSERTED with more
--    than 10 cans skips the check. The app always inserts crates empty, but
--    the API doesn't have to: a free account can create crates of any size.
-- 2. On update it rejects any non-Pro crate holding more than 10 cans, not
--    just one that grows. A subscriber whose Pro ends can then no longer
--    rename a big crate, or remove cans from it unless they get it to 10
--    or fewer in one step.
--
-- The rule after this: only growing a crate past 10 needs Pro. Crates made
-- while Pro keep their cans, and can be renamed and shrunk.
--
-- To apply: review, move into supabase/migrations/ with a fresh timestamp,
-- `supabase db push`. Not destructive: it replaces one trigger function and
-- re-creates its trigger; no data changes.

create or replace function public.enforce_crate_can_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new integer := coalesce(array_length(new.can_ids, 1), 0);
  v_old integer := 0;
begin
  if tg_op = 'UPDATE' then
    v_old := coalesce(array_length(old.can_ids, 1), 0);
  end if;
  -- Cheap checks first: is_pro() is only asked when the crate grows past 10.
  if v_new > 10 and v_new > v_old and not is_pro(new.owner_id) then
    raise exception 'crate_can_limit_reached';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_crate_can_limit_trigger on crates;
create trigger enforce_crate_can_limit_trigger
  before insert or update of can_ids on crates
  for each row execute function enforce_crate_can_limit();
