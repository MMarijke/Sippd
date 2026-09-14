import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Was an unedited light-mode scaffold page (bg-slate-50, raw inline SVG icon)
// in an otherwise fully dark/neon, carefully tokened app — a real visitor
// hitting a bad link landed on a visually foreign screen. Rebuilt with the
// app's own tokens/components to match every other empty/error state
// (EmptyState.jsx's icon-tile-in-a-circle + font-display/font-mono pattern).
export default function PageNotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageName = location.pathname.slice(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-xs w-full flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <Compass className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">404</p>
        <h1 className="text-lg font-display font-bold text-foreground mb-2">Page Not Found</h1>
        <p className="text-sm text-muted-foreground font-body mb-6">
          {pageName ? (
            <>Couldn't find <span className="font-semibold text-foreground/80">"{pageName}"</span>.</>
          ) : (
            'Couldn’t find that page.'
          )}
        </p>
        <Button
          onClick={() => navigate('/')}
          className="h-11 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Home className="w-4 h-4" /> Back to Vault
        </Button>
      </div>
    </div>
  );
}
