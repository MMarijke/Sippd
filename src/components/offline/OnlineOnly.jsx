import { CloudOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useOnline } from '@/hooks/useOnline';
import { useAuth } from '@/lib/AuthContext';

// Wraps a route that only makes sense live: other collectors, the feed,
// rankings, notifications, trade requests (never queued: a queued trade can
// clash with the other person's state). Offline it says so plainly, and the
// actions inside are simply not reachable, instead of a page that hangs on a
// spinner or fails silently. Back online, the page appears by itself.
export default function OnlineOnly({ feature, children }) {
  const online = useOnline();
  const { user } = useAuth();
  const navigate = useNavigate();
  if (online) return children;

  return (
    <div className="min-h-[60dvh] flex items-center justify-center px-5 py-10">
      <div role="status" className="max-w-xs text-center space-y-3">
        <CloudOff className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" />
        <h1 className="text-base font-display font-semibold text-foreground">You're offline</h1>
        <p className="text-sm text-muted-foreground">
          {feature} needs a connection.{user ? ' Your collection, wishlist and profile still work offline.' : ''}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          {user && (
            <Button asChild className="h-11 font-mono text-xs">
              <Link to="/collection">Go to your collection</Link>
            </Button>
          )}
          <Button variant="outline" className="h-11 font-mono text-xs" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
