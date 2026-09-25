-- Leaderboard category filter (multi-beverage expansion). Deliberately a
-- live, query-time computation -- not a schema split (no per-category
-- columns added to leaderboard_scores) and not a second persisted
-- leaderboard system. leaderboard_scores itself is untouched and stays the
-- fast path for the unfiltered "All" view in CollectorsLeaderboard.jsx;
-- this RPC is only called when a category filter other than "All" is
-- active.
--
-- Uncapped (no LIMIT) and not caller-scoped, same as leaderboard_scores'
-- own public `select ... using (true)` policy -- this is the same public
-- aggregate data, just filtered by category. Same non-invasive shape as
-- get_pro_status/get_public_crate: security definer, owned by sippd_rpc,
-- no RLS or table changes on user_collection or shared_cans.
create or replace function get_category_leaderboard(p_beverage_type beverage_type)
returns table(user_id uuid, full_name text, total_cans integer, rare_pulls integer)
language sql
security definer
stable
set search_path = public
as $$
  select uc.owner_id, p.full_name,
    count(*)::integer as total_cans,
    count(*) filter (where sc.consensus_rarity in ('Rare', 'Ultra Rare', 'Legendary'))::integer as rare_pulls
  from user_collection uc
  join shared_cans sc on sc.id = uc.can_id
  join profiles p on p.id = uc.owner_id
  where uc.status = 'collected' and sc.beverage_type = p_beverage_type
  group by uc.owner_id, p.full_name;
$$;

alter function get_category_leaderboard(beverage_type) owner to sippd_rpc;
grant execute on function get_category_leaderboard(beverage_type) to authenticated;
