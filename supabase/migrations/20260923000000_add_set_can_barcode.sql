-- EditEntrySheet.jsx had no barcode field at all -- a can added without one
-- (manual entry, or a scan that didn't resolve) could never get one added
-- later. barcode lives on shared_cans (the community catalog), not
-- user_collection, so this can't be a plain client update even with an RLS
-- policy: shared_cans has no client UPDATE policy at all (only
-- shared_cans_select_all), matching every other shared_cans mutation in
-- this schema (vote_on_can, toggle_favourite) going through a
-- SECURITY DEFINER RPC instead of a direct table write.
--
-- Deliberately narrow, not a general "edit any can's barcode" RPC:
--   - Only settable while the can's barcode is currently null -- adding a
--     missing barcode is safe and useful; overwriting someone else's
--     already-correct barcode is exactly the kind of catalog vandalism a
--     shared, community-sourced table needs to guard against, and that's
--     a "report incorrect data" problem this RPC doesn't try to solve.
--   - Only callable by someone who actually has this can in their own
--     collection (owns a user_collection row referencing it) -- you can
--     fix data on a can you own, not any catalog entry you can see.
create or replace function set_can_barcode(p_caller_id uuid, p_can_id uuid, p_barcode text)
returns shared_cans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := sippd_auth_uid();
  v_barcode text := nullif(trim(p_barcode), '');
  v_can shared_cans;
begin
  if p_caller_id is distinct from v_caller then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_caller;
  end if;

  if v_barcode is null then
    raise exception 'barcode is required';
  end if;

  if not exists (select 1 from user_collection where owner_id = v_caller and can_id = p_can_id) then
    raise exception 'you can only add a barcode to a can in your own collection';
  end if;

  select * into v_can from shared_cans where id = p_can_id for update;
  if not found then
    raise exception 'can not found';
  end if;

  if v_can.barcode is not null then
    raise exception 'this can already has a barcode';
  end if;

  begin
    update shared_cans set barcode = v_barcode where id = p_can_id returning * into v_can;
  exception when unique_violation then
    raise exception 'barcode_already_used';
  end;

  return v_can;
end;
$$;

alter function set_can_barcode(uuid, uuid, text) owner to sippd_rpc;
grant execute on function set_can_barcode(uuid, uuid, text) to authenticated;
