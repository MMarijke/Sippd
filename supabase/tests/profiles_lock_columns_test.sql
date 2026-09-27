-- Column-level protection for billing/plan state.
--
-- RLS (profiles_update_own) lets a user UPDATE their own profiles row —
-- that's correct and intended. The thing that actually stops that same
-- user from writing role/subscription_status/paddle_*/pro_expires_at/a
-- Pro-locked theme directly is profiles_lock_columns() (first added in
-- 20260815120100_security.sql, extended in 20260901000000_add_pro_subscription.sql,
-- 20260909000000_add_profile_theme.sql, 20260926000000_add_theme_families.sql,
-- and 20260927000000_replace_theme_catalogue_phase1.sql).
-- This is exactly the gap this project's own CLAUDE.md calls out ("RLS only
-- restricts which rows a user can touch, not which columns") — this file is
-- the regression check that the trigger still closes it after every future
-- migration touching profiles, not a one-time manual verification.
--
-- Runs via `supabase test db` against a disposable local Postgres seeded
-- from the real migration files (Docker-backed, spun up fresh per run) —
-- never against the linked project. Every row here is rolled back at the
-- end regardless of pass/fail.

begin;
select no_plan();

-- ── Fixtures ─────────────────────────────────────────────────────────────
-- handle_new_user() (20260815120100_security.sql) fires on insert into
-- auth.users and creates the matching profiles row automatically.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'free-user@sippd.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'pro-user@sippd.test',  'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

-- Grant Pro the only way this trigger allows outside a real Paddle webhook:
-- as postgres, which profiles_lock_columns() exempts.
update profiles set subscription_status = 'pro', pro_expires_at = now() + interval '30 days'
where id = '22222222-2222-2222-2222-222222222222';

-- ── As the free user (authenticated — RLS and the trigger both apply) ────
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_like(
  $$update profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111'$$,
  '%role is not client-writable%',
  'free user cannot self-promote role to admin'
);

select throws_like(
  $$update profiles set current_streak = 999 where id = '11111111-1111-1111-1111-111111111111'$$,
  '%current_streak is not client-writable%',
  'free user cannot spoof current_streak'
);

select throws_like(
  $$update profiles set subscription_status = 'pro' where id = '11111111-1111-1111-1111-111111111111'$$,
  '%subscription_status is not client-writable%',
  'free user cannot self-upgrade subscription_status via a plain UPDATE'
);

select throws_like(
  $$update profiles set paddle_customer_id = 'cus_fake' where id = '11111111-1111-1111-1111-111111111111'$$,
  '%paddle_customer_id is not client-writable%',
  'free user cannot forge paddle_customer_id'
);

select throws_like(
  $$update profiles set pro_expires_at = now() + interval '1 year' where id = '11111111-1111-1111-1111-111111111111'$$,
  '%pro_expires_at is not client-writable%',
  'free user cannot extend their own pro_expires_at'
);

select throws_like(
  $$update profiles set theme = 'cyberpunk' where id = '11111111-1111-1111-1111-111111111111'$$,
  '%theme is Pro-only%',
  'free user is blocked from a Pro-locked theme'
);

select lives_ok(
  $$update profiles set theme = 'mint-fizz' where id = '11111111-1111-1111-1111-111111111111'$$,
  'free user can still switch between free themes (power-up / mint-fizz)'
);

reset role;

-- ── As the Pro user (authenticated) ──────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select lives_ok(
  $$update profiles set theme = 'cyberpunk' where id = '22222222-2222-2222-2222-222222222222'$$,
  'Pro user can switch to a Pro-locked theme'
);

reset role;

-- ── As service_role (the Paddle webhook's real identity) ─────────────────
-- profiles_lock_columns() explicitly exempts service_role so the actual
-- webhook — not a client — can flip subscription_status when a payment
-- event comes in.
set local role service_role;

select lives_ok(
  $$update profiles set subscription_status = 'cancelled' where id = '22222222-2222-2222-2222-222222222222'$$,
  'service_role (the webhook''s identity) can write subscription_status'
);

reset role;

select * from finish();
rollback;
