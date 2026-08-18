import { Package } from 'lucide-react';

export default function EmptyState({ icon: Icon = Package, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-display font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground font-body max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}