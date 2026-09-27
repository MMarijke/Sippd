-- Adds the light/dark polarity axis approved for Phase 1's theme system:
-- every theme id now has both a dark and a light rendering (see
-- index.css's "-polarity" counterpart blocks), selected independently of
-- which theme id is active. theme id stays exactly what it already is
-- ('power-up', 'cyberpunk', ...) -- polarity is a separate column that
-- combines with it client-side to resolve the actual [data-theme]
-- [data-polarity] CSS selector, not a doubling of the theme id list.
--
-- Not Pro-gated: profiles_lock_columns()'s existing Pro-lock already
-- covers the theme id itself (a free user still can't set theme to
-- 'cyberpunk' regardless of polarity) -- polarity is just which rendering
-- of whichever theme id you already legitimately have gets shown, so it's
-- freely client-writable like any other cosmetic preference.
--
-- Backfill matches every existing row's theme id to the polarity it
-- already visually is today -- nobody's theme changes appearance from
-- this migration. New signups default to 'dark', matching profiles.theme's
-- own default of 'power-up' (a Neon Arcade / dark theme) -- keeping these
-- two defaults in sync is what stops a fresh signup from rendering as an
-- accidental mismatch (power-up's dark palette with a stray light flag).

alter table profiles add column theme_polarity text;

update profiles set theme_polarity = case
  when theme in ('power-up', 'cyberpunk', 'plasma', 'boss-fight', 'xp-gold', 'synthwave') then 'dark'
  when theme in ('mint-fizz', 'strawberry-cream', 'blue-raspberry', 'lemon-pop', 'peach-soda', 'grape-float') then 'light'
  else 'dark'  -- any row still on a pre-Phase-1 theme id somehow (shouldn't
               -- exist after 20260927000000's backfill, but fail safe rather
               -- than leave theme_polarity null for an edge case row)
end;

alter table profiles alter column theme_polarity set not null;
alter table profiles alter column theme_polarity set default 'dark';

alter table profiles add constraint profiles_theme_polarity_valid check (
  theme_polarity in ('light', 'dark')
);
