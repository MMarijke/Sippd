-- Security fix (backend audit, 2026-10-20). Additive only: revokes and
-- per-function settings, no data touched.
--
-- 1. public_profiles: anyone could write to every user's profile.
--    The view is a plain SELECT over profiles, so Postgres treats it as
--    auto-updatable; it's owned by postgres (BYPASSRLS) and isn't
--    security_invoker, so writes through it skip profiles' RLS entirely;
--    and Supabase's default grants gave anon and authenticated INSERT /
--    UPDATE / DELETE on it. Verified live with a rolled-back probe as anon
--    against a nonexistent id: UPDATE and DELETE were permitted. So with
--    only the public anon key, anyone could rename any user, flip
--    is_private, delete profiles, or insert rows. profiles_lock_columns
--    didn't help: the view only exposes columns it doesn't lock.
--    Reading stays: middleware.js, api/og and PublicProfile read it as anon.
revoke insert, update, delete, truncate, references, trigger
  on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

-- 2. sync_leaderboard_for_user(uid) is only meant to run from the
--    user_collection trigger (trigger_sync_leaderboard, SECURITY DEFINER,
--    owned by sippd_rpc, which keeps EXECUTE as the function's owner). It
--    has no caller check, and anon could call it with any uid to make it
--    write a leaderboard row. The client never calls it.
revoke execute on function public.sync_leaderboard_for_user(uuid) from public, anon, authenticated;

-- 3. get_category_leaderboard returns every collector's name and counts;
--    the leaderboard page is behind ProtectedRoute, so signed-in only.
--    (get_pro_status stays open: PublicProfile and SharedCrate show Pro
--    badges to signed-out visitors.)
revoke execute on function public.get_category_leaderboard(beverage_type) from public, anon;
grant execute on function public.get_category_leaderboard(beverage_type) to authenticated;

-- 4. Pin search_path on the remaining SECURITY INVOKER functions (Supabase
--    linter: function_search_path_mutable). Low risk today, since anon and
--    authenticated can't create objects in public, but it removes the
--    class of bug.
alter function public.activity_items_lock_reaction_counts() set search_path = public;
alter function public.compute_confidence(integer) set search_path = public;
alter function public.compute_consensus_rarity(integer, integer, integer, integer, integer) set search_path = public;
alter function public.notifications_lock_status_columns() set search_path = public;
alter function public.profiles_lock_columns() set search_path = public;
alter function public.shared_cans_lock_columns() set search_path = public;
alter function public.sippd_auth_uid() set search_path = public;
alter function public.user_collection_lock_columns() set search_path = public;
