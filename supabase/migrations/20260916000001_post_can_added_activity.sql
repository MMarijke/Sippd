-- activity_items (the table behind /feed and Home's Feed Preview) has had
-- zero writers anywhere -- src/hooks/usePostActivity.js is fully built but
-- never imported or called from anywhere in the app. A DB trigger, not a
-- client call or a second RPC the client has to remember to invoke, is the
-- most robust fix for can_added specifically: it can't be skipped by a
-- buggy or malicious client, needs zero AddCanForm.jsx changes, and is
-- automatically atomic with the collection insert it fires from.
-- (/impeccable critique)
--
-- Gated to status = 'collected' -- wishlist/duplicate adds shouldn't post
-- "added to their vault" (matches ActivityCard.jsx's actual copy).
-- is_private_user and can_rarity are resolved server-side from the real
-- profiles/shared_cans rows rather than trusting the client-writable
-- new.can_rarity snapshot column -- same reasoning as the leaderboard-
-- scoring fix (20260914000000_harden_leaderboard_rarity_trust.sql): that
-- column must never be trusted for anything that becomes visible to other
-- users.

create or replace function post_can_added_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_private boolean;
  v_full_name text;
  v_rarity text;
begin
  if new.status = 'collected' then
    select is_private, full_name into v_is_private, v_full_name from profiles where id = new.owner_id;
    select consensus_rarity into v_rarity from shared_cans where id = new.can_id;

    insert into activity_items (user_id, user_name, type, can_id, can_name, can_image_url, can_rarity, is_private_user)
    values (new.owner_id, coalesce(v_full_name, 'Collector'), 'can_added', new.can_id, new.can_name, new.can_image_url, coalesce(v_rarity, new.can_rarity), coalesce(v_is_private, false));
  end if;
  return new;
end;
$$;

alter function post_can_added_activity() owner to sippd_rpc;

create trigger user_collection_post_can_added
  after insert on user_collection
  for each row execute function post_can_added_activity();
