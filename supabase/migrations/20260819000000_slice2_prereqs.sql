-- Slice 2 (social/profile) prerequisites. NOT APPLIED — draft for review,
-- same as every other migration in this project.

-- Extend public_profiles for PublicProfile.jsx (streak + join date — both
-- were already publicly visible under Base44's full User.list() read, just
-- narrower now: still no email, role, or other sensitive column).
create or replace view public_profiles as
select id, full_name, is_private, current_streak, created_at
from profiles;

-- Required for useNotifications.js's Realtime subscription to fire at all —
-- no table is in the realtime publication by default.
alter publication supabase_realtime add table notifications;
