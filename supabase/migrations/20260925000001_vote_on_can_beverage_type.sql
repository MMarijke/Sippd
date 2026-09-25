-- Adds p_beverage_type to vote_on_can() so a newly-created shared_cans row
-- can record its category at creation time -- the client sends an
-- OFF-guessed-or-manually-picked value (AddCanForm.jsx), but only the
-- FIRST contributor's value is ever written. Every "can already exists"
-- path below (barcode match, name+brand+flavour match, unique_violation
-- race) leaves the existing row's beverage_type untouched, exactly like
-- shared_cans.image_url's own established immutability.
--
-- Postgres identifies a function by name + parameter TYPES, so adding a
-- parameter to `create or replace function vote_on_can(...)` would create
-- a distinct overload rather than replacing the existing one -- explicit
-- DROP first, matching the precedent already set in
-- 20260820000003_fix_rpc_caller_id.sql for this exact same function.
drop function if exists vote_on_can(uuid, uuid, rarity_tier, text, text, text, text, text, text);

create or replace function vote_on_can(
  p_caller_id uuid,
  p_can_id uuid,
  p_rarity rarity_tier,
  p_name text default null,
  p_brand text default null,
  p_flavour text default null,
  p_edition text default null,
  p_image_url text default null,
  p_barcode text default null,
  p_beverage_type beverage_type default 'energy_drink'
)
returns shared_cans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter uuid := sippd_auth_uid();
  v_voter_name text;
  v_can shared_cans;
  v_can_id uuid := p_can_id;
  v_barcode text := nullif(trim(p_barcode), '');
  v_recent_votes integer;
  v_daily_scans integer;
  v_vote_inserted boolean := true;
  v_delta_common integer := case when p_rarity = 'Common' then 1 else 0 end;
  v_delta_uncommon integer := case when p_rarity = 'Uncommon' then 1 else 0 end;
  v_delta_rare integer := case when p_rarity = 'Rare' then 1 else 0 end;
  v_delta_ultra integer := case when p_rarity = 'Ultra Rare' then 1 else 0 end;
  v_delta_legendary integer := case when p_rarity = 'Legendary' then 1 else 0 end;
begin
  if v_voter is null then
    raise exception 'must be authenticated to vote';
  end if;
  if p_caller_id is distinct from v_voter then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_voter;
  end if;

  select full_name into v_voter_name from profiles where id = v_voter;

  select count(*) into v_recent_votes
  from rarity_votes
  where voter_id = v_voter
    and created_at > now() - interval '1 hour';

  if v_recent_votes >= 30 then
    raise exception 'rate_limit_exceeded';
  end if;

  if p_barcode is not null and not is_pro(v_voter) then
    select count(*) into v_daily_scans
    from rarity_votes
    where voter_id = v_voter
      and created_at > now() - interval '24 hours';
    if v_daily_scans >= 10 then
      raise exception 'daily_scan_limit_reached';
    end if;
  end if;

  if v_can_id is null then
    if p_name is null or p_brand is null then
      raise exception 'name and brand are required to add a new can';
    end if;

    if v_barcode is not null then
      select id into v_can_id from shared_cans where barcode = v_barcode;
    end if;

    if v_can_id is null then
      select id into v_can_id
      from shared_cans
      where lower(name) = lower(p_name)
        and lower(brand) = lower(p_brand)
        and (
          (p_flavour is null and flavour is null) or
          lower(flavour) = lower(p_flavour)
        )
      order by created_at asc
      limit 1;
    end if;

    if v_can_id is null then
      begin
        insert into shared_cans (
          name, brand, flavour, edition, image_url, barcode, contributed_by,
          beverage_type,
          common_votes, uncommon_votes, rare_votes, ultra_rare_votes, legendary_votes,
          total_votes, consensus_rarity, confidence
        )
        values (
          p_name, p_brand, p_flavour, p_edition, p_image_url, v_barcode, coalesce(v_voter_name, 'Collector'),
          p_beverage_type,
          v_delta_common, v_delta_uncommon, v_delta_rare, v_delta_ultra, v_delta_legendary,
          1, p_rarity, 'unrated'
        )
        returning * into v_can;

        insert into rarity_votes (can_id, voter_id, voted_rarity)
        values (v_can.id, v_voter, p_rarity);

        if v_can.consensus_rarity in ('Rare', 'Ultra Rare', 'Legendary') then
          insert into notifications (recipient_id, type, actor_id, actor_name, can_id, can_name, can_brand, can_rarity, is_read)
          select f.follower_id, 'rare_pull_follow', v_voter, v_voter_name, v_can.id, v_can.name, v_can.brand, v_can.consensus_rarity, false
          from follows f
          join profiles p on p.id = f.follower_id
          where f.following_id = v_voter
            and f.status = 'accepted'
            and p.notify_rare_follows = true;
        end if;

        return v_can;
      exception when unique_violation then
        select id into v_can_id from shared_cans where barcode = v_barcode;
      end;
    end if;
  end if;

  perform 1 from shared_cans where id = v_can_id for update;
  if not found then
    raise exception 'can not found';
  end if;

  begin
    insert into rarity_votes (can_id, voter_id, voted_rarity)
    values (v_can_id, v_voter, p_rarity);
  exception when unique_violation then
    -- Already voted on this can before (a real, supported flow: logging a
    -- second/duplicate unit of a can this user already owns) -- skip the
    -- vote silently rather than failing the whole request.
    v_vote_inserted := false;
  end;

  if v_vote_inserted then
    update shared_cans set
      common_votes     = common_votes + v_delta_common,
      uncommon_votes   = uncommon_votes + v_delta_uncommon,
      rare_votes       = rare_votes + v_delta_rare,
      ultra_rare_votes = ultra_rare_votes + v_delta_ultra,
      legendary_votes  = legendary_votes + v_delta_legendary,
      total_votes      = total_votes + 1,
      consensus_rarity = compute_consensus_rarity(
        common_votes + v_delta_common, uncommon_votes + v_delta_uncommon, rare_votes + v_delta_rare,
        ultra_rare_votes + v_delta_ultra, legendary_votes + v_delta_legendary
      ),
      confidence = compute_confidence(total_votes + 1)
    where id = v_can_id
    returning * into v_can;

    if v_can.consensus_rarity in ('Rare', 'Ultra Rare', 'Legendary') then
      insert into notifications (recipient_id, type, actor_id, actor_name, can_id, can_name, can_brand, can_rarity, is_read)
      select f.follower_id, 'rare_pull_follow', v_voter, v_voter_name, v_can.id, v_can.name, v_can.brand, v_can.consensus_rarity, false
      from follows f
      join profiles p on p.id = f.follower_id
      where f.following_id = v_voter
        and f.status = 'accepted'
        and p.notify_rare_follows = true;
    end if;
  else
    select * into v_can from shared_cans where id = v_can_id;
  end if;

  return v_can;
end;
$$;

alter function vote_on_can(uuid, uuid, rarity_tier, text, text, text, text, text, text, beverage_type) owner to sippd_rpc;
grant execute on function vote_on_can(uuid, uuid, rarity_tier, text, text, text, text, text, text, beverage_type) to authenticated;
