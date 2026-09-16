-- Trophy Case: a visible Pro badge next to a user's name wherever it
-- renders cross-user (Feed, Leaderboard, Search, Public Profile). This is a
-- deliberate policy reversal from 20260914000001_guard_is_pro_caller.sql,
-- which locked is_pro(uid) down specifically because it let any client
-- check ANOTHER user's Pro status -- treated as private billing-adjacent
-- info at the time. A visible badge is the opposite choice, made on
-- purpose: once it ships, Pro status is intentionally public everywhere a
-- name renders, the same way a Discord Nitro badge or a verified checkmark
-- is. is_pro(uid) itself stays caller-scoped (still the right guard for its
-- actual internal callers, enforce_crate_limits()/enforce_crate_can_limit()/
-- vote_on_can()) -- this is a separate, deliberately unguarded RPC built
-- specifically for the public-badge use case.
--
-- Computed live rather than denormalized into leaderboard_scores/
-- public_profiles: leaderboard_scores' sync trigger only fires on
-- user_collection writes, never on a Paddle webhook subscription change, so
-- a denormalized column there could show a stale badge until the user's
-- next scan/vote. Batched (accepts an array) so each surface fetches once
-- per page load, not once per row.

create or replace function get_pro_status(p_user_ids uuid[])
returns table(user_id uuid, is_pro boolean)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, (p.subscription_status = 'pro' and (p.pro_expires_at is null or p.pro_expires_at > now()))
  from profiles p
  where p.id = any(p_user_ids);
$$;

alter function get_pro_status(uuid[]) owner to sippd_rpc;
grant execute on function get_pro_status(uuid[]) to authenticated, anon;
