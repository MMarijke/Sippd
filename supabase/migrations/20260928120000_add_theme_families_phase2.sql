-- Phase 2: adds 24 new themes across 4 new families (Cosmic, Botanical,
-- Noir, Candy) alongside the 12 Phase 1 themes (Neon Arcade, Vintage
-- Pastel) -- 36 total. See src/index.css for the actual token values this
-- gates. Unlike Phase 1's polarity work, these 24 are single fixed-polarity
-- themes (no [data-polarity] counterpart) -- theme_polarity still applies
-- (it's a generic column, not Phase-1-specific), it just never changes what
-- a Phase 2 theme looks like, since its CSS selectors don't key off it.
--
-- No backfill needed here: this only widens the allowed set, it doesn't
-- retire any existing id the way 20260927000000 did.

alter table profiles drop constraint profiles_theme_valid;

alter table profiles add constraint profiles_theme_valid check (
  theme in (
    -- Phase 1
    'power-up', 'cyberpunk', 'plasma', 'boss-fight', 'xp-gold', 'synthwave',
    'mint-fizz', 'strawberry-cream', 'blue-raspberry', 'lemon-pop', 'peach-soda', 'grape-float',
    -- Phase 2: Cosmic
    'moonlight', 'nebula', 'solar-flare', 'aurora', 'deep-space', 'stellar-gold',
    -- Phase 2: Botanical
    'sage', 'forest', 'fern', 'moss', 'terracotta', 'meadow',
    -- Phase 2: Noir
    'carbon', 'crimson', 'amethyst', 'sapphire', 'champagne', 'emerald',
    -- Phase 2: Candy
    'bubblegum', 'blue-pop', 'grape-candy', 'orange-crush', 'sour-apple', 'cherry-pop'
  )
);

-- Only the free-id list in the Pro-lock branch changes (2 free ids across 2
-- families -> 6 free ids across 6 families, one per family's free tier);
-- every other branch is copied unchanged from 20260927000000's definition.
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
      and new.theme not in ('power-up', 'mint-fizz', 'moonlight', 'sage', 'carbon', 'bubblegum') then
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
