-- Pro limit fixes, found by supabase/tests/pro_entitlements_test.sql.
--
-- 1. Crates: the free 10-cans-per-crate limit (enforce_crate_can_limit,
--    20260901000000_add_pro_subscription.sql, re-created in
--    20260914000001_guard_is_pro_caller.sql) fired BEFORE UPDATE only, so a
--    crate INSERTED with more than 10 cans skipped it (the app inserts crates
--    empty, but the API doesn't have to). And on update it rejected any
--    non-Pro crate over 10 cans, not just one that grows: a subscriber whose
--    Pro ended could no longer rename a big crate, or remove cans from it
--    unless they got it to 10 or fewer in one step.
--    Now: only growing a crate past 10 needs Pro, on insert and update.
--    Crates made while Pro keep their cans, and can be renamed and shrunk.
--
-- 2. Pins: the 6 (free) / 10 (Pro) pinned-can cap was enforced only in the
--    app (useTogglePin.js), so a plain API call could pin any number. The
--    public showcase was already trimmed to the owner's real allowance when
--    it renders, so the impact was small, but CLAUDE.md's rule is that a
--    Pro-gated limit is enforced by the database. Now: pinning a can that
--    isn't pinned yet is refused past the cap. Existing pins are never
--    touched, so a lapsed subscriber keeps their 10 and just can't add more.
--
-- Not destructive: replaces one trigger function, adds another, and
-- (re)creates their triggers. No data changes.

-- ── 1. crates ──────────────────────────────────────────────────────────────
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

-- ── 2. pins ────────────────────────────────────────────────────────────────
-- SECURITY INVOKER, like the crate triggers: is_pro(owner) passes its caller
-- guard because the caller is the owner (RLS only lets owners write their
-- rows). Keep the caps in step with MAX_PINS_FREE / MAX_PINS_PRO in
-- src/hooks/useTogglePin.js.
create or replace function public.enforce_pin_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pinned integer;
  v_cap integer;
begin
  -- Only a can going from unpinned to pinned is checked. The offline sync
  -- sends pinned_at with every edit, so unchanged pins must pass untouched.
  if new.pinned_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.pinned_at is not null then
    return new;
  end if;

  select count(*) into v_pinned
  from user_collection
  where owner_id = new.owner_id and pinned_at is not null and id <> new.id;

  v_cap := case when is_pro(new.owner_id) then 10 else 6 end;
  if v_pinned >= v_cap then
    raise exception 'pin_limit_reached';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_pin_limit_trigger on user_collection;
create trigger enforce_pin_limit_trigger
  before insert or update of pinned_at on user_collection
  for each row execute function enforce_pin_limit();
