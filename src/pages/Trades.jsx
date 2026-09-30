import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import TradeHistory from '@/components/profile/TradeHistory';
import TradeLogDialog from '@/components/profile/TradeLogDialog';

// The full trade ledger, moved off Profile: an unbounded list with four
// filters and per-trade status actions is a working tool, not part of the
// trophy shelf, so Profile now carries a one-line summary that opens this.
// Behaviour is TradeHistory's own, unchanged.
export default function Trades() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showTradeLog, setShowTradeLog] = useState(false);

  // TradeLogDialog picks from your collection. Same query key as Profile's,
  // so arriving from Profile it's already cached.
  const { data: collection = [] } = useQuery({
    queryKey: ['user-collection', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto pb-10">
      <PageHeader title="Trades" showBell={false} onBack={() => navigate(-1)} />
      <TradeHistory userId={user?.id} user={user} onLogTrade={() => setShowTradeLog(true)} hideTitle />
      {showTradeLog && (
        <TradeLogDialog collection={collection} onClose={() => setShowTradeLog(false)} />
      )}
    </div>
  );
}
