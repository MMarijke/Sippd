import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import TradeHistory from '@/components/profile/TradeHistory';
import TradeLogDialog from '@/components/profile/TradeLogDialog';
import { useUserCollection } from '@/hooks/useUserCollection';

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
  const { data: collection = [] } = useUserCollection();

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
