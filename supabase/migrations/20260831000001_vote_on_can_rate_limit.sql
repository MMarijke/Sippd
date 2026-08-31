-- Rate limit vote_on_can(): max 30 votes per hour per user. Covers both
-- voting on an existing can and the create-new-can path (Tier 3 below),
-- since both insert into rarity_votes and this check runs before either
-- tier is reached — closes the mass-voting/spam-create gap flagged in
-- the rate-limiting audit (no limit existed beyond the one-vote-per-can
-- unique constraint, which only stops a duplicate vote on the same can).

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
  v_voter uuid := auth.uid();
  v_can shared_cans;
  v_can_id uuid := p_can_id;
  v_barcode text := nullif(trim(p_barcode), '');   -- blank input must never collide with other blanks
  v_recent_votes integer;
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

  -- Rate limit: max 30 votes per hour per user.
  select count(*) into v_recent_votes
  from rarity_votes
  where voter_id = v_voter
    and created_at > now() - interval '1 hour';

  if v_recent_votes >= 30 then
    raise exception 'rate_limit_exceeded';
  end if;

  if v_can_id is null then
    if p_name is null or p_brand is null then
      raise exception 'name and brand are required to add a new can';
    end if;

    -- Tier 1: exact barcode match, checked proactively so it takes priority
    -- over the name+brand+flavour fallback below.
    if v_barcode is not null then
      select id into v_can_id from shared_cans where barcode = v_barcode;
    end if;

    -- Tier 2: case-insensitive name + brand + flavour match, only consulted
    -- when barcode was absent or didn't resolve to an existing can. Ordered
    -- so a pre-existing set of duplicate rows always resolves the same way.
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

    -- Tier 3: no match on either tier — create a new can.
    if v_can_id is null then
      begin
        insert into shared_cans (
          name, brand, flavour, edition, image_url, barcode,
          common_votes, uncommon_votes, rare_votes, ultra_rare_votes, legendary_votes,
          total_votes, consensus_rarity, confidence
        )
        values (
          p_name, p_brand, p_flavour, p_edition, p_image_url, v_barcode,
          v_delta_common, v_delta_uncommon, v_delta_rare, v_delta_ultra, v_delta_legendary,
          1, p_rarity, 'unrated'
        )
        returning * into v_can;

        insert into rarity_votes (can_id, voter_id, voted_rarity)
        values (v_can.id, v_voter, p_rarity);

        return v_can;
      exception when unique_violation then
        -- Race: another request inserted the same barcode between our tier-1
        -- check and this insert. Fall through to vote on their row instead.
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
    raise exception 'already_collected';
  end;

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

  return v_can;
end;
$$;

alter function vote_on_can(uuid, uuid, rarity_tier, text, text, text, text, text, text) owner to sippd_rpc;
grant execute on function vote_on_can(uuid, uuid, rarity_tier, text, text, text, text, text, text) to authenticated;
