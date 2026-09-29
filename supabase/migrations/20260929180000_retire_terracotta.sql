-- Retires Terracotta (Botanical). Existing users move to its closest
-- remaining match, Noir's Crimson: the same muted dark red-brick feel,
-- also dark-only and also Pro, so no one's Pro status or light/dark
-- changes. Backfill runs before narrowing the constraint; it runs as
-- postgres, which profiles_lock_columns() exempts. The lock function is
-- untouched (Terracotta was never on its free list).

-- retired_theme (added in 20260929000000) drives Settings' one-time
-- "your theme was retired" note.
update profiles set retired_theme = 'terracotta', theme = 'crimson' where theme = 'terracotta';

alter table profiles drop constraint profiles_theme_valid;

alter table profiles add constraint profiles_theme_valid check (
  theme in (
    -- Neon Arcade
    'power-up', 'cyberpunk', 'plasma', 'boss-fight', 'synthwave',
    -- Cosmic
    'moonlight', 'nebula', 'solar-flare', 'aurora', 'deep-space', 'stellar-gold',
    -- Botanical
    'sage', 'forest', 'fern', 'moss', 'meadow',
    -- Noir
    'carbon', 'crimson', 'amethyst', 'sapphire', 'emerald', 'silver-screen',
    -- Candy
    'bubblegum', 'blue-pop', 'grape-candy', 'orange-crush', 'sour-apple', 'cherry-pop'
  )
);
