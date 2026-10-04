-- The add-can form has always had a "Date Added" field, but nothing stored
-- it: no column existed, so whatever date a collector picked was silently
-- dropped. acquired_on keeps it.
--
-- Nullable: rows from before this column (and any can added without a
-- date) fall back to created_at in the app (src/lib/canDate.js). It's the
-- collector's own record, not a trust signal: scoring, streaks and
-- leaderboard timing stay on created_at, so it's ordinary client-writable
-- data under the existing user_collection RLS (owners only), no guard.
--
-- Not in the future: a day's grace over UTC so a collector ahead of UTC can
-- still enter their own today.

alter table user_collection
  add column if not exists acquired_on date;

alter table user_collection
  drop constraint if exists user_collection_acquired_on_not_future;
alter table user_collection
  add constraint user_collection_acquired_on_not_future
  check (acquired_on is null or acquired_on <= (now() at time zone 'utc')::date + 1);

comment on column user_collection.acquired_on is
  'When the collector got this can (their own date; null = use created_at). Display and ordering only; never used for scoring.';
