-- react_to_activity() only ever inserted into reactions and bumped
-- activity_items' counters -- the 'reaction' notification type has a full
-- render case in Notifications.jsx but nothing has ever inserted one.
-- Unlike can_rated/can_confirmed (removed separately -- no bounded, opted-in
-- audience exists for those), this one has a single, obvious, bounded
-- recipient: activity_items.user_id, the person whose post got reacted to.
-- Self-reactions don't notify (no existing guard did this, needed an
-- explicit check). Body otherwise a verbatim copy of the current definition
-- (20260903000001_replace_auth_uid_in_sippd_rpc_functions.sql).

create or replace function react_to_activity(p_caller_id uuid, p_activity_id uuid, p_emoji reaction_emoji)
returns activity_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := sippd_auth_uid();
  v_item activity_items;
  v_actor_name text;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if p_caller_id is distinct from v_uid then
    raise exception 'caller mismatch: % vs %', p_caller_id, v_uid;
  end if;

  begin
    insert into reactions (activity_id, reactor_id, emoji) values (p_activity_id, v_uid, p_emoji);
  exception when unique_violation then
    raise exception 'already reacted to this activity';
  end;

  if p_emoji = 'fire' then
    update activity_items set reactions_fire = reactions_fire + 1 where id = p_activity_id returning * into v_item;
  elsif p_emoji = 'star' then
    update activity_items set reactions_star = reactions_star + 1 where id = p_activity_id returning * into v_item;
  elsif p_emoji = 'wow' then
    update activity_items set reactions_wow = reactions_wow + 1 where id = p_activity_id returning * into v_item;
  end if;

  if not found then
    raise exception 'activity not found';
  end if;

  if v_item.user_id is distinct from v_uid then
    select full_name into v_actor_name from profiles where id = v_uid;
    insert into notifications (recipient_id, type, actor_id, actor_name, activity_id, can_name, emoji, is_read)
    values (v_item.user_id, 'reaction', v_uid, v_actor_name, v_item.id, v_item.can_name, p_emoji::text, false);
  end if;

  return v_item;
end;
$$;

alter function react_to_activity(uuid, uuid, reaction_emoji) owner to sippd_rpc;
grant execute on function react_to_activity(uuid, uuid, reaction_emoji) to authenticated;
