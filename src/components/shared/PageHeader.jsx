import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

export default function PageHeader({ title, subtitle, action, showBell = true }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user);

  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-4">
      <div>
        <h1 className="text-xl font-display font-bold text-foreground tracking-wide">{title}</h1>
        {subtitle && <p className="text-xs font-mono text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {action}
        {showBell && (
          <Link
            to="/notifications"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className="relative w-11 h-11 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
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
