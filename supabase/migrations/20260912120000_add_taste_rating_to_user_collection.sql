-- Personal taste rating (1-10 stars) for a collected can. Same shape as
-- pinned_at (20260831000000): a personal, non-aggregate preference that
-- nothing else needs to stay in lockstep with, so it's a plain
-- client-writable column under the existing user_collection RLS policy
-- (owner_id = auth.uid()) -- no lock trigger or RPC needed. Deliberately
-- excluded from score/leaderboard calculations (rarityConsensus.js) --
-- this is a subjective opinion on flavour, not a competitive stat, and
-- letting it affect Score would make Score gameable by self-rating.

alter table user_collection add column taste_rating smallint
  constraint user_collection_taste_rating_range check (taste_rating is null or taste_rating between 1 and 10);

comment on column user_collection.taste_rating is 'Owner''s personal 1-10 taste rating for this can; null = not rated. Purely personal — never factors into Score or any aggregate/leaderboard calculation.';
