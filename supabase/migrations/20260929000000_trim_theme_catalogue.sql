-- Trims the theme catalogue from 36 to 28: retires the whole Vintage Pastel
-- family (Neon Arcade's light polarity covers the same ground) plus XP Gold
-- (Neon Arcade) and Champagne (Noir). See src/index.css / useTheme.js.
--
-- Backfill BEFORE narrowing the constraint, or the new check fails on any
-- existing row. Each retired id moves to its closest remaining match by hue
-- (product decision, 2026-09-29), and theme_polarity is left untouched --
-- every Neon Arcade target has both renderings, so a Vintage Pastel user
-- keeps their light/dark choice; Stellar Gold is fixed-polarity and ignores
-- it. Free stays free (mint-fizz -> power-up); Pro ids map to Pro ids. This
-- runs as postgres, which profiles_lock_columns() already exempts, so the
-- Pro-lock doesn't block moving a lapsed-Pro user between two Pro themes.

update profiles set theme = case theme
  when 'mint-fizz'        then 'power-up'
  when 'strawberry-cream' then 'boss-fight'
  when 'blue-raspberry'   then 'plasma'
  when 'lemon-pop'        then 'power-up'   -- Neon Arcade has no yellow once XP Gold goes
  when 'peach-soda'       then 'boss-fight'
  when 'grape-float'      then 'synthwave'
  when 'xp-gold'          then 'stellar-gold'
  when 'champagne'        then 'stellar-gold'
end
where theme in (
  'mint-fizz', 'strawberry-cream', 'blue-raspberry', 'lemon-pop', 'peach-soda', 'grape-float',
  'xp-gold', 'champagne'
);

alter table profiles drop constraint profiles_theme_valid;

alter table profiles add constraint profiles_theme_valid check (
  theme in (
    -- Neon Arcade
    'power-up', 'cyberpunk', 'plasma', 'boss-fight', 'synthwave',
    -- Cosmic
    'moonlight', 'nebula', 'solar-flare', 'aurora', 'deep-space', 'stellar-gold',
    -- Botanical
    'sage', 'forest', 'fern', 'moss', 'terracotta', 'meadow',
    -- Noir
    'carbon', 'crimson', 'amethyst', 'sapphire', 'emerald',
    -- Candy
    'bubblegum', 'blue-pop', 'grape-candy', 'orange-crush', 'sour-apple', 'cherry-pop'
  )
);

-- Only the free-id list in the Pro-lock branch changes ('mint-fizz' drops
-- out with its family); every other branch is copied unchanged from
-- 20260928120000's definition. Stays SECURITY INVOKER (the default) so
-- current_user reflects the real caller -- see CLAUDE.md.
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
      and new.theme not in ('power-up', 'moonlight', 'sage', 'carbon', 'bubblegum') then
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
