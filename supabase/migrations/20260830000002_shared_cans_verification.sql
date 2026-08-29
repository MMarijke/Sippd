-- Groundwork for Phase 3.2 brand verification (UI only this phase --
-- no admin UI or payment flow yet). Columns are added to the existing
-- shared_cans_lock_columns() trigger alongside the vote/aggregate columns,
-- since nothing should be able to self-verify a can before any admin
-- surface exists to legitimately set these.

alter table shared_cans add column verified boolean not null default false;
alter table shared_cans add column verified_by text;

create or replace function shared_cans_lock_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if auth.role() is distinct from 'service_role' and current_user is distinct from 'sippd_rpc' then
    if new.common_votes is distinct from old.common_votes
      or new.uncommon_votes is distinct from old.uncommon_votes
      or new.rare_votes is distinct from old.rare_votes
      or new.ultra_rare_votes is distinct from old.ultra_rare_votes
      or new.legendary_votes is distinct from old.legendary_votes
      or new.total_votes is distinct from old.total_votes
      or new.consensus_rarity is distinct from old.consensus_rarity
      or new.confidence is distinct from old.confidence
      or new.community_favourites is distinct from old.community_favourites
      or new.verified is distinct from old.verified
      or new.verified_by is distinct from old.verified_by
    then
      raise exception 'vote, favourite, and verification columns are not client-writable';
    end if;
  end if;
  return new;
end;
$$;
