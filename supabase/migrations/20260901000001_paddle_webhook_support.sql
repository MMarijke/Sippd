-- Support for the Paddle webhook handler (supabase/functions/paddle-webhook):
-- an idempotency/audit log for incoming events, and the one fix the webhook
-- concretely needs in order to write to profiles at all — see below.

-- ── paddle_events: raw webhook log, idempotency + audit trail ──────────────
-- Mirrors Strk's paddle_events table. Service-role only: RLS enabled with
-- no policies at all, so a regular authenticated user gets zero access.
create table public.paddle_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.paddle_events enable row level security;

-- ── profiles_lock_columns(): allow service_role, not just sippd_rpc/postgres ─
-- Concretely required for the webhook to work at all: it authenticates with
-- SUPABASE_SERVICE_ROLE_KEY, which PostgREST maps to current_user =
-- 'service_role' — a real, distinct Postgres role from both 'sippd_rpc' and
-- 'postgres'. Triggers always fire regardless of BYPASSRLS (RLS bypass and
-- trigger execution are independent mechanisms — service_role skips RLS
-- policies, not this trigger), so without this every webhook write is
-- rejected with "subscription_status is not client-writable". This was the
-- gap flagged (and knowingly accepted) in 20260901000000_add_pro_subscription.sql;
-- it's load-bearing now that the code writing these columns actually exists.
create or replace function profiles_lock_columns()
returns trigger
language plpgsql
security invoker
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
  end if;
  return new;
end;
$$;
