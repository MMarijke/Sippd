import { Link, useLocation } from 'react-router-dom';
import { Home, ScanLine, Grid3X3, Trophy, User, Bookmark } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Vault' },
  { path: '/scan', icon: ScanLine, label: 'Scan' },
  { path: '/collection', icon: Grid3X3, label: 'Haul' },
  { path: '/wishlist', icon: Bookmark, label: 'Wishlist' },
  { path: '/leaderboard', icon: Trophy, label: 'Ranks' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-primary/10 neon-glow' : ''}`}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
              </div>
              <span className="text-[10px] font-mono font-medium tracking-wider uppercase">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}