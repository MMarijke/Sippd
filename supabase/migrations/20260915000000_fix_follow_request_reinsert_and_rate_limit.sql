-- Fixes a real dead end: request_follow() never handled a repeat request
-- against a 'denied' follows row. follows has unique(follower_id,
-- following_id); deny_follow_request() UPDATEs status to 'denied' rather
-- than deleting the row, but FollowButton.jsx's state machine only
-- recognizes 'accepted'/'pending' -- a denied row falls through to
-- rendering a fresh "Follow" button, so the denial is invisible to the
-- requester. Tapping Follow again hit a bare `insert into follows (...)`
-- with no exception handling, so it threw a raw, uncaught 23505
-- unique_violation -- and since the client had no onError handler either
-- (fixed separately in FollowButton.jsx), the failure was completely
-- silent. The requester was permanently stuck with zero indication why.
-- (/impeccable critique)
--
-- Also fixes actor_name always being null (schema declares it,
-- 20260815120000_initial_schema.sql:168, but no RPC has ever set it -- every
-- "X started following you" notification has rendered with a blank name
-- since this table existed), and adds rate limiting matching the pattern
-- vote_on_can() already uses.

create or replace function request_follow(p_caller_id uuid, p_target_id uuid)
returns follows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := sippd_auth_uid();
  v_target profiles;
  v_voter_name text;
  v_status follow_status;
  v_existing follows;
  v_follow follows;
  v_recent_requests integer;
  v_notif_type notification_type;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
  end if;
  if v_uid = p_target_id then
    raise exception 'cannot follow yourself';
  end if;

  select count(*) into v_recent_requests
  from follows
  where follower_id = v_uid
    and created_at > now() - interval '1 hour';

  if v_recent_requests >= 20 then
    raise exception 'rate_limit_exceeded';
  end if;

  select * into v_target from profiles where id = p_target_id;
  if not found then
    raise exception 'target user not found';
  end if;

  select full_name into v_voter_name from profiles where id = v_uid;

  v_status := case when v_target.is_private then 'pending' else 'accepted' end;
  v_notif_type := case when v_status = 'pending' then 'follow_request' else 'new_follower' end;

  select * into v_existing from follows
    where follower_id = v_uid and following_id = p_target_id
    for update;

  if found then
    if v_existing.status in ('pending', 'accepted') then
      raise exception 'already following this user or a request is already pending';
    end if;

    -- status = 'denied': re-requesting reactivates the same row (and its
    -- existing notification, below) rather than inserting a new one, which
    -- would hit the unique constraint this fix is for.
    update follows set status = v_status, created_at = now()
      where id = v_existing.id
      returning * into v_follow;

    update notifications
      set type = v_notif_type, actor_name = v_voter_name, is_read = false, follow_status = null
      where follow_id = v_follow.id and recipient_id = p_target_id;

    if not found then
      -- Recipient had deleted the original notification -- fall back to a
      -- fresh insert so the reactivated request still notifies them.
      insert into notifications (recipient_id, type, actor_id, actor_name, follow_id, is_read)
      values (p_target_id, v_notif_type, v_uid, v_voter_name, v_follow.id, false);
    end if;
  else
    insert into follows (follower_id, following_id, status)
      values (v_uid, p_target_id, v_status)
      returning * into v_follow;

    insert into notifications (recipient_id, type, actor_id, actor_name, follow_id, is_read)
    values (p_target_id, v_notif_type, v_uid, v_voter_name, v_follow.id, false);
  end if;

  return v_follow;
end;
$$;

alter function request_follow(uuid, uuid) owner to sippd_rpc;
grant execute on function request_follow(uuid, uuid) to authenticated;
