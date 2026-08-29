import { cn } from '@/lib/utils';

export default function StatBox({ icon, label, value, className, glow }) {
  const Icon = icon;
  return (
    <div className={cn(
      'bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-1',
      glow && 'neon-border',
      className
    )}>
      {Icon && <Icon className="w-5 h-5 text-primary mb-1" />}
      <span className="text-2xl font-mono font-bold text-foreground tabular-nums">
        {value != null ? `${value}` : '0'}
      </span>
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}