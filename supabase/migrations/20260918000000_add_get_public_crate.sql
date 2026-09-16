-- Shareable Crates: a crate's owner can generate a link to a single crate
-- (/crate/:crateId) that works for anyone who has the URL, logged in or
-- not — regardless of whether the owner's account is is_private.
--
-- Deliberate policy call (see the build plan for this feature): this is a
-- "capability link" model, same as a Figma/Notion share link, not an
-- extension of the account-level privacy rule get_public_collection
-- already enforces. Sharing one crate is a scoped, active choice the
-- owner makes (tapping Share on that specific crate) — it does not expose
-- the rest of a private account's collection, and nothing here makes a
-- crate reachable without its id being handed out first.
--
-- Same shape as get_public_collection (20260912000000): a single
-- SECURITY DEFINER RPC owned by sippd_rpc (already has select on both
-- crates and user_collection, plus BYPASSRLS, from
-- 20260819120000_grant_sippd_rpc_table_access.sql) bypasses
-- crates_select_own / user_collection_select_own's owner-only RLS for
-- exactly this one read, rather than widening either table's policy.
create or replace function get_public_crate(p_caller_id uuid, p_crate_id uuid)
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_caller uuid := sippd_auth_uid();
  v_crate crates;
  v_owner_name text;
begin
  if p_caller_id is distinct from v_caller then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_caller;
  end if;

  select * into v_crate from crates where id = p_crate_id;
  if not found then
    raise exception 'crate not found';
  end if;

  select full_name into v_owner_name from profiles where id = v_crate.owner_id;

  return json_build_object(
    'crate', json_build_object(
      'id', v_crate.id, 'name', v_crate.name, 'description', v_crate.description,
      'emoji', v_crate.emoji, 'owner_id', v_crate.owner_id,
      'owner_name', coalesce(v_owner_name, 'Collector')
    ),
    'cans', (select coalesce(json_agg(uc.*), '[]'::json) from user_collection uc where uc.id = any(v_crate.can_ids))
  );
end;
$$;

alter function get_public_crate(uuid, uuid) owner to sippd_rpc;
grant execute on function get_public_crate(uuid, uuid) to authenticated, anon;
