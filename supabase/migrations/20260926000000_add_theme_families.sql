-- Adds two new theme families (Field Guide, Origami Fold) alongside the
-- existing Neon Grid family — 6 palettes each, 1 free + 5 Pro per family,
-- mirroring the exact free/Pro structure Neon Grid already uses.
--
-- Two things need updating, both discovered by reading the existing
-- theme-gating code: the profiles_theme_valid check constraint (which
-- enumerates every valid theme id) and profiles_lock_columns()'s theme
-- guard (which currently hardcodes 'cyan' as the only free id).

alter table profiles drop constraint profiles_theme_valid;
alter table profiles add constraint profiles_theme_valid check (
  theme in (
    'cyan', 'common', 'uncommon', 'rare', 'ultra', 'legendary',
    'herbarium', 'monarch', 'morpho', 'luna', 'cochineal', 'hornet',
    'washi', 'shu', 'ai', 'matcha', 'ume', 'kohaku'
  )
);

-- Only the theme guard's condition changes (<> 'cyan' -> not in (...three
-- free ids...)); every other branch is unchanged from
-- 20260916000007_fix_profile_theme_guard_fail_open.sql.
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
      and new.theme not in ('cyan', 'herbarium', 'washi') then
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
