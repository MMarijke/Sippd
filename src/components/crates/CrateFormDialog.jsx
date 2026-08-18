import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const EMOJIS = ['📦', '🔥', '⭐', '💎', '🏆', '🌊', '🎯', '🍋', '🧊', '🌈', '🎃', '🚀'];

export default function CrateFormDialog({ crate, onClose, userId }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(crate?.name || '');
  const [description, setDescription] = useState(crate?.description || '');
  const [emoji, setEmoji] = useState(crate?.emoji || '📦');

  const isEdit = !!crate;

  const mutation = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), description: description.trim(), emoji };
      return isEdit
        ? base44.entities.Crate.update(crate.id, data)
        : base44.entities.Crate.create({ ...data, can_ids: [] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crates', userId] });
      toast.success(isEdit ? 'Crate updated!' : 'Crate created!');
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card border-t border-border rounded-t-3xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-display font-bold text-foreground">{isEdit ? 'Edit Crate' : 'New Crate'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Emoji picker */}
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-2">Icon</p>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all ${
                  emoji === e ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:border-primary/40'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1.5">Name <span className="text-destructive">*</span></p>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Rare Finds, Summer Editions..."
            className="bg-secondary border-border font-body"
            maxLength={40}
          />
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1.5">Description <span className="text-muted-foreground/50">(optional)</span></p>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short description..."
            className="bg-secondary border-border font-body"
            maxLength={80}
          />
        </div>

        <Button
          className="w-full font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!name.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Crate'}
        </Button>
      </div>
    </div>
  );
}