-- Backend audit follow-up (2026-10-26): what public_profiles shows, and to
-- whom. Additive: a view redefinition (same columns, same types), one new
-- read-only function, grants. No data touched.
--
-- 1. A private profile's streak and join date were readable by anyone.
--    They now come back null unless the viewer is that user or an accepted
--    follower, the same rule PublicProfile.jsx's canViewContent applies on
--    screen. Name and is_private stay visible to everyone signed in:
--    Find Collectors and the trade log list every collector so people can
--    find and follow (request to follow) private accounts. The view still
--    runs as its owner, so the follows check isn't limited by follows' RLS;
--    auth.uid() is still the caller's (it reads the request's JWT).
create or replace view public.public_profiles as
select
  p.id,
  p.full_name,
  p.is_private,
  case
    when p.is_private
         and p.id is distinct from auth.uid()
         and not exists (select 1 from public.follows f
                         where f.follower_id = auth.uid()
                           and f.following_id = p.id
                           and f.status = 'accepted')
      then null
    when p.last_active_date >= (now() at time zone 'utc')::date - 1 then p.current_streak
    else 0
  end as current_streak,
  case
    when p.is_private
         and p.id is distinct from auth.uid()
         and not exists (select 1 from public.follows f
                         where f.follower_id = auth.uid()
                           and f.following_id = p.id
                           and f.status = 'accepted')
      then null
    else p.created_at
  end as created_at
from public.profiles p;

-- 2. Signed-out visitors could list every user (select * on the view).
--    What they actually need is one profile by id: the public profile page
--    (/u/:id), middleware.js's link preview and api/og's image. That moves
--    to get_public_profile(id), and the anon role loses the view itself.
--    Signed-in users keep the view (Find Collectors, trade log, compare).
create or replace function public.get_public_profile(p_profile_id uuid)
returns setof public.public_profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.public_profiles where id = p_profile_id;
$$;

-- Same ownership pattern as the project's other RPCs (NOLOGIN sippd_rpc).
grant select on public.public_profiles to sippd_rpc;
alter function public.get_public_profile(uuid) owner to sippd_rpc;
revoke execute on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

revoke select on public.public_profiles from anon;
