import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Zap is already Pro's visual identity (Pro.jsx's own hero icon) — reused
// here rather than introducing a second "this means Pro" symbol.
export default function ProBadge({ className }) {
  return (
    <span
      role="img"
      aria-label="Pro subscriber"
      title="Pro subscriber"
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 text-primary flex-shrink-0',
        className
      )}
    >
      <Zap className="w-2.5 h-2.5 fill-primary" />
    </span>
  );
}
