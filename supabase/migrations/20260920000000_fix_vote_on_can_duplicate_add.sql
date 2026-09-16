-- Bug: adding a can either failed outright or silently didn't add it while
-- claiming "you already have this can in your vault" -- reported by a real
-- test user unable to log a second/duplicate can (or any can whose
-- shared_cans match wasn't already known to the client as prefillData.id).
--
-- Root cause: AddCanForm.jsx only skips calling vote_on_can() when it
-- already knows (client-side, via a query keyed on prefillData.id) that
-- this user already voted on this exact can. That client-side check is
-- blind whenever prefillData has no id yet -- a manual entry, or a can
-- vote_on_can() itself resolves via barcode/name+brand+flavour fuzzy
-- matching that the client never saw. In every one of those cases,
-- vote_on_can() went on to try inserting a second rarity_votes row for the
-- same (can_id, voter_id), hit rarity_votes' own one-vote-per-can unique
-- constraint, and raised 'already_collected' -- which AddCanForm.jsx's
-- onError treats as a soft no-op (toast + close the form), even though the
-- user_collection insert that actually adds the can to their vault never
-- ran. The user was told they already had a can they, in fact, did not.
--
-- Fix: re-adding a can you've already voted on is a normal, supported flow
-- (STATUS_OPTIONS includes 'duplicate' for exactly this), not an error
-- condition -- the vote should be silently skipped, not raised, so the
-- caller's user_collection insert (which runs after this RPC returns)
-- always goes through. v_vote_inserted tracks whether the insert actually
-- happened, so the vote-count aggregate update below only runs for a real
-- new vote -- without that guard, a skipped/duplicate vote would still
-- inflate shared_cans.total_votes past the real number of rarity_votes
-- rows, and the rare_pull_follow fan-out would re-notify every follower on
-- every re-add of the same can. Rest of the body is unchanged from
-- 20260916000003_set_shared_cans_contributed_by.sql.
create or replace function vote_on_can(
  p_caller_id uuid,
  p_can_id uuid,
  p_rarity rarity_tier,
  p_name text default null,
  p_brand text default null,
  p_flavour text default null,
  p_edition text default null,
  p_image_url text default null,
  p_barcode text default null
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
          common_votes, uncommon_votes, rare_votes, ultra_rare_votes, legendary_votes,
          total_votes, consensus_rarity, confidence
        )
        values (
          p_name, p_brand, p_flavour, p_edition, p_image_url, v_barcode, coalesce(v_voter_name, 'Collector'),
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

alter function vote_on_can(uuid, uuid, rarity_tier, text, text, text, text, text, text) owner to sippd_rpc;
grant execute on function vote_on_can(uuid, uuid, rarity_tier, text, text, text, text, text, text) to authenticated;
