import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

// The only persistent, page-independent shortcut to trade requests — Scan
// already has its own BottomNav tab everywhere, so this FAB doesn't duplicate
// it. Single purpose, single tap, no hidden gestures.
export default function QuickAccessFAB() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: notifications = [] } = useQuery({
    queryKey: ['fab-trade-notifs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .eq('type', 'trade_request')
        .eq('is_read', false);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const pendingTrades = notifications.length;

  return (
    <button
      onClick={() => navigate('/notifications')}
      aria-label={pendingTrades > 0 ? `Trade requests, ${pendingTrades} pending` : 'Trade requests'}
      className={`fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full border shadow-lg flex items-center justify-center transition-colors
        ${pendingTrades > 0
          ? 'bg-primary/10 text-primary border-primary neon-glow'
          : 'bg-card border-primary/40 text-primary hover:bg-primary/10'
        }`}
    >
      <ArrowLeftRight className="w-5 h-5" />
      {pendingTrades > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
          {pendingTrades}
        </span>
      )}
    </button>
  );
}
