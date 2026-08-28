import { Pencil, Trash2 } from 'lucide-react';

export default function CrateCard({ crate, collection, onClick, onEdit, onDelete }) {
  const canCount = (crate.can_ids || []).filter(id => collection.some(c => c.id === id)).length;

  // Pick up to 3 can images for preview
  const previewItems = (crate.can_ids || [])
    .slice(0, 3)
    .map(id => collection.find(c => c.id === id))
    .filter(Boolean);

  return (
    <div
      onClick={onClick}
      className="relative bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 hover:bg-card/80 transition-all active:scale-[0.98]"
    >
      {/* Action buttons */}
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          onClick={onEdit}
          className="w-6 h-6 rounded-md bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="w-6 h-6 rounded-md bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Emoji + name */}
      <div className="text-2xl mb-2">{crate.emoji || '📦'}</div>
      <p className="text-sm font-display font-semibold text-foreground leading-tight pr-8 truncate">{crate.name}</p>
      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{canCount} can{canCount !== 1 ? 's' : ''}</p>

      {/* Mini preview images */}
      {previewItems.length > 0 && (
        <div className="flex gap-1 mt-3">
          {previewItems.map(item => (
            <div
              key={item.id}
              className="w-8 h-8 rounded-lg overflow-hidden border border-border flex-shrink-0"
              style={{ background: item.can_bg_color || '#0D2B2B' }}
            >
              {item.can_image_url && (
                <img src={item.can_image_url} alt={item.can_name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}