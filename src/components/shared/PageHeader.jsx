import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import SyncStatus from '@/components/offline/SyncStatus';

// onBack is optional — the five primary tab-bar destinations (Home, Scan,
// Collection, Leaderboard, Profile) never pass it, since they have nowhere
// to "go back" to. Every contextual page reached by a link rather than a
// tab (Achievements, Wishlist, Feed, ...) passes it, so "how do I leave"
// resolves the same way everywhere instead of each page inventing its own
// back affordance (or, as Achievements previously did, hand-rolling an
// entire header from scratch just to get one). (/impeccable critique)
// focusTitle: move focus to the title when this header mounts, for a view
// that swaps in place (Scan's scanner <-> add form), so focus doesn't fall
// back to <body> when the element that had it disappears.
export default function PageHeader({ title, subtitle, action, showBell = true, onBack, focusTitle = false }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user);
  const titleRef = useRef(null);
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle]);

  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-4">
      <div className="flex items-center gap-2 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-11 h-11 -ml-2 rounded-control flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1
            ref={titleRef}
            tabIndex={focusTitle ? -1 : undefined}
            className="text-xl font-display font-bold text-foreground tracking-wide truncate focus:outline-none"
          >
            {title}
          </h1>
          {/* text-foreground, not muted-foreground: on Home and Haul this sits
              on the hero gradient, where muted measured 2.6-3.2:1 (and 80%
              strength still fell to 4.2:1 on Sage). */}
          {subtitle && <p className="text-xs font-mono text-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Offline / syncing / pending / error, quiet when synced (OFFLINE.md). */}
        <SyncStatus />
        {action}
        {showBell && (
          <Link
            to="/notifications"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className="relative h-11 w-11 rounded-control bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 bg-destructive rounded-full flex items-center justify-center text-2xs leading-none font-mono font-bold text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </div>
  );
}
