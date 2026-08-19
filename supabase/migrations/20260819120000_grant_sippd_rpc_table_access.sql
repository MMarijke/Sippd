-- BYPASSRLS never granted table-level DML — that's a separate privilege layer.
-- sippd_rpc was created NOINHERIT with no explicit table grants anywhere,
-- so every SECURITY DEFINER function it owns has been missing this since
-- the original security migration.
grant select, insert, update, delete on
  profiles,
  shared_cans,
  rarity_votes,
  user_collection,
  crates,
  follows,
  notifications,
  activity_items,
  reactions,
  trades,
  trade_templates
to sippd_rpc;
