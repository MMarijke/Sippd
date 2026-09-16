-- "There's no way to permanently delete a can" — the existing delete
-- (a plain client .from('user_collection').delete(), still correct and
-- unchanged for the row it removes) only ever unlinks the caller's own
-- copy. shared_cans itself has no delete path anywhere, so a test/junk/
-- duplicate catalog entry (e.g. one created while manually reproducing a
-- bug) is permanent even after every collector who ever had it removes
-- their copy — orphaned forever, with no way to clean it up.
--
-- Deliberately NOT a blanket "delete any can" RPC: user_collection.can_id
-- has ON DELETE RESTRICT on shared_cans, so a plain delete already refuses
-- to remove a catalog entry anyone still has -- this RPC keeps that same
-- guarantee rather than working around it. It always removes the caller's
-- own entry (identical to the plain delete this replaces), then checks
-- whether it was the last one; only then does it also delete the now-
-- unreferenced shared_cans row (rarity_votes cascades; notifications/
-- activity_items set their can_id to null, same as today for any other
-- shared_cans deletion path). One collector removing their own copy of a
-- can six other people also collect never touches those six people's data
-- -- only the true "last one out" case cascades.
create or replace function delete_collection_entry(p_caller_id uuid, p_entry_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := sippd_auth_uid();
  v_can_id uuid;
  v_remaining integer;
  v_catalog_deleted boolean := false;
begin
  if p_caller_id is distinct from v_caller then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_caller;
  end if;

  select can_id into v_can_id from user_collection where id = p_entry_id and owner_id = v_caller;
  if not found then
    raise exception 'entry not found';
  end if;

  delete from user_collection where id = p_entry_id and owner_id = v_caller;

  select count(*) into v_remaining from user_collection where can_id = v_can_id;
  if v_remaining = 0 then
    delete from shared_cans where id = v_can_id;
    v_catalog_deleted := true;
  end if;

  return json_build_object('catalog_deleted', v_catalog_deleted);
end;
$$;

alter function delete_collection_entry(uuid, uuid) owner to sippd_rpc;
grant execute on function delete_collection_entry(uuid, uuid) to authenticated;
