-- Account deletion anonymises the deleted person's name where it was
-- copied into other rows (20261004000000_anonymise_names_on_account_deletion.sql):
-- other users' notifications, and the contributor name on cans they added.
--
-- Runs via `supabase test db` against a disposable local Postgres seeded
-- from the real migration files, never against the linked project. Every
-- row here is rolled back at the end regardless of pass/fail.

begin;
select plan(4);

-- ── Fixtures (as postgres: triggers that guard client writes exempt it) ──
-- handle_new_user() creates each profiles row from auth.users.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'leaver@sippd.test',   'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'stayer@sippd.test',   'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'namesake@sippd.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

-- The leaver and an unrelated collector share a display name.
update profiles set full_name = 'Alex Doe' where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003');

-- A can each of them added (adding a can always casts the adder's vote).
insert into shared_cans (id, name, brand, contributed_by) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Leaver Can',   'Brand', 'Alex Doe'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Namesake Can', 'Brand', 'Alex Doe');
insert into rarity_votes (can_id, voter_id, voted_rarity) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Common'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', 'Common');

-- The leaver followed the stayer, so the stayer has a notification naming them.
insert into notifications (recipient_id, type, actor_id, actor_name) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'new_follower', 'aaaaaaaa-0000-0000-0000-000000000001', 'Alex Doe');

-- ── Delete the leaver's account the way delete-account does ──────────────
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select is(
  (select actor_name from notifications where recipient_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'A former collector',
  'other users'' notifications no longer name the deleted person'
);

select is(
  (select actor_id from notifications where recipient_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  null::uuid,
  'and no longer point at their (deleted) profile'
);

select is(
  (select contributed_by from shared_cans where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  null,
  'the deleted person''s name is cleared from a can they added'
);

select is(
  (select contributed_by from shared_cans where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'Alex Doe',
  'a different collector with the same display name keeps theirs'
);

select * from finish();
rollback;
