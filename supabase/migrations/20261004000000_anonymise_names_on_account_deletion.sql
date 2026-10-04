-- Account deletion left the deleted person's name behind in two places,
-- although the privacy policy promises account data is "deleted or
-- anonymized" after deletion:
--
--   notifications.actor_name    other users' notifications keep showing it
--                               ("Priya started following you"); the
--                               actor_id foreign key is only set to null
--   shared_cans.contributed_by  a display-name snapshot on catalog cans the
--                               person added; catalog cans outlive accounts
--
-- Fix: a BEFORE DELETE trigger on profiles (deletion cascades here from
-- auth.users, see delete-account) that rewrites both while the person's id
-- and name are still known. Same SECURITY DEFINER + sippd_rpc ownership as
-- the other deletion triggers (20260821000000_account_deletion_support.sql):
-- it has to update other users' rows, and sippd_rpc passes the column
-- guards. It reads no current_user, so DEFINER is safe here.
--
-- contributed_by stores a name, not an id, so it's matched by name AND by
-- the person's own vote on that can (adding a can always casts a vote), so
-- another collector with the same display name is never touched.

create or replace function anonymise_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update notifications
     set actor_name = 'A former collector'
   where actor_id = old.id;

  update shared_cans
     set contributed_by = null
   where contributed_by = old.full_name
     and id in (select can_id from rarity_votes where voter_id = old.id);

  return old;
end;
$$;

alter function anonymise_deleted_profile() owner to sippd_rpc;
revoke execute on function anonymise_deleted_profile() from public, anon, authenticated;

drop trigger if exists anonymise_deleted_profile_trigger on profiles;
create trigger anonymise_deleted_profile_trigger
  before delete on profiles
  for each row execute function anonymise_deleted_profile();

-- Backfill: accounts already deleted. actor_id only becomes null through
-- that foreign key's ON DELETE SET NULL, so a notification with a name but
-- no actor_id belongs to a deleted account. (Their contributed_by names
-- can't be matched any more: the votes linking them are gone.)
update notifications
   set actor_name = 'A former collector'
 where actor_id is null
   and actor_name is not null
   and actor_name is distinct from 'A former collector';
