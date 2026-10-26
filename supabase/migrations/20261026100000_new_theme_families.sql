-- Three new theme families (2026-10-26), from the theme catalogue
-- critique's gaps. Additive: no data changes, no theme removed.
--   Essentials:    floodlight, ledger                 (both free)
--   Alloy:         alloy-aluminium, alloy-teal,        (Pro)
--                  alloy-red, alloy-gold
--   Soda Fountain: cola, root-beer                     (Pro)
-- Their palettes, fonts, textures and holo Legendary live in
-- src/index.css; the picker entries in src/hooks/useTheme.js.

-- 1. The theme id has to be one the app knows.
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
    -- Essentials
    'floodlight', 'ledger',
    -- Alloy
    'alloy-aluminium', 'alloy-teal', 'alloy-red', 'alloy-gold',
    -- Soda Fountain
    'cola', 'root-beer'
  )
);

-- 2. The Pro lock's free list gains Floodlight and Ledger. Same function
-- body as 20261019000000 otherwise. SECURITY INVOKER (the default), so
-- current_user is the real caller (CLAUDE.md's trigger rule), and
-- `set search_path = public` is repeated here because CREATE OR REPLACE
-- drops the setting that 20261020000000 pinned.
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
      and new.theme not in ('power-up', 'moonlight', 'sage', 'carbon', 'bubblegum', 'spring-plum', 'floodlight', 'ledger') then
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
