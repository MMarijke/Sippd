-- tick_streak() has called auth.uid() directly since it was created, and was
-- never migrated to sippd_auth_uid() the way its 8 sibling SECURITY DEFINER
-- functions were in 20260903000001_replace_auth_uid_in_sippd_rpc_functions.sql
-- (that migration's own header names exactly which functions it patched
-- after the auth-schema USAGE grant for sippd_rpc silently failed --
-- tick_streak is not on that list). Since it's still owned by sippd_rpc and
-- still calls auth.uid() directly, every call has almost certainly been
-- throwing "permission denied for schema auth" since 2026-09-03 --
-- current_streak has likely not incremented for any user since then.
-- (/impeccable critique)
--
-- Also wires up the streak_milestone activity type while we're here, since
-- it's naturally implemented as part of this same function (it already
-- computes the new streak value and already has the caller's profile row in
-- hand via `returning *`, so no extra query is needed). Thresholds (7, 30)
-- match the only two streak milestones the app already recognizes
-- (achievements.js's streak_7/streak_30, streakIcon.js's 30-day escalation)
-- rather than inventing a new arbitrary schedule.

create or replace function tick_streak(p_caller_id uuid)
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := sippd_auth_uid();
  v_row profiles;
  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := v_today - 1;
  v_new_streak integer;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
  end if;

  select * into v_row from profiles where id = v_uid for update;
  if not found then
    raise exception 'profile not found';
  end if;

  if v_row.last_active_date = v_today then
    return v_row;
  elsif v_row.last_active_date = v_yesterday then
    v_new_streak := v_row.current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  update profiles
  set current_streak = v_new_streak, last_active_date = v_today
  where id = v_uid
  returning * into v_row;

  if v_new_streak in (7, 30) then
    insert into activity_items (user_id, user_name, type, streak_days, is_private_user)
    values (v_uid, coalesce(v_row.full_name, 'Collector'), 'streak_milestone', v_new_streak, coalesce(v_row.is_private, false));
  end if;

  return v_row;
end;
$$;

alter function tick_streak(uuid) owner to sippd_rpc;
grant execute on function tick_streak(uuid) to authenticated;
