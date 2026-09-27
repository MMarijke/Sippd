-- Cross-account collection privacy: get_public_collection()
-- (20260912000000_public_profile_collection_access.sql).
--
-- user_collection's only table-level RLS policy is owner-only
-- (user_collection_select_own), so PublicProfile.jsx cannot read a
-- different user's rows directly — get_public_collection() is the single
-- SECURITY DEFINER RPC that's allowed to widen that on the app's behalf,
-- and it must widen it exactly as far as the privacy model intends: public
-- profiles open to anyone (including a logged-out visitor), private
-- profiles open only to their owner and accepted followers, and never to a
-- stranger or a merely-pending follower. This file checks both directions
-- of that boundary, not just the "private stays private" half.
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
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'private-owner@sippd.test',  'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'public-owner@sippd.test',   'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'stranger@sippd.test',       'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'accepted-follower@sippd.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'pending-follower@sippd.test',  'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

update profiles set is_private = true  where id = '11111111-1111-1111-1111-111111111111';
update profiles set is_private = false where id = '22222222-2222-2222-2222-222222222222';

insert into follows (follower_id, following_id, status) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'accepted'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'pending');

insert into shared_cans (id, name, brand) values
  ('a0000000-0000-0000-0000-000000000001', 'Private Owner Can', 'TestBrand'),
  ('a0000000-0000-0000-0000-000000000002', 'Public Owner Can',  'TestBrand');

insert into user_collection (owner_id, can_id) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000002');

-- ── As a stranger (authenticated, no relationship to either owner) ───────
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select is(
  (select count(*) from get_public_collection('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111')),
  0::bigint,
  'a stranger sees zero rows of a private profile''s collection'
);

select is(
  (select count(*) from get_public_collection('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222')),
  1::bigint,
  'a stranger CAN see a public profile''s collection (the boundary works both ways, not just "private blocks")'
);

select throws_like(
  $$select * from get_public_collection('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111')$$,
  '%caller mismatch%',
  'a caller cannot spoof p_caller_id as someone else''s id'
);

reset role;

-- ── As the private profile's own owner ────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(
  (select count(*) from get_public_collection('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111')),
  1::bigint,
  'the owner can always see their own private collection'
);

reset role;

-- ── As an accepted follower of the private profile ───────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select is(
  (select count(*) from get_public_collection('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111')),
  1::bigint,
  'an accepted follower can see a private profile''s collection'
);

reset role;

-- ── As a merely-pending (not yet accepted) follower ──────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);

select is(
  (select count(*) from get_public_collection('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111')),
  0::bigint,
  'a pending (not yet accepted) follow request grants no access'
);

reset role;

-- ── As an anonymous (logged-out) visitor ─────────────────────────────────
-- get_public_collection() is deliberately granted to anon too (Decision 1
-- in 20260912000000_public_profile_collection_access.sql), since a shared
-- profile link must work for a logged-out visitor.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*) from get_public_collection(null, '11111111-1111-1111-1111-111111111111')),
  0::bigint,
  'a logged-out visitor sees zero rows of a private profile''s collection'
);

select is(
  (select count(*) from get_public_collection(null, '22222222-2222-2222-2222-222222222222')),
  1::bigint,
  'a logged-out visitor CAN see a public profile''s collection'
);

reset role;

select * from finish();
rollback;
