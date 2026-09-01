-- Sippd Pro subscription support: billing fields on profiles, an is_pro()
-- helper, and free-tier limits enforced in Postgres (crates count, cans per
-- crate, daily barcode-scan volume) so no client-side check is trusted.
--
-- KNOWN GAP (flagged, accepted as-is): subscription_status/paddle_* are
-- locked to writes from current_user 'sippd_rpc'/'postgres' (the same
-- bypass profiles_lock_columns() already uses for role/current_streak).
-- No RPC or webhook that runs as either of those exists yet, so there is
-- currently no legitimate way to ever set subscription_status = 'pro'.
-- A future Paddle webhook edge function will authenticate via the
-- service_role key, which Postgres reports as auth.role() = 'service_role'
-- — NOT as current_user 'sippd_rpc' — so this lock will need a follow-up
-- migration (or a dedicated trigger keyed on auth.role()) once that webhook
-- is built, or the webhook's own writes will be silently rejected.

-- ── STEP 1: billing columns + lockdown + is_pro() ───────────────────────────

alter table public.profiles
  add column subscription_status text default 'free'
    check (subscription_status in ('free', 'pro', 'cancelled')),
  add column paddle_subscription_id text,
  add column paddle_customer_id text,
  add column pro_expires_at timestamptz;

create or replace function profiles_lock_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if current_user is distinct from 'sippd_rpc' and current_user is distinct from 'postgres' then
    if new.role is distinct from old.role then
      raise exception 'role is not client-writable';
    end if;
    if new.current_streak is distinct from old.current_streak then
      raise exception 'current_streak is not client-writable — use tick_streak()';
    end if;
    if new.last_active_date is distinct from old.last_active_date then
      raise exception 'last_active_date is not client-writable — use tick_streak()';
    end if;
    if new.subscription_status is distinct from old.subscription_status then
      raise exception 'subscription_status is not client-writable';
    end if;
    if new.paddle_subscription_id is distinct from old.paddle_subscription_id then
      raise exception 'paddle_subscription_id is not client-writable';
    end if;
    if new.paddle_customer_id is distinct from old.paddle_customer_id then
      raise exception 'paddle_customer_id is not client-writable';
    end if;
    if new.pro_expires_at is distinct from old.pro_expires_at then
      raise exception 'pro_expires_at is not client-writable';
    end if;
  end if;
  return new;
end;
$$;

-- profiles_lock_columns_trigger already points at this function (created in
-- 20260815120100_security.sql) — CREATE OR REPLACE above is enough to pick
-- up the new checks, no need to recreate the trigger itself.

create or replace function public.is_pro(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select subscription_status = 'pro'
       and (pro_expires_at is null or pro_expires_at > now())
     from profiles where id = uid),
    false
  );
$$;
alter function public.is_pro(uuid) owner to sippd_rpc;
grant execute on function public.is_pro(uuid) to authenticated;

-- ── STEP 2: free-tier crate count limit (max 5) ─────────────────────────────

create or replace function public.enforce_crate_limits()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_crate_count integer;
begin
  if not is_pro(new.owner_id) then
    select count(*) into v_crate_count
    from crates where owner_id = new.owner_id;
    if v_crate_count >= 5 then
      raise exception 'crate_limit_reached';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_crate_limits_trigger
  before insert on crates
  for each row execute function enforce_crate_limits();

-- ── STEP 3: free-tier cans-per-crate limit (max 10) ─────────────────────────

create or replace function public.enforce_crate_can_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not is_pro(new.owner_id) then
    if array_length(new.can_ids, 1) > 10 then
      raise exception 'crate_can_limit_reached';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_crate_can_limit_trigger
  before update on crates
  for each row execute function enforce_crate_can_limit();

-- ── STEP 4: free-tier daily barcode-scan limit (max 10/day) ─────────────────
-- Full vote_on_can() body, replacing 20260831000001_vote_on_can_rate_limit.sql
-- verbatim except for the new block below (added after the existing hourly
-- rate limit, before the tier lookups) and v_daily_scans hoisted into the
-- top-level declare block to match this function's existing style.

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
  v_daily_scans integer;
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

  -- Daily barcode scan limit for free users: 10/day. p_barcode is only ever
  -- populated by the Scan flow (a manual search/add leaves it null), so this
  -- targets the in-the-moment scan action specifically, not can-adding as a whole.
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
