import { Pencil, Trash2 } from 'lucide-react';
import { rarityTileBackground } from '@/lib/canBgColors';

export default function CrateCard({ crate, collection, onClick, onEdit, onDelete }) {
  const canCount = (crate.can_ids || []).filter(id => collection.some(c => c.id === id)).length;

  // Pick up to 3 can images for preview
  const previewItems = (crate.can_ids || [])
    .slice(0, 3)
    .map(id => collection.find(c => c.id === id))
    .filter(Boolean);

  return (
    <div className="relative bg-card border border-border rounded-2xl hover:border-primary/30 hover:bg-card/80 transition-all">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-4 active:scale-[0.98] transition-transform"
      >
        {/* Emoji + name */}
        <div className="text-2xl mb-2">{crate.emoji || '📦'}</div>
        <p className="text-sm font-display font-semibold text-foreground leading-tight pr-24 truncate">{crate.name}</p>
        <p className="text-2xs font-mono text-muted-foreground mt-0.5">{canCount} can{canCount !== 1 ? 's' : ''}</p>

        {/* Mini preview images */}
        {previewItems.length > 0 && (
          <div className="flex gap-1 mt-3">
            {previewItems.map(item => (
              <div
                key={item.id}
                className="w-8 h-8 rounded-lg overflow-hidden border border-border flex-shrink-0"
                style={{ background: rarityTileBackground(item.can_rarity) }}
              >
                {item.can_image_url && (
                  <img src={item.can_image_url} alt={item.can_name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                )}
              </div>
            ))}
          </div>
        )}
      </button>

      {/* Action buttons — siblings of the open-crate button, not nested inside
          it, so they're not invalid nested interactive elements and clicking
          them can't also bubble into the open-crate handler. */}
      <div className="absolute top-1 right-1 flex">
        <button
          onClick={onEdit}
          aria-label="Edit crate"
          className="w-11 h-11 rounded-md bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete crate"
          className="w-11 h-11 rounded-md bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}