import { cn } from '@/lib/utils';

export default function StatBox({ icon, label, value, className, glow, isLoading }) {
  const Icon = icon;
  return (
    <div className={cn(
      'bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-1',
      glow && 'neon-border',
      className
    )}>
      {Icon && <Icon className="w-5 h-5 text-primary mb-1" />}
      {/* A literal '—' placeholder here read as visible clutter rather
          than "still loading" — a skeleton bar says the same thing
          without ever putting a dash on screen, and (unlike falling back
          to '0') doesn't risk flashing a real returning user's stat as
          zero for a beat before the true value arrives. */}
      {isLoading ? (
        <span className="h-6 w-8 rounded bg-secondary/60 animate-pulse" />
      ) : (
        <span className="text-2xl font-mono font-bold text-foreground tabular-nums">
          {value != null ? `${value}` : '0'}
        </span>
      )}
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}