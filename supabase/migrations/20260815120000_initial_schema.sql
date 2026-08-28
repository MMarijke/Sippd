-- Sippd initial schema: enums + tables only. No RLS, no triggers, no RPCs here —
-- those live in 20260815120100_security.sql so the data model and the security
-- layer can be reviewed separately.
--
-- NOT APPLIED ANYWHERE. Draft for review.
--
-- Source of truth for this translation: the original app's entity/*.jsonc
-- schema declarations plus the actual client code that reads/writes each
-- field (the .jsonc files under-declare some fields — e.g. User.jsonc omits
-- `is_private` and `notify_rare_follows`, which only show up in Settings.jsx).
--
-- Deliberately omitted: the `Achievement` entity. It existed in the original
-- app's entity declarations but was never referenced anywhere in src/ (zero
-- call sites) — achievements are fully defined in src/lib/achievements.js
-- as a hardcoded list. Porting a dead table seemed worse than flagging it; say
-- the word if you want it anyway (e.g. to make achievements admin-editable later).

-- ── Enums ────────────────────────────────────────────────────────────────────

create type rarity_tier as enum ('Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary');

create type can_confidence as enum ('unrated', 'low', 'confirmed');

create type collection_status as enum ('collected', 'wishlist', 'duplicate');

create type user_role as enum ('admin', 'user');

-- The original app's Follow.jsonc only declares pending/accepted, but
-- Notifications.jsx writes status: 'denied' on decline. Enum matches actual
-- runtime behavior, not the incomplete declared schema.
create type follow_status as enum ('pending', 'accepted', 'denied');

create type notification_type as enum (
  'new_follower', 'follow_request', 'reaction', 'can_rated', 'can_confirmed',
  'trade_request', 'trade_response', 'trade_status_update', 'rare_pull_follow'
);

create type trade_request_status as enum ('pending', 'accepted', 'declined');

create type trade_log_status as enum ('pending', 'completed', 'cancelled');

create type reaction_emoji as enum ('fire', 'star', 'wow');

-- ── profiles (1:1 with auth.users) ──────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role user_role not null default 'user',                 -- LOCKED, see security migration
  is_private boolean not null default false,
  notify_rare_follows boolean not null default false,
  current_streak integer not null default 0,               -- LOCKED
  last_active_date date,                                    -- LOCKED
  created_at timestamptz not null default now()
);

comment on column profiles.role is 'Client-writable only via the column-lockdown trigger exception for the sippd_rpc role / service_role.';
comment on column profiles.current_streak is 'Server-computed only, via tick_streak(). Never trust a client-submitted streak value.';

-- ── shared_cans (global catalog + community vote aggregates) ───────────────

create table shared_cans (
  id uuid primary key default gen_random_uuid(),
  barcode text,
  name text not null,
  brand text not null,
  flavour text,
  edition text,
  image_url text,
  contributed_by text,                                      -- display-name snapshot, as today
  rarity rarity_tier not null default 'Common',              -- legacy/manual field, kept for cans with no votes yet
  common_votes integer not null default 0,                   -- LOCKED (all vote/aggregate columns below)
  uncommon_votes integer not null default 0,
  rare_votes integer not null default 0,
  ultra_rare_votes integer not null default 0,
  legendary_votes integer not null default 0,
  total_votes integer not null default 0,
  consensus_rarity rarity_tier not null default 'Common',
  confidence can_confidence not null default 'unrated',
  community_favourites integer not null default 0,
  created_at timestamptz not null default now()
);

-- Prevents duplicate SharedCan rows for the same physical barcode. Partial +
-- unique (not a plain column UNIQUE) because barcode is optional — manually
-- added cans have no barcode at all, and vote_on_can() normalizes '' to NULL
-- before insert so blank values never collide with each other.
create unique index shared_cans_barcode_unique_idx on shared_cans (barcode) where barcode is not null;
create index shared_cans_name_brand_idx on shared_cans using gin (to_tsvector('simple', name || ' ' || brand));

-- ── rarity_votes (one vote per user per can) ────────────────────────────────

create table rarity_votes (
  id uuid primary key default gen_random_uuid(),
  can_id uuid not null references shared_cans (id) on delete cascade,
  voter_id uuid not null references profiles (id) on delete cascade,
  voted_rarity rarity_tier not null,
  created_at timestamptz not null default now(),
  unique (can_id, voter_id)   -- the DB now enforces "one vote per can" atomically;
                              -- today's app only checks this client-side before submitting
);

-- ── user_collection ──────────────────────────────────────────────────────────

create table user_collection (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  can_id uuid not null references shared_cans (id) on delete restrict,
  status collection_status not null default 'collected',
  notes text,
  can_name text,
  can_brand text,
  can_image_url text,
  can_rarity rarity_tier,
  can_flavour text,
  can_edition text,
  can_bg_color text not null default '#0D2B2B',
  is_favourite boolean not null default false,               -- LOCKED, see note below
  user_rarity_vote rarity_tier,
  created_at timestamptz not null default now()
);

