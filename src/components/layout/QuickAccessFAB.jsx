import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ScanLine, ArrowLeftRight, Zap, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function QuickAccessFAB() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const longPressTimer = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: notifications = [] } = useQuery({
    queryKey: ['fab-trade-notifs', user?.id],
    queryFn: () => base44.entities.Notification.filter({ recipient_id: user.id, type: 'trade_request', is_read: false }),
    enabled: !!user?.id,
  });

  const pendingTrades = notifications.length;

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => setOpen(true), 400);
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleClick = () => {
    if (isHome) { navigate('/scan'); return; }
    if (!open) setOpen(true);
  };

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest('[data-fab]')) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  return (
    <div data-fab className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
      {/* Menu items */}
      {open && (
        <div className="flex flex-col items-end gap-2 mb-1">
          {/* Trade requests */}
          <button
            onClick={() => go('/notifications')}
            className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 shadow-lg hover:border-primary/40 transition-colors"
          >
            <span className="text-xs font-mono text-foreground whitespace-nowrap">
              Trade Requests
              {pendingTrades > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingTrades}
                </span>
              )}
            </span>
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Scanner */}
          <button
            onClick={() => go('/scan')}
            className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 shadow-lg hover:border-primary/40 transition-colors"
          >
            <span className="text-xs font-mono text-foreground whitespace-nowrap">Scanner</span>
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <ScanLine className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      )}

      {/* FAB button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
        className={`w-12 h-12 rounded-full border shadow-lg flex items-center justify-center transition-all duration-200 select-none
          ${open
            ? 'bg-primary text-primary-foreground border-primary neon-glow'
            : 'bg-card border-primary/40 text-primary hover:bg-primary/10'
          }`}
      >
        {open ? <X className="w-5 h-5" /> : isHome ? <ScanLine className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
        {!open && pendingTrades > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
            {pendingTrades}
          </span>
        )}
      </button>
    </div>
  );
}