-- Security fix: leaderboard rank/score could be arbitrarily inflated.
--
-- user_collection.can_rarity is a client-writable per-row display snapshot
-- (set at add-time in AddCanForm.jsx from the trusted vote_on_can() result,
-- but never locked afterward — only is_favourite was covered by
-- user_collection_lock_favourite()). sync_leaderboard_for_user() computed
-- rare_pulls/score directly from that column, so any authenticated user
-- could run `update user_collection set can_rarity = 'Legendary' ...` (RLS
-- only checks owner_id) or even insert a fresh row with a fabricated
-- can_rarity, and instantly top the public leaderboard with no real votes
-- backing it.
--
-- Two-part fix:
--   1. Lock can_rarity the same way is_favourite is locked. EditEntrySheet.jsx's
--      edit form never sends can_rarity, so this breaks no real feature — it
--      only blocks direct-UPDATE tampering.
--   2. Stop trusting the column for scoring at all: sync_leaderboard_for_user()
--      now joins shared_cans and uses consensus_rarity (the community-checked
--      value everything else in the app treats as authoritative — RarityReveal,
--      badges, etc.) instead of user_collection.can_rarity. This also closes
--      the INSERT-time gap the lock trigger alone can't cover, since RLS still
--      allows inserting a new row with any can_rarity value.

drop trigger user_collection_lock_favourite_trigger on user_collection;
drop function user_collection_lock_favourite();

create or replace function user_collection_lock_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if current_user is distinct from 'sippd_rpc' and current_user is distinct from 'postgres' then
    if new.is_favourite is distinct from old.is_favourite then
      raise exception 'is_favourite is not client-writable — use toggle_favourite()';
    end if;
    if new.can_rarity is distinct from old.can_rarity then
      raise exception 'can_rarity is not client-writable after creation — it is set once from the shared_cans consensus at add-time and is not used for scoring afterward';
    end if;
  end if;
  return new;
end;
$$;

create trigger user_collection_lock_columns_trigger
  before update on user_collection
  for each row execute function user_collection_lock_columns();

create or replace function sync_leaderboard_for_user(uid uuid)
returns leaderboard_scores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row leaderboard_scores;
  v_total integer;
  v_rare integer;
  v_score integer;
  v_full_name text;
  v_region text;
begin
  select count(*) into v_total
  from user_collection
  where owner_id = uid and status = 'collected';

  select count(*) into v_rare
  from user_collection uc
  join shared_cans sc on sc.id = uc.can_id
  where uc.owner_id = uid and uc.status = 'collected'
    and sc.consensus_rarity in ('Rare', 'Ultra Rare', 'Legendary');

  select coalesce(sum(
    case sc.consensus_rarity
      when 'Common' then 1
      when 'Uncommon' then 2
      when 'Rare' then 3
      when 'Ultra Rare' then 4
      when 'Legendary' then 5
      else 1 -- matches getItemScore's fallback of RARITY_POINTS[...] || 1
    end
  ), 0) into v_score
  from user_collection uc
  join shared_cans sc on sc.id = uc.can_id
  where uc.owner_id = uid and uc.status = 'collected';

  select full_name, region into v_full_name, v_region from profiles where id = uid;

  insert into leaderboard_scores (user_id, full_name, region, total_cans, rare_pulls, score, updated_at)
  values (uid, v_full_name, v_region, v_total, v_rare, v_score, now())
  on conflict (user_id) do update set
    full_name  = excluded.full_name,
    region     = excluded.region,
    total_cans = excluded.total_cans,
    rare_pulls = excluded.rare_pulls,
    score      = excluded.score,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

alter function sync_leaderboard_for_user(uuid) owner to sippd_rpc;

-- Recompute every existing row now that scoring source has changed — any
-- previously-inflated score from a fabricated can_rarity corrects itself here.
select sync_leaderboard_for_user(id) from profiles;
