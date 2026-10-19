-- Retires Moss (Botanical). It sat within reach of three Spring themes
-- (CIEDE2000 to Pistachio 3.1, Butter 5.3, Olive 6.7), so it read as a
-- duplicate in the picker. Existing users move to its closest remaining
-- match, Spring Olive: also light and also Pro, so no one's Pro status or
-- light/dark changes. (Checked 2026-10-19: no profile is on Moss; this is
-- the guard.)
--
-- Backfill runs before narrowing the constraint; it runs as postgres, which
-- profiles_lock_columns() exempts. retired_theme (added in 20260929000000)
-- drives Settings' one-time "your theme was retired" note. The lock function
-- is untouched (Moss was never on its free list).

update profiles set retired_theme = 'moss', theme = 'spring-olive' where theme = 'moss';

alter table profiles drop constraint profiles_theme_valid;

alter table profiles add constraint profiles_theme_valid check (
  theme in (
    -- Neon Arcade
    'power-up', 'cyberpunk', 'plasma', 'boss-fight', 'synthwave',
    -- Cosmic
    'moonlight', 'nebula', 'solar-flare', 'aurora', 'deep-space', 'stellar-gold',
    -- Botanical
    'sage', 'forest', 'fern', 'meadow',
    -- Noir
    'carbon', 'crimson', 'amethyst', 'sapphire', 'emerald', 'silver-screen',
    -- Candy
    'bubblegum', 'blue-pop', 'grape-candy', 'orange-crush', 'sour-apple', 'cherry-pop',
    -- Spring
    'spring-plum', 'spring-brick', 'spring-coral', 'spring-butter', 'spring-pistachio', 'spring-olive'
  )
);
