-- PublicProfile.jsx has hardcoded voteCount: 0 when computing another
-- user's achievements, so anyone viewing someone else's profile always
-- sees their vote-based achievement badges (community_pillar, vault_hunter)
-- as locked regardless of reality. rarity_votes' only RLS policy
-- (rarity_votes_select_own) is owner-only -- there's no way for a client to
-- read another user's real vote count directly. Mirrors get_public_collection's
-- exact shape (20260912000000_public_profile_collection_access.sql) and its
-- same public/owner/accepted-follower gate, for the same reason: a private
-- account's vote count shouldn't be visible to a stranger any more than
-- their collection is.

create or replace function get_public_vote_count(p_caller_id uuid, p_profile_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_caller uuid := sippd_auth_uid();
  v_count integer;
begin
  if p_caller_id is distinct from v_caller then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_caller;
  end if;

  select count(*) into v_count
  from rarity_votes rv
  where rv.voter_id = p_profile_id
    and (
      not exists (select 1 from profiles pr where pr.id = p_profile_id and pr.is_private)
      or p_profile_id = v_caller
      or exists (
        select 1 from follows f
        where f.follower_id = v_caller and f.following_id = p_profile_id and f.status = 'accepted'
      )
    );

  return coalesce(v_count, 0);
end;
$$;

alter function get_public_vote_count(uuid, uuid) owner to sippd_rpc;
grant execute on function get_public_vote_count(uuid, uuid) to authenticated, anon;
