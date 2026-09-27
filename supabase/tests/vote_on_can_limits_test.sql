-- vote_on_can()'s free-tier daily barcode-scan limit (10/day — added in
-- 20260901000000_add_pro_subscription.sql) and its caller_id spoofing
-- guard. This is the RPC every scan in the app goes through, and the daily
-- cap is a real product limit (the free/Pro split), not just a privacy
-- boundary — worth its own regression check separate from the ownership
-- checks in collection_ownership_test.sql, since a silent regression here
-- would let a free user scan unlimited cans for free rather than leak data.
--
-- Runs via `supabase test db` against a disposable local Postgres — never
-- the linked project.

begin;
select no_plan();

-- ── Fixtures ─────────────────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'free-scanner@sippd.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'pro-scanner@sippd.test',  'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

update profiles set subscription_status = 'pro', pro_expires_at = now() + interval '30 days'
where id = '22222222-2222-2222-2222-222222222222';

-- ── Caller mismatch (as the free user, spoofing the Pro user's id) ────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_like(
  $$select vote_on_can('22222222-2222-2222-2222-222222222222', null, 'Common'::rarity_tier, 'Spoofed Can', 'TestBrand', null, null, null, 'BARCODE-SPOOF-1')$$,
  '%caller mismatch%',
  'a caller cannot spoof p_caller_id on vote_on_can as someone else'
);

-- ── Use up the free user's daily scan quota (10/day) ──────────────────────
do $$
declare
  i integer;
begin
  for i in 1..10 loop
    perform vote_on_can(
      '11111111-1111-1111-1111-111111111111'::uuid,
      null,
      'Common'::rarity_tier,
      'Free Scan Can ' || i,
      'TestBrand',
      null, null, null,
      'BARCODE-FREE-' || i
    );
  end loop;
end;
$$;

select throws_like(
  $$select vote_on_can('11111111-1111-1111-1111-111111111111', null, 'Common'::rarity_tier, 'Free Scan Can 11', 'TestBrand', null, null, null, 'BARCODE-FREE-11')$$,
  '%daily_scan_limit_reached%',
  'a free user is blocked after 10 barcode scans in 24 hours'
);

reset role;

-- ── The Pro user is not subject to the same cap ───────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

do $$
declare
  i integer;
begin
  for i in 1..10 loop
    perform vote_on_can(
      '22222222-2222-2222-2222-222222222222'::uuid,
      null,
      'Common'::rarity_tier,
      'Pro Scan Can ' || i,
      'TestBrand',
      null, null, null,
      'BARCODE-PRO-' || i
    );
  end loop;
end;
$$;

select lives_ok(
  $$select vote_on_can('22222222-2222-2222-2222-222222222222', null, 'Common'::rarity_tier, 'Pro Scan Can 11', 'TestBrand', null, null, null, 'BARCODE-PRO-11')$$,
  'a Pro user is not blocked by the free-tier daily scan cap'
);

reset role;

select * from finish();
rollback;
