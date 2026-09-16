-- profiles_lock_columns()'s theme guard used `old.subscription_status = 'pro'`
-- instead of an IS DISTINCT FROM-safe comparison — the exact anti-pattern
-- this repo's own CLAUDE.md calls out by name ("Compare with IS DISTINCT
-- FROM, not !=/=" — auth.role()/a NULL column against `=` is NULL, which is
-- falsy in `IF` and silently allows the update). If subscription_status
-- were ever NULL, `old.subscription_status = 'pro'` evaluates to NULL,
-- `not (NULL and ...)` is NULL, and `if NULL then raise` does not raise --
-- fail OPEN, letting a non-Pro user set a Pro-only theme. Not currently
-- exploitable (nothing ever sets that column to NULL — it defaults to
-- 'free' and every write path only ever sets 'pro'/'cancelled'), but it's a
-- landmine for the next migration that touches subscription_status. Rebuilt
-- as a direct "raise if not pro" condition using IS DISTINCT FROM, which is
-- NULL-safe and fails CLOSED. Rest of the function body (and the
-- `service_role` exemption added since the original version) is unchanged
-- from the current definition (20260909000000_add_profile_theme.sql).

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
    if new.theme is distinct from old.theme and new.theme <> 'cyan' then
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
