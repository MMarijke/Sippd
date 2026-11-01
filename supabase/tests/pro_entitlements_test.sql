-- Pro entitlements, server side: who counts as Pro, and the limits that
-- depend on it. The client's isPro is a UI hint only; these are the checks
-- that actually stop a free account from getting Pro perks.
--
--   is_pro(uid)            20260901000000_add_pro_subscription.sql,
--                          caller guard in 20260914000001_guard_is_pro_caller.sql
--   get_pro_status(uuid[]) 20260917000000_add_get_pro_status.sql
--   crate limits           enforce_crate_limits / enforce_crate_can_limit
--   Pro themes             profiles_lock_columns (20261027000000_retire_essentials.sql)
--
-- The rule everywhere: Pro = subscription_status 'pro' AND (pro_expires_at
-- is null OR in the future). A scheduled cancellation keeps 'pro' with an
-- expiry (paddle-webhook, subscription.updated), so an expired 'pro' row
-- must already count as free, before subscription.canceled arrives.
--
-- Runs via `supabase test db` against a disposable local Postgres seeded
-- from the real migration files, never against the linked project. Every
-- row is rolled back at the end.

begin;
select no_plan();

-- ── Fixtures ─────────────────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, 'x', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111', 'free@sippd.test'),
  ('22222222-2222-2222-2222-222222222222', 'pro@sippd.test'),
  ('33333333-3333-3333-3333-333333333333', 'pro-ending@sippd.test'),
  ('44444444-4444-4444-4444-444444444444', 'pro-expired@sippd.test'),
  ('55555555-5555-5555-5555-555555555555', 'cancelled@sippd.test')
) as u(id, email);

-- As postgres (exempt from profiles_lock_columns), the way the webhook's
-- service_role would set them.
update profiles set subscription_status = 'pro', pro_expires_at = null
  where id = '22222222-2222-2222-2222-222222222222';
update profiles set subscription_status = 'pro', pro_expires_at = now() + interval '10 days'
  where id = '33333333-3333-3333-3333-333333333333';
update profiles set subscription_status = 'pro', pro_expires_at = now() - interval '1 minute'
  where id = '44444444-4444-4444-4444-444444444444';
update profiles set subscription_status = 'cancelled', pro_expires_at = now() - interval '1 day'
  where id = '55555555-5555-5555-5555-555555555555';

-- ── is_pro (as postgres, which the caller guard allows) ──────────────────
select is(is_pro('11111111-1111-1111-1111-111111111111'), false, 'free account is not Pro');
select is(is_pro('22222222-2222-2222-2222-222222222222'), true,  'Pro with no expiry is Pro');
select is(is_pro('33333333-3333-3333-3333-333333333333'), true,  'Pro with a scheduled cancellation is Pro until it ends');
select is(is_pro('44444444-4444-4444-4444-444444444444'), false, 'Pro whose scheduled cancellation has passed is not Pro, even before subscription.canceled arrives');
select is(is_pro('55555555-5555-5555-5555-555555555555'), false, 'cancelled account is not Pro');
select is(is_pro('99999999-9999-9999-9999-999999999999'), false, 'unknown user is not Pro (not null, not an error)');

-- ── get_pro_status (public: drives the Pro badge) ────────────────────────
set local role anon;
select results_eq(
  $$select user_id::text, is_pro from get_pro_status(array[
      '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555']::uuid[]) order by user_id$$,
  $$values ('11111111-1111-1111-1111-111111111111', false), ('22222222-2222-2222-2222-222222222222', true),
           ('33333333-3333-3333-3333-333333333333', true),  ('44444444-4444-4444-4444-444444444444', false),
           ('55555555-5555-5555-5555-555555555555', false)$$,
  'get_pro_status agrees with is_pro, expiry included (no badge for a lapsed subscriber)'
);
reset role;

-- ── Free account ─────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_like(
  $$select is_pro('22222222-2222-2222-2222-222222222222')$$,
  '%only be checked for your own account%',
  'is_pro cannot be used to probe someone else''s subscription'
);
select is(is_pro('11111111-1111-1111-1111-111111111111'), false, 'a free user can check their own status');

select lives_ok(
  $$insert into crates (owner_id, name) select '11111111-1111-1111-1111-111111111111', 'Free ' || g from generate_series(1, 5) g$$,
  'free account can create 5 crates'
);
select throws_like(
  $$insert into crates (owner_id, name) values ('11111111-1111-1111-1111-111111111111', 'Free 6')$$,
  '%crate_limit_reached%',
  'free account cannot create a 6th crate'
);

