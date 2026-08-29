-- Region for regional leaderboard segmentation (Phase 3 / Feature 3.1).
-- profiles.region didn't exist before this migration, and
-- sync_leaderboard_for_user never copied it even though
-- leaderboard_scores.region has existed as a column since
-- 20260820000000_leaderboard_scores.sql.

alter table profiles add column region text;

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
  from user_collection
  where owner_id = uid and status = 'collected'
    and can_rarity in ('Rare', 'Ultra Rare', 'Legendary');

  select coalesce(sum(
    case can_rarity
      when 'Common' then 1
      when 'Uncommon' then 2
      when 'Rare' then 3
      when 'Ultra Rare' then 4
      when 'Legendary' then 5
      else 1 -- matches getItemScore's fallback of RARITY_POINTS[...] || 1
    end
  ), 0) into v_score
  from user_collection
  where owner_id = uid and status = 'collected';

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

-- Backfill: populate region for all existing leaderboard rows now that the
-- column + function support it (mirrors the original backfill in
-- 20260820000000_leaderboard_scores.sql).
select sync_leaderboard_for_user(id) from profiles;
