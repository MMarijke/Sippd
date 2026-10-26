import { Link, useLocation } from 'react-router-dom';
import { Home, ScanLine, Grid3X3, Trophy, User } from 'lucide-react';

// Feed used to be a 6th item here. /impeccable critique: six items
// with mono-uppercase labels don't fit a common ~375px phone width without
// being at or past their layout floor ("PROFILE" alone is wider than its
// own icon box) — genuinely crowded, not just visually busy. Feed now
// lives as a tab inside Leaderboard/Ranks (src/pages/Leaderboard.jsx),
// reusing the same segmented-tab pattern already proven there for
// Collectors/Regional/Most Wanted, rather than losing it from the app —
// it's one level deeper, not gone (Home's FeedPreview still surfaces it
// on the primary dashboard too).
//
// Scan and Profile stay unrenamed on purpose, not by oversight — Scan is
// a verb/action rather than a place, and Profile is unambiguous; inventing
// slang for either risked hurting clarity for the sake of voice
// consistency with Vault/Haul/Ranks.
const navItems = [
  { path: '/', icon: Home, label: 'Vault' },
  { path: '/scan', icon: ScanLine, label: 'Scan' },
  { path: '/collection', icon: Grid3X3, label: 'Haul' },
  { path: '/leaderboard', icon: Trophy, label: 'Ranks' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="flex-shrink-0 bg-card/95 backdrop-blur-xl border-t border-border">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              aria-current={isActive ? 'page' : undefined}
              // Active in the full foreground colour, never text-primary: in
              // every light theme and many dark ones the theme's main colour
              // is darker than the muted grey, so the current tab read as the
              // faintest item (30 of 38 renderings, theme critique
              // 2026-10-26). The theme's colour stays in the tinted pill and
              // glow; navActiveTab.test.js guards it for every theme.
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {/* Padded box only for the active state's glow pill now —
                  every item carrying its own box on top of the label
                  (three stacked visual layers) read busier than icon+label
                  alone, compounding the density problem independent of
                  width (/impeccable critique). Inactive items are now a
                  plain icon, so the active state reads as distinct by
                  contrast rather than by addition. */}
              {isActive ? (
                <div className="p-1.5 rounded-lg bg-primary/10 neon-glow">
                  <Icon className="w-5 h-5" strokeWidth={2.5} />
                </div>
              ) : (
                <Icon className="w-5 h-5 m-1.5" strokeWidth={1.5} />
              )}
              <span className="text-2xs font-mono font-medium tracking-wider uppercase">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}