select throws_like(
  $$update crates set can_ids = array(select gen_random_uuid() from generate_series(1, 11))
    where owner_id = '11111111-1111-1111-1111-111111111111' and name = 'Free 1'$$,
  '%crate_can_limit_reached%',
  'free account cannot put an 11th can in a crate'
);
select lives_ok(
  $$update crates set can_ids = array(select gen_random_uuid() from generate_series(1, 10))
    where owner_id = '11111111-1111-1111-1111-111111111111' and name = 'Free 1'$$,
  'free account can fill a crate to 10 cans'
);

-- The app always inserts crates empty, but the API doesn't have to: the
-- per-crate limit must hold on insert too, not only on update.
select lives_ok(
  $$delete from crates where owner_id = '11111111-1111-1111-1111-111111111111' and name = 'Free 5'$$,
  'free account can delete a crate (back to 4)'
);
select throws_like(
  $$insert into crates (owner_id, name, can_ids)
    values ('11111111-1111-1111-1111-111111111111', 'Stuffed', array(select gen_random_uuid() from generate_series(1, 11)))$$,
  '%crate_can_limit_reached%',
  'free account cannot insert a crate that already holds 11 cans'
);

select throws_like(
  $$update profiles set theme = 'cyberpunk' where id = '11111111-1111-1111-1111-111111111111'$$,
  '%theme is Pro-only%',
  'free account cannot pick a Pro theme'
);
reset role;

-- ── Pro account ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select lives_ok(
  $$insert into crates (owner_id, name) select '22222222-2222-2222-2222-222222222222', 'Pro ' || g from generate_series(1, 8) g$$,
  'Pro account can create more than 5 crates'
);
select lives_ok(
  $$update crates set can_ids = array(select gen_random_uuid() from generate_series(1, 25))
    where owner_id = '22222222-2222-2222-2222-222222222222' and name = 'Pro 1'$$,
  'Pro account can put more than 10 cans in a crate'
);
reset role;

-- ── Pro account whose cancellation is scheduled (still Pro) ──────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select lives_ok(
  $$update profiles set theme = 'cyberpunk' where id = '33333333-3333-3333-3333-333333333333'$$,
  'Pro with a scheduled cancellation keeps Pro themes until it ends'
);
select throws_like(
  $$update profiles set pro_expires_at = null where id = '33333333-3333-3333-3333-333333333333'$$,
  '%pro_expires_at is not client-writable%',
  'a cancelling subscriber cannot clear their own expiry to keep Pro'
);
reset role;

-- ── Pro account whose period has ended (not yet marked cancelled) ────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select is(is_pro('44444444-4444-4444-4444-444444444444'), false, 'an expired subscriber sees themselves as not Pro');
select lives_ok(
  $$insert into crates (owner_id, name) select '44444444-4444-4444-4444-444444444444', 'Lapsed ' || g from generate_series(1, 5) g$$,
  'expired subscriber can still create up to the free 5'
);
select throws_like(
  $$insert into crates (owner_id, name) values ('44444444-4444-4444-4444-444444444444', 'Lapsed 6')$$,
  '%crate_limit_reached%',
  'expired subscriber is back on the free crate limit'
);
select throws_like(
  $$update profiles set theme = 'cyberpunk' where id = '44444444-4444-4444-4444-444444444444'$$,
  '%theme is Pro-only%',
  'expired subscriber cannot pick a Pro theme'
);
reset role;

-- ── Lapsed users keep what they have ─────────────────────────────────────
-- Crates made while Pro aren't deleted or truncated when Pro ends; only new
-- crates and growing a crate past 10 are blocked.
update profiles set subscription_status = 'cancelled', pro_expires_at = now() - interval '1 second'
  where id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is(
  (select count(*)::int from crates where owner_id = '22222222-2222-2222-2222-222222222222'),
  8,
  'a subscriber who cancels keeps every crate they made'
);
select lives_ok(
  $$update crates set name = 'Renamed' where owner_id = '22222222-2222-2222-2222-222222222222' and name = 'Pro 1'$$,
  'and can still rename an oversized crate (its can count is unchanged)'
);
select lives_ok(
  $$update crates set can_ids = can_ids[1:24] where owner_id = '22222222-2222-2222-2222-222222222222' and name = 'Renamed'$$,
  'and can remove cans from it one at a time (shrinking is never blocked)'
);
select throws_like(
  $$update crates set can_ids = can_ids || gen_random_uuid() where owner_id = '22222222-2222-2222-2222-222222222222' and name = 'Renamed'$$,
  '%crate_can_limit_reached%',
  'but cannot add to it while over the free limit'
);
reset role;

select * from finish();
rollback;
