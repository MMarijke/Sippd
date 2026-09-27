-- Full replacement of the theme catalogue: the prior 18 themes (Neon Grid /
-- Field Guide / Origami Fold) are deleted entirely and replaced with Phase
-- 1's 12 themes across 2 new families (Neon Arcade / Vintage Pastel). See
-- src/index.css for the actual token values this gates.
--
-- Order matters within this transaction: the CHECK constraint has to widen
-- (drop it) before the backfill UPDATE can touch old-catalogue rows, and
-- the column default has to change in the same migration as the
-- constraint, not a follow-up -- handle_new_user() (20260815120100_security.sql)
-- only ever inserts (id, full_name) into profiles, relying entirely on
-- theme's own column default for every new signup. Leaving that default at
-- 'cyan' after this constraint ships would break every new signup outright
-- the moment the old default value stopped being a valid theme id.

alter table profiles drop constraint profiles_theme_valid;

-- Every user on any of the 18 deleted theme ids lands on Power-Up (the new
-- free default) on next load -- Pro users keep Pro access, they just land
-- on the same default as everyone else and pick a new Pro theme from here.
update profiles set theme = 'power-up'
where theme not in (
  'power-up', 'cyberpunk', 'plasma', 'boss-fight', 'xp-gold', 'synthwave',
  'mint-fizz', 'strawberry-cream', 'blue-raspberry', 'lemon-pop', 'peach-soda', 'grape-float'
);

alter table profiles alter column theme set default 'power-up';

alter table profiles add constraint profiles_theme_valid check (
  theme in (
    'power-up', 'cyberpunk', 'plasma', 'boss-fight', 'xp-gold', 'synthwave',
    'mint-fizz', 'strawberry-cream', 'blue-raspberry', 'lemon-pop', 'peach-soda', 'grape-float'
  )
);

-- Only the free-id list in the Pro-lock branch changes (3 old free ids
-- across 3 families -> 2 new free ids across 2 families); every other
-- branch is copied unchanged from 20260926000000_add_theme_families.sql.
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
      and new.theme not in ('power-up', 'mint-fizz') then
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
