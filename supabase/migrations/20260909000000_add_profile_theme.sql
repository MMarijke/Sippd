-- Adds a Pro-gated theme column to profiles. Free users stay on 'cyan'
-- (the app's existing look, unchanged); the 5 rarity-tier themes are a Pro
-- perk. Column-level protection follows the same pattern already in place
-- for subscription_status/pro_expires_at/etc on this table: a plain client
-- UPDATE cannot set theme to anything but 'cyan' unless the row's own
-- (already trigger-protected) subscription state says the user is Pro at
-- write time — the same guarantee is_pro() checks, just done RPC-free from
-- the trigger since NEW/OLD.subscription_status and pro_expires_at can't
-- change in the same statement that only sets theme.

alter table profiles
  add column theme text not null default 'cyan';

alter table profiles
  add constraint profiles_theme_valid check (
    theme in ('cyan', 'common', 'uncommon', 'rare', 'ultra', 'legendary')
  );

create or replace function public.profiles_lock_columns()
returns trigger
language plpgsql
as $function$
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
    if new.theme is distinct from old.theme and new.theme <> 'cyan' then
      if not (
        old.subscription_status = 'pro'
        and (old.pro_expires_at is null or old.pro_expires_at > now())
      ) then
        raise exception 'theme is Pro-only — upgrade to unlock';
      end if;
    end if;
  end if;
  return new;
end;
$function$;
