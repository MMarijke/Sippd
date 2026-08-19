-- Leaderboard scores: a synced public aggregate so CollectorsLeaderboard.jsx
-- and FindCollectors.jsx don't need to read every user's user_collection rows
-- (impossible under owner-scoped RLS) to rank/search collectors.

create table leaderboard_scores (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  full_name text,
  region text,
  total_cans integer not null default 0,
  rare_pulls integer not null default 0,
  score integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table leaderboard_scores enable row level security;

create policy leaderboard_scores_select_all on leaderboard_scores
  for select to authenticated using (true);
-- No insert/update/delete policy for plain authenticated: every write goes
-- through sync_leaderboard_for_user(), which runs as sippd_rpc and bypasses RLS.

-- Same category of bug as 20260819120000: BYPASSRLS doesn't grant table-level
-- DML, and this table didn't exist yet when that migration ran, so sippd_rpc
-- was never granted access to it either. Grant it here, right after creation.
grant select, insert, update on leaderboard_scores to sippd_rpc;

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

  select full_name into v_full_name from profiles where id = uid;

  insert into leaderboard_scores (user_id, full_name, total_cans, rare_pulls, score, updated_at)
  values (uid, v_full_name, v_total, v_rare, v_score, now())
  on conflict (user_id) do update set
    full_name  = excluded.full_name,
    total_cans = excluded.total_cans,
    rare_pulls = excluded.rare_pulls,
    score      = excluded.score,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

alter function sync_leaderboard_for_user(uuid) owner to sippd_rpc;
-- Deliberately no grant to authenticated — this function is called only by the
-- trigger below (which runs as sippd_rpc), never directly by clients. Granting
-- client access would let any user force a recompute of any other user's row.

create or replace function trigger_sync_leaderboard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := coalesce(new.owner_id, old.owner_id);
  perform sync_leaderboard_for_user(v_uid);
  return coalesce(new, old);
end;
$$;

alter function trigger_sync_leaderboard() owner to sippd_rpc;

create trigger user_collection_sync_leaderboard
  after insert or update or delete on user_collection
  for each row execute function trigger_sync_leaderboard();

-- Backfill existing users so leaderboard isn't empty on first deploy
select sync_leaderboard_for_user(id) from profiles;
