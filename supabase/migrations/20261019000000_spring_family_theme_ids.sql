-- Allows the Spring family's six theme ids. Fixes "Couldn't save your
-- theme" on every Spring theme.
--
-- Why a new migration: 20261018000000 shipped (PR #254) when Spring was a
-- single theme id, 'spring', and the database recorded it as applied. The
-- next PR rewrote that SAME version's file for the six-theme family, and a
-- recorded version is never re-run, so the live constraint kept 'spring'
-- and rejected every spring-* id. That file is restored to what actually
-- ran; this migration makes the change for real. (Lesson: never edit a
-- migration file once a PR containing it has merged -- add a new one.)
--
-- 1. Backfill: anyone still on the retired 'spring' id moves to its
--    successor 'spring-plum' (checked 2026-10-19: nobody is; this is a
--    guard). Runs as postgres, which profiles_lock_columns() exempts.
-- 2. profiles_theme_valid: 'spring' out, the six spring-* ids in.
-- 3. profiles_lock_columns(): free list 'spring' -> 'spring-plum'. Every
--    other branch copied unchanged from 20261018000000 (itself unchanged
--    from 20260929000000_trim_theme_catalogue.sql); stays SECURITY INVOKER
--    (the default) so current_user reflects the real caller -- CLAUDE.md.

update profiles set theme = 'spring-plum' where theme = 'spring';

alter table profiles drop constraint profiles_theme_valid;

alter table profiles add constraint profiles_theme_valid check (
  theme in (
    -- Neon Arcade
    'power-up', 'cyberpunk', 'plasma', 'boss-fight', 'synthwave',
    -- Cosmic
    'moonlight', 'nebula', 'solar-flare', 'aurora', 'deep-space', 'stellar-gold',
    -- Botanical
    'sage', 'forest', 'fern', 'moss', 'meadow',
    -- Noir
    'carbon', 'crimson', 'amethyst', 'sapphire', 'emerald', 'silver-screen',
    -- Candy
    'bubblegum', 'blue-pop', 'grape-candy', 'orange-crush', 'sour-apple', 'cherry-pop',
    -- Spring
    'spring-plum', 'spring-brick', 'spring-coral', 'spring-butter', 'spring-pistachio', 'spring-olive'
  )
);

create or replace function public.profiles_lock_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user is distinct from 'sippd_rpc'
    and current_user is distinct from 'postgres'
    and current_user is distinct from 'service_role' then
    if new.role is distinct from old.role then
      raise exception 'role is not client-writable';
    end if;
    if new.current_streak is distinct from old.current_streak then
      raise exception 'current_streak is not client-writable — use tick_streak()';
    end if;
    if new.last_active_date is distinct from old.last_active_date then
      raise exception 'last_active_date is not client-writable — use tick_streak()';
    end if;
    if new.subscription_status is distinct from old.subscription_status then
      raise exception 'subscription_status is not client-writable';
    end if;
    if new.paddle_subscription_id is distinct from old.paddle_subscription_id then
      raise exception 'paddle_subscription_id is not client-writable';
    end if;
    if new.paddle_customer_id is distinct from old.paddle_customer_id then
      raise exception 'paddle_customer_id is not client-writable';
    end if;
    if new.pro_expires_at is distinct from old.pro_expires_at then
      raise exception 'pro_expires_at is not client-writable';
    end if;
    if new.theme is distinct from old.theme
      and new.theme not in ('power-up', 'moonlight', 'sage', 'carbon', 'bubblegum', 'spring-plum') then
      if old.subscription_status is distinct from 'pro'
        or (old.pro_expires_at is not null and old.pro_expires_at <= now())
      then
        raise exception 'theme is Pro-only — upgrade to unlock';
      end if;
    end if;
  end if;
  return new;
end;
$$;
