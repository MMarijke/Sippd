import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';

export default function ProGate({ reason, children }) {
  const navigate = useNavigate();
  const { isPro, isLoading } = useSubscription();

  if (isLoading) return null;
  if (isPro) return children;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center space-y-3">
      <span className="text-2xl">⚡</span>
      <p className="text-sm font-display font-semibold text-foreground">
        Sippd Pro
      </p>
      <p className="text-xs font-mono text-muted-foreground">
        {reason}
      </p>
      <Button
        onClick={() => navigate('/pro')}
        className="font-mono text-xs bg-primary text-primary-foreground"
      >
        Upgrade to Pro
      </Button>
    </div>
  );
}
