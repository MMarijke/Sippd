-- Regression check for 20261020000000_lock_public_profiles_view.sql:
-- the public_profiles view is read-only for clients, and the trigger-only
-- leaderboard sync can't be called by them. Runs via `supabase test db`
-- against a disposable local database; everything is rolled back.

begin;
select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
  'victim@sippd.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);
update profiles set full_name = 'Original Name' where id = '33333333-3333-3333-3333-333333333333';

-- A private collector with a live streak (as postgres, which the lock
-- trigger exempts), for the privacy checks below.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated',
  'private@sippd.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);
update profiles
set full_name = 'Private Collector', is_private = true, current_streak = 12,
    last_active_date = (now() at time zone 'utc')::date
where id = '55555555-5555-5555-5555-555555555555';

-- ── As anon (only the public key) ────────────────────────────────────────
set local role anon;

-- Since 20261026000000: signed-out callers read one profile by id through
-- get_public_profile(), not the view itself.
select is(
  (select full_name from public.get_public_profile('33333333-3333-3333-3333-333333333333')),
  'Original Name',
  'anon can read one profile by id (public profile page, link preview, OG image)'
);

select throws_ok(
  $$select count(*) from public.public_profiles$$,
  '42501', null, 'anon cannot list every profile through public_profiles'
);

select throws_ok(
  $$update public.public_profiles set full_name = 'Hacked' where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'anon cannot rename a user through public_profiles'
);

select throws_ok(
  $$delete from public.public_profiles where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'anon cannot delete a profile through public_profiles'
);

select throws_ok(
  $$insert into public.public_profiles (id, full_name) values (gen_random_uuid(), 'Fake')$$,
  '42501', null, 'anon cannot insert a profile through public_profiles'
);

select throws_ok(
  $$select public.sync_leaderboard_for_user('33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'anon cannot call the trigger-only sync_leaderboard_for_user'
);

select throws_ok(
  $$select * from public.get_category_leaderboard('energy_drink')$$,
  '42501', null, 'anon cannot read the category leaderboard'
);

reset role;

-- ── As another signed-in user ────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select throws_ok(
  $$update public.public_profiles set full_name = 'Hacked' where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', null, 'a signed-in user cannot rename someone else through public_profiles'
);

-- Private profile, seen by a signed-in non-follower: findable by name (to
-- request a follow), but streak and join date hidden.
select is(
  (select full_name from public.public_profiles where id = '55555555-5555-5555-5555-555555555555'),
  'Private Collector',
  'a private collector is still findable by name when signed in'
);
select ok(
  (select current_streak is null and created_at is null from public.public_profiles where id = '55555555-5555-5555-5555-555555555555'),
  'a non-follower does not see a private collector''s streak or join date'
);

reset role;

-- The private collector themself sees their own streak and join date.
set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select ok(
  (select current_streak = 12 and created_at is not null from public.public_profiles where id = '55555555-5555-5555-5555-555555555555'),
  'a private collector sees their own streak and join date'
);
reset role;

-- And signed out, through get_public_profile, they stay hidden.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select ok(
  (select current_streak is null and created_at is null from public.get_public_profile('55555555-5555-5555-5555-555555555555')),
  'signed out, a private collector''s streak and join date stay hidden'
);
reset role;

select is(
  (select full_name from profiles where id = '33333333-3333-3333-3333-333333333333'),
  'Original Name',
  'the victim''s name is unchanged'
);

select * from finish();
rollback;
