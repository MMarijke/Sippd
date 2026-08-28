-- Account deletion support.
--
-- The actual deletion is triggered by the delete-account Edge Function
-- calling auth.admin.deleteUser() with the service_role key — never from the
-- client. That single call is enough to remove everything: every table in
-- this schema already has `references profiles (id) on delete cascade` (or
-- `on delete set null` for the two optional actor references,
-- notifications.actor_id and trades.traded_with_id, which correctly keep
-- the *other* party's record while anonymizing the deleted user). No new
-- cascade wiring is needed here.
--
-- What IS needed: shared_cans' vote/favourite aggregate columns
-- (common_votes..legendary_votes, total_votes, consensus_rarity,
-- confidence, community_favourites) are only ever incremented, by
-- vote_on_can() and toggle_favourite() on insert/toggle. Neither has a
-- decrement path. Without the two triggers below, a cascade-deleted
-- rarity_votes/user_collection row leaves those aggregates permanently
-- inflated by a voter/favouriter who no longer exists — corrupting the
-- Community Rarity consensus for everyone else on that can.
--
-- The user_collection trigger also retroactively fixes a pre-existing bug:
-- removing a *favourited* item from your own collection today (e.g. the
-- "Remove from Collection" flow on CanDetail) already hits this same gap,
-- independent of account deletion.
--
-- Both trigger functions are SECURITY DEFINER, owned by sippd_rpc — matching
-- vote_on_can()/toggle_favourite(), not the column-lockdown guard triggers.
-- They aren't inspecting *who* is deleting (RLS/the Edge Function's
-- service_role already gated that upstream); they just need to reliably
-- write to shared_cans' locked columns, which shared_cans_lock_columns()
-- only allows for auth.role() = 'service_role' or current_user =
-- 'sippd_rpc'. A SECURITY INVOKER trigger here would run as whatever role
-- performed the DELETE and get rejected by that same lockdown trigger.

create or replace function rarity_votes_decrement_shared_cans()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta_common   integer := case when old.voted_rarity = 'Common'     then 1 else 0 end;
  v_delta_uncommon integer := case when old.voted_rarity = 'Uncommon'   then 1 else 0 end;
  v_delta_rare     integer := case when old.voted_rarity = 'Rare'       then 1 else 0 end;
  v_delta_ultra    integer := case when old.voted_rarity = 'Ultra Rare' then 1 else 0 end;
  v_delta_legend   integer := case when old.voted_rarity = 'Legendary'  then 1 else 0 end;
begin
  update shared_cans set
    common_votes     = greatest(0, common_votes - v_delta_common),
    uncommon_votes   = greatest(0, uncommon_votes - v_delta_uncommon),
    rare_votes       = greatest(0, rare_votes - v_delta_rare),
    ultra_rare_votes = greatest(0, ultra_rare_votes - v_delta_ultra),
    legendary_votes  = greatest(0, legendary_votes - v_delta_legend),
    total_votes      = greatest(0, total_votes - 1),
    consensus_rarity = compute_consensus_rarity(
      greatest(0, common_votes - v_delta_common), greatest(0, uncommon_votes - v_delta_uncommon),
      greatest(0, rare_votes - v_delta_rare), greatest(0, ultra_rare_votes - v_delta_ultra),
      greatest(0, legendary_votes - v_delta_legend)
    ),
    confidence = compute_confidence(greatest(0, total_votes - 1))
  where id = old.can_id;
  return old;
end;
$$;

alter function rarity_votes_decrement_shared_cans() owner to sippd_rpc;

create trigger rarity_votes_decrement_shared_cans_trigger
  before delete on rarity_votes
  for each row execute function rarity_votes_decrement_shared_cans();

create or replace function user_collection_decrement_favourite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_favourite then
    update shared_cans
    set community_favourites = greatest(0, community_favourites - 1)
    where id = old.can_id;
  end if;
  return old;
end;
$$;

alter function user_collection_decrement_favourite() owner to sippd_rpc;

create trigger user_collection_decrement_favourite_trigger
  before delete on user_collection
  for each row execute function user_collection_decrement_favourite();
