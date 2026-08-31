-- Pin cans to the Profile page's Top Pulls showcase (design brief
-- confirmed via /impeccable shape). Unlike is_favourite, nothing else
-- needs to stay in lockstep with this — it's a personal, non-aggregate
-- preference, so it's a plain client-writable column under the existing
-- user_collection RLS policies (owner_id = auth.uid()). No lock trigger
-- or RPC needed.

alter table user_collection add column pinned_at timestamptz;

comment on column user_collection.pinned_at is 'When the user pinned this can to their Top Pulls showcase; null = not pinned. Ordering pinned cans by this timestamp gives pin order. Capped at 6 client-side.';
