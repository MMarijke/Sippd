-- Multi-beverage expansion: adds soft drink support alongside the existing
-- energy-drink-only scope (alcohol explicitly out of scope, separate future
-- phase needing its own age-verification work).
--
-- Two columns, following two already-established patterns in this schema:
--   - shared_cans.beverage_type is the CANONICAL value, set once by the
--     first contributor and never overwritten afterward -- same pattern
--     already proven for shared_cans.image_url (every vote_on_can()
--     version was traced this session; no UPDATE ever touches it after
--     creation).
--   - user_collection.can_beverage_type is a denormalized per-row snapshot,
--     following the same pattern as can_name/can_brand/can_flavour/
--     can_edition -- editable personalization, not locked by
--     user_collection_lock_columns() (only is_favourite and can_rarity are
--     locked there, since only those two feed scoring/leaderboard trust).
--
-- NOT NULL DEFAULT 'energy_drink' backfills every existing row via the
-- constant default (a single fast metadata change in Postgres 11+, no
-- table rewrite) -- correct given every can in the catalog today actually
-- is an energy drink, not a compromise.

create type beverage_type as enum ('energy_drink', 'soft_drink');

alter table shared_cans
  add column beverage_type beverage_type not null default 'energy_drink';

alter table user_collection
  add column can_beverage_type beverage_type not null default 'energy_drink';
