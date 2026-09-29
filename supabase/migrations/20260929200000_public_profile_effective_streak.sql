-- public_profiles.current_streak exposed the STORED streak, which only
-- changes when its owner opens the app (tick_streak() resets it then). So a
-- collector who stopped visiting kept showing their old streak to everyone
-- else indefinitely -- a 40-day streak abandoned a month ago still read 40
-- on their shared profile, while their own Profile (which ticks) read 1.
--
-- Apply tick_streak()'s own lapse rule in the view: the streak is alive
-- only if last_active_date is today or yesterday in UTC (the same
-- `(now() at time zone 'utc')::date` basis tick_streak uses); otherwise it
-- has lapsed and reads 0. The profiles row itself is untouched; tick_streak
-- still owns the write.
--
-- Same columns, names, types and order, so `create or replace` keeps the
-- existing grants (authenticated, anon) and nothing reading the view breaks.

create or replace view public_profiles as
select
  id,
  full_name,
  is_private,
  case
    when last_active_date >= (now() at time zone 'utc')::date - 1 then current_streak
    else 0
  end as current_streak,
  created_at
from profiles;
