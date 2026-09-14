-- Security fix: is_pro(uid) leaked any user's Pro subscription status to any
-- other authenticated user. Unlike every mutation RPC in this schema, it took
-- an arbitrary uid with no caller-match check and was granted directly to
-- `authenticated` -- supabase.rpc('is_pro', { uid: <anyone> }) revealed
-- whether that specific user currently has active Pro. Profile ids aren't
-- secret (public_profiles exposes them to any signed-in or anonymous
-- visitor), so this was trivially exploitable against any visible profile.
--
-- Fix mirrors the p_caller_id-vs-sippd_auth_uid() guard already used by every
-- other RPC in this schema: allow the check only for the caller's own id, or
-- from the trusted sippd_rpc/postgres roles (the internal callers below).
--
-- Both internal call sites keep working without their own changes:
--   - enforce_crate_limits() / enforce_crate_can_limit() are SECURITY INVOKER
--     triggers on crates, called with new.owner_id -- which by the time a
--     legitimate request reaches them always equals the caller's own
--     sippd_auth_uid() (crates_insert_own/crates_update_own's RLS WITH CHECK
--     enforces owner_id = auth.uid(), just evaluated after BEFORE triggers
--     run). A forged owner_id in a malicious insert would already be rejected
--     by that RLS check regardless -- this guard just fails it slightly
--     earlier, with a clearer error.
--   - vote_on_can() is SECURITY DEFINER owned by sippd_rpc, so its internal
--     call to is_pro(v_voter) runs as sippd_rpc and passes the trusted-role
--     branch (and v_voter is already sippd_auth_uid() itself either way).

create or replace function public.is_pro(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if uid is distinct from sippd_auth_uid()
     and current_user is distinct from 'sippd_rpc'
     and current_user is distinct from 'postgres'
  then
    raise exception 'is_pro can only be checked for your own account';
  end if;

  return coalesce(
    (select subscription_status = 'pro'
       and (pro_expires_at is null or pro_expires_at > now())
     from profiles where id = uid),
    false
  );
end;
$$;

alter function public.is_pro(uuid) owner to sippd_rpc;
-- Grant stays: enforce_crate_limits()/enforce_crate_can_limit() run SECURITY
-- INVOKER as the calling client's own role, so `authenticated` still needs
-- EXECUTE to call is_pro() from those triggers -- the guard above is what
-- stops cross-user use, not revoking this grant (which would break crate
-- creation/editing for every user).
grant execute on function public.is_pro(uuid) to authenticated;
