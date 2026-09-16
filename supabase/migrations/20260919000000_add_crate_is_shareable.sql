-- Shareable Crates critique fix (P0): get_public_crate previously made every
-- crate shareable the instant its owner tapped Share, with no opt-in and no
-- disclosure that this bypasses the account's Private Account setting. That
-- was reviewed and rejected — sharing should require an explicit, visible
-- per-crate opt-in, not a silent default-on capability link.
--
-- is_shareable defaults false: every existing crate (created before this
-- migration) starts non-shareable, same as a brand-new one. The owner turns
-- it on from CrateDetailSheet.jsx's new toggle, whose own label carries the
-- disclosure ("Anyone with the link can view this crate") -- that toggle
-- moment *is* the opt-in and the disclosure together, not two separate UI
-- surfaces to keep in sync.
alter table crates add column is_shareable boolean not null default false;

-- get_public_crate treats "not shareable" identically to "not found" (same
-- raised exception, same message) rather than a distinct "this crate exists
-- but sharing is off" response -- a distinct response would let a caller
-- who already knows/guesses a crate id confirm it exists even while
-- sharing is off, which the capability-link model should not leak.
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
  if not found or not v_crate.is_shareable then
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
