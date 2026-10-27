-- Retires the Essentials family (product direction, 2026-10-27): Floodlight
-- and Ledger, both free, added in 20261026100000_new_theme_families.sql.
-- Anyone on them moves to the free default, Power-Up, keeping their
-- light/dark: Floodlight (dark) -> Power-Up dark, Ledger (light) -> Power-Up
-- light. Both destinations are free, so no one's Pro access changes.
--
-- Same pattern as 20261019120000_retire_moss.sql: backfill first (it runs
-- as postgres, which profiles_lock_columns() exempts), then narrow the
-- check constraint, then drop the two ids from the lock's free list.
-- retired_theme drives Settings' one-time "your theme was retired" note
-- (RETIRED_THEMES in src/hooks/useTheme.js).

-- 1. Move anyone on a retired theme, keeping their light/dark.
update profiles set retired_theme = 'floodlight', theme = 'power-up', theme_polarity = 'dark' where theme = 'floodlight';
update profiles set retired_theme = 'ledger', theme = 'power-up', theme_polarity = 'light' where theme = 'ledger';

-- 2. The theme id has to be one the app still knows.
alter table profiles drop constraint profiles_theme_valid;

alter table profiles add constraint profiles_theme_valid check (
  theme in (
    -- Neon Arcade
    'power-up', 'cyberpunk', 'plasma', 'boss-fight', 'synthwave',
    -- Cosmic
    'moonlight', 'nebula', 'solar-flare', 'aurora', 'deep-space', 'stellar-gold',
    -- Botanical
    'sage', 'forest', 'fern', 'meadow',
    -- Noir
    'carbon', 'crimson', 'amethyst', 'sapphire', 'emerald', 'silver-screen',
    -- Candy
    'bubblegum', 'blue-pop', 'grape-candy', 'orange-crush', 'sour-apple', 'cherry-pop',
    -- Spring
    'spring-plum', 'spring-brick', 'spring-coral', 'spring-butter', 'spring-pistachio', 'spring-olive',
    -- Alloy
    'alloy-aluminium', 'alloy-teal', 'alloy-red', 'alloy-gold',
    -- Soda Fountain
    'cola', 'root-beer'
  )
);

-- 3. The Pro lock's free list loses Floodlight and Ledger. Same function
-- body as 20261026100000 otherwise. SECURITY INVOKER (the default), so
-- current_user is the real caller (CLAUDE.md's trigger rule), and
-- `set search_path = public` is repeated because CREATE OR REPLACE drops
-- the setting that 20261020000000 pinned.
create or replace function public.profiles_lock_columns()
returns trigger
language plpgsql
set search_path = public
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
