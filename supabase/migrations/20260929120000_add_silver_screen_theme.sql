-- Adds Silver Screen (Noir family, Pro): a black-and-white movie theme.
-- See src/index.css for its token values.
--
-- Only widens the allowed set, so no backfill. profiles_lock_columns() is
-- unchanged: its free list names the free ids explicitly, so any id not on
-- it -- this one included -- is Pro-locked by default.

alter table profiles drop constraint profiles_theme_valid;

alter table profiles add constraint profiles_theme_valid check (
  theme in (
    -- Neon Arcade
    'power-up', 'cyberpunk', 'plasma', 'boss-fight', 'synthwave',
    -- Cosmic
    'moonlight', 'nebula', 'solar-flare', 'aurora', 'deep-space', 'stellar-gold',
    -- Botanical
    'sage', 'forest', 'fern', 'moss', 'terracotta', 'meadow',
    -- Noir
    'carbon', 'crimson', 'amethyst', 'sapphire', 'emerald', 'silver-screen',
    -- Candy
    'bubblegum', 'blue-pop', 'grape-candy', 'orange-crush', 'sour-apple', 'cherry-pop'
  )
);
