import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { openCheckout, PADDLE_MONTHLY_PRICE_ID, PADDLE_ANNUAL_PRICE_ID } from '@/lib/paddle';
import { toast } from 'sonner';
import LegalFooter from '@/components/legal/LegalFooter';

const FEATURES = [
  'Unlimited crates (free: 5 crates, 10 cans each)',
  'Unlimited barcode scans (free: 10/day)',
  '5 exclusive themes — Steel, Verdant, Cobalt, Voidglass, Aurora',
  'Pro badge on your profile, leaderboard, and feed posts',
  'Bigger pinned showcase (10 vs. 6) with a hero spotlight slot',
  'Support indie development',
];

export default function Pro() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, paddleCustomerId } = useSubscription();
  const [loadingPriceId, setLoadingPriceId] = useState(null);

  const handleCheckout = async (priceId) => {
    if (!priceId) {
      toast.error('Pricing is not configured yet — check back soon.');
      return;
    }
    if (loadingPriceId) return;
    setLoadingPriceId(priceId);
    try {
      await openCheckout(priceId, user, paddleCustomerId);
    } catch (e) {
      toast.error('Could not open checkout: ' + (e.message || 'Unknown error'));
    } finally {
      setLoadingPriceId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-border">
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center border border-border">
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <div>
          <h1 className="text-base font-display font-bold text-foreground tracking-wide">Sippd Pro</h1>
          <p className="text-[11px] font-mono text-muted-foreground">The serious collector's toolkit</p>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-6">
        {isPro ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center space-y-2">
            <Zap className="w-6 h-6 text-primary mx-auto" />
            <p className="text-sm font-display font-semibold text-foreground">You're already on Pro</p>
            <p className="text-xs font-mono text-muted-foreground">Thanks for supporting Sippd.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {FEATURES.map(feature => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-body text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <Button
                onClick={() => handleCheckout(PADDLE_MONTHLY_PRICE_ID)}
                disabled={!!loadingPriceId}
                className="w-full font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loadingPriceId === PADDLE_MONTHLY_PRICE_ID
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : 'Monthly — $2.99/mo'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCheckout(PADDLE_ANNUAL_PRICE_ID)}
                disabled={!!loadingPriceId}
                className="w-full font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                {loadingPriceId === PADDLE_ANNUAL_PRICE_ID
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : 'Annual — $19.99/yr'}
              </Button>
            </div>

            {/* Right where the purchase decision is made — Paddle's own
                verification checks for Terms/Refund being reachable from
                the checkout flow, not just buried in a footer elsewhere. */}
            <LegalFooter className="pt-2" />
          </>
        )}
      </div>
    </div>
  );
}
