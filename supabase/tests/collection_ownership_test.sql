-- Ownership boundary on the two mutating collection RPCs a client calls
-- directly: toggle_favourite() and delete_collection_entry()
-- (20260815120100_security.sql / 20260903000001_replace_auth_uid_in_sippd_rpc_functions.sql
-- and 20260924000000_add_delete_collection_entry.sql).
--
-- Both run SECURITY DEFINER as sippd_rpc, which carries BYPASSRLS — so the
-- table's own RLS policies do NOT protect another user's row from these two
-- functions the way they would from a plain client query. The only thing
-- stopping "stranger calls toggle_favourite() with someone else's
-- collection_id" is the explicit ownership check inside each function body.
-- This file is the regression check for that check, plus the caller_id
-- spoofing guard every mutating RPC in this schema shares.
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
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'owner@sippd.test',    'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'stranger@sippd.test', 'x', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into shared_cans (id, name, brand) values
  ('a0000000-0000-0000-0000-000000000001', 'Owned Can', 'TestBrand');

insert into user_collection (id, owner_id, can_id) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001');

-- ── As the stranger ────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select throws_like(
  $$select toggle_favourite('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000001')$$,
  '%not your collection item%',
  'a stranger cannot toggle favourite on another user''s collection entry'
);

select throws_like(
  $$select delete_collection_entry('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000001')$$,
  '%entry not found%',
  'a stranger cannot delete another user''s collection entry (it simply isn''t theirs to find)'
);

select throws_like(
  $$select toggle_favourite('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001')$$,
  '%caller mismatch%',
  'a caller cannot spoof p_caller_id as someone else while authenticated as themselves'
);

reset role;

-- ── As the real owner ──────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select toggle_favourite('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001')$$,
  'the real owner can toggle favourite on their own collection entry'
);

select is(
  (select is_favourite from user_collection where id = 'b0000000-0000-0000-0000-000000000001'),
  true,
  'the toggle actually flipped is_favourite for the owner'
);

select lives_ok(
  $$select delete_collection_entry('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001')$$,
  'the real owner can delete their own collection entry'
);

select is(
  (select count(*) from user_collection where id = 'b0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'the entry is actually gone after the owner deletes it'
);

reset role;

select * from finish();
rollback;