comment on column user_collection.is_favourite is 'Locked not for confidentiality (it is the owner''s own row) but for atomicity: toggling it must stay in lockstep with shared_cans.community_favourites, so it only changes via toggle_favourite().';

create index user_collection_owner_idx on user_collection (owner_id);
create index user_collection_can_idx on user_collection (can_id);

-- ── crates ───────────────────────────────────────────────────────────────────

create table crates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  emoji text not null default '📦',
  can_ids uuid[] not null default '{}',   -- array of user_collection.id, as today; not FK-enforced per-element
  created_at timestamptz not null default now()
);

create index crates_owner_idx on crates (owner_id);

-- ── follows ──────────────────────────────────────────────────────────────────

create table follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references profiles (id) on delete cascade,
  following_id uuid not null references profiles (id) on delete cascade,
  status follow_status not null default 'accepted',
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_follower_idx on follows (follower_id);
create index follows_following_idx on follows (following_id);

-- ── notifications ────────────────────────────────────────────────────────────
-- Keeps the current design of overloading one table for the inbox AND the
-- trade-request/response exchange (rather than splitting out a trade_requests
-- table) to match existing behavior. Worth reconsidering later, but not a
-- decision to make silently inside a schema migration.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  type notification_type not null,
  actor_id uuid references profiles (id) on delete set null,
  actor_name text,
  follow_id uuid references follows (id) on delete set null,
  activity_id uuid,                                        -- FK added once activity_items exists, see below
  can_id uuid references shared_cans (id) on delete set null,
  can_name text,
  can_brand text,
  can_rarity text,
  can_image_url text,
  emoji text,
  is_read boolean not null default false,
  follow_status text,                                        -- LOCKED
  trade_offer_can_name text,
  trade_offer_can_brand text,
  trade_offer_can_rarity text,
  trade_want_can_name text,
  trade_want_can_brand text,
  trade_want_can_rarity text,
  trade_message text,
  trade_status trade_request_status,                          -- LOCKED
  trade_response_text text,
  trade_new_status text,
  trade_id uuid,                                             -- FK added once trades exists, see below
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (recipient_id, created_at desc);

-- ── activity_items (public/followers feed) ──────────────────────────────────

create table activity_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  user_name text,
  type text not null check (type in ('can_added', 'rarity_voted', 'achievement_unlocked', 'streak_milestone')),
  can_id uuid references shared_cans (id) on delete set null,
  can_name text,
  can_image_url text,
  can_rarity text,
  achievement_key text,
  achievement_title text,
  achievement_icon text,
  streak_days integer,
  is_private_user boolean not null default false,
  reactions_fire integer not null default 0,                  -- LOCKED (flagged below — not on your list)
  reactions_star integer not null default 0,
  reactions_wow integer not null default 0,
  created_at timestamptz not null default now()
);

create index activity_items_created_idx on activity_items (created_at desc);
create index activity_items_user_idx on activity_items (user_id);

alter table notifications add constraint notifications_activity_id_fkey
  foreign key (activity_id) references activity_items (id) on delete set null;

-- ── reactions ────────────────────────────────────────────────────────────────

create table reactions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activity_items (id) on delete cascade,
  reactor_id uuid not null references profiles (id) on delete cascade,
  emoji reaction_emoji not null,
  created_at timestamptz not null default now(),
  unique (activity_id, reactor_id)   -- assumption: one reaction per user per post (not stated
                                      -- explicitly anywhere in the original export) — flag if wrong
);

-- ── trades (personal trade log — added per your request) ───────────────────

create table trades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  traded_away_id uuid references user_collection (id) on delete set null,
  traded_away_name text not null,
  traded_away_brand text,
  traded_away_image_url text,
  traded_away_rarity text,
  received_id uuid references user_collection (id) on delete set null,
  received_name text not null,
  received_brand text,
  received_image_url text,
  received_rarity text,
  traded_with text,
  traded_with_id uuid references profiles (id) on delete set null,
  notes text,
  trade_date date,
  status trade_log_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index trades_owner_idx on trades (owner_id);

-- ── trade_templates (added per your request) ────────────────────────────────

create table trade_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  traded_away_id uuid references user_collection (id) on delete set null,
  traded_away_name text,
  traded_away_brand text,
  traded_away_image_url text,
  traded_away_rarity text,
  received_id uuid references user_collection (id) on delete set null,
  received_name text,
  received_brand text,
  received_image_url text,
  received_rarity text,
  notes text,
  created_at timestamptz not null default now()
);

create index trade_templates_owner_idx on trade_templates (owner_id);

alter table notifications add constraint notifications_trade_id_fkey
  foreign key (trade_id) references trades (id) on delete set null;
