import { Link } from 'react-router-dom';
import { Bell, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

// onBack is optional — the five primary tab-bar destinations (Home, Scan,
// Collection, Leaderboard, Profile) never pass it, since they have nowhere
// to "go back" to. Every contextual page reached by a link rather than a
// tab (Achievements, Wishlist, Feed, ...) passes it, so "how do I leave"
// resolves the same way everywhere instead of each page inventing its own
// back affordance (or, as Achievements previously did, hand-rolling an
// entire header from scratch just to get one). (/impeccable critique)
export default function PageHeader({ title, subtitle, action, showBell = true, onBack }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user);

  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-4">
      <div className="flex items-center gap-2 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-11 h-11 -ml-2 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-display font-bold text-foreground tracking-wide truncate">{title}</h1>
          {subtitle && <p className="text-xs font-mono text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {action}
        {showBell && (
          <Link
            to="/notifications"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className="relative h-11 w-11 rounded-md bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center text-[9px] font-mono font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </div>
  );
}
