-- Phase 1 of the public-profile migration (see chat/report for the full
-- plan): PublicProfile.jsx (src/pages/PublicProfile.jsx) already renders a
-- full read-only profile at /u/:userId, but two RLS gaps make it silently
-- empty for anyone but the profile's own owner, and its route is nested
-- under <ProtectedRoute>, which blocks logged-out visitors before this
-- page ever mounts (that half of the fix is a frontend change, not this
-- migration). This migration is the backend half: it does not touch
-- ProtectedRoute or App.jsx routing.
--
-- Decision on record: logged-out (anon) visitors must be able to open a
-- shared profile link, not just other signed-in Sippd users — so every
-- grant below is deliberately extended to `anon`, not just `authenticated`.

-- ── get_public_collection ────────────────────────────────────────────────────
--
-- user_collection's only SELECT policy is
-- user_collection_select_own (owner_id = auth.uid()), added in
-- 20260815120100_security.sql. There is no exception for "profile is
-- public" or "viewer is an accepted follower" — a different user's
-- profile page today queries this table directly and RLS silently
-- returns zero rows. Rather than widen a blanket table policy (which
-- would make the privacy/follow rule harder to find next to the four
-- existing owner-only policies), this follows this codebase's own
-- established pattern from 20260903000001_replace_auth_uid_in_sippd_rpc_functions.sql:
-- a single SECURITY DEFINER RPC, owned by sippd_rpc (already granted
-- select/insert/update/delete on user_collection, profiles, and follows
-- in 20260819120000_grant_sippd_rpc_table_access.sql, and confirmed to
-- carry BYPASSRLS per that migration's own comment), so the function body
-- is the one place this access rule lives.
--
-- p_caller_id is an explicit first parameter, not an auth.uid() read
-- buried in the body, matching every other SECURITY DEFINER RPC in this
-- schema (vote_on_can, toggle_favourite, request_follow, ...). Unlike
-- those, this function must also serve anonymous callers (Decision 1), so
-- it does not raise on a null caller the way the mutation RPCs do —
-- sippd_auth_uid() already returns null for a request with no JWT, so an
-- anon call naturally passes p_caller_id: null, matches v_caller: null,
-- and every owner/follower check below evaluates to false for it,
-- leaving only genuinely public (not is_private) profiles visible. A
-- logged-in caller who lies about p_caller_id still gets caught by the
-- same mismatch check every other RPC here uses.
create or replace function get_public_collection(p_caller_id uuid, p_profile_id uuid)
returns setof user_collection
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_caller uuid := sippd_auth_uid();
begin
  if p_caller_id is distinct from v_caller then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_caller;
  end if;

  return query
  select uc.* from user_collection uc
  where uc.owner_id = p_profile_id
    and (
      -- profile is public
      not exists (select 1 from profiles pr where pr.id = p_profile_id and pr.is_private)
      -- or the caller is the profile's own owner
      or p_profile_id = v_caller
      -- or the caller is an accepted follower
      or exists (
        select 1 from follows f
        where f.follower_id = v_caller and f.following_id = p_profile_id and f.status = 'accepted'
      )
    );
end;
$$;

alter function get_public_collection(uuid, uuid) owner to sippd_rpc;
grant execute on function get_public_collection(uuid, uuid) to authenticated, anon;

-- ── public_profiles ───────────────────────────────────────────────────────────
--
-- Two independent gaps in the existing view (created in
-- 20260815120100_security.sql): it's granted to `authenticated` only, so
-- an anon visitor can't resolve even a display name or the is_private
-- flag; and PublicProfile.jsx already reads profileUser?.current_streak
-- and profileUser?.created_at, both silently undefined today since the
-- view never selected them. Both are safe to expose alongside the
-- existing id/full_name/is_private — same non-sensitive shape as
-- created_at elsewhere, and current_streak is a gamification number the
-- UI already treats as public (it's shown on the same card as the
-- collection itself).
create or replace view public_profiles as
select id, full_name, is_private, current_streak, created_at
from profiles;

grant select on public_profiles to authenticated, anon;

-- ── shared_cans ───────────────────────────────────────────────────────────────
--
-- shared_cans_select_all (20260815120100_security.sql) already reads
-- `using (true)` — every row, no ownership check — it was just scoped to
-- `authenticated` only, which blocked an anon visitor from resolving
-- rarity-consensus data for cans on someone else's public collection.
-- Widening the existing policy's role list (not adding a second,
-- easy-to-miss policy with the identical `using (true)`) for one rule to
-- audit instead of two saying the same thing.
alter policy shared_cans_select_all on shared_cans to authenticated, anon;
