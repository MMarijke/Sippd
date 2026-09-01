import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const EMOJIS = ['📦', '🔥', '⭐', '💎', '🏆', '🌊', '🎯', '🍋', '🧊', '🌈', '🎃', '🚀'];

export default function CrateFormDialog({ crate, onClose, userId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState(crate?.name || '');
  const [description, setDescription] = useState(crate?.description || '');
  const [emoji, setEmoji] = useState(crate?.emoji || '📦');

  const isEdit = !!crate;

  const mutation = useMutation({
    mutationFn: async () => {
      const data = { name: name.trim(), description: description.trim(), emoji };
      if (isEdit) {
        const { error } = await supabase.from('crates').update(data).eq('id', crate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crates').insert({ ...data, owner_id: userId, can_ids: [] });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crates', userId] });
      toast.success(isEdit ? 'Crate updated!' : 'Crate created!');
      onClose();
    },
    onError: (error) => {
      if (error?.message?.includes('crate_limit_reached')) {
        toast.error('Free plan is limited to 5 crates — upgrade to Pro for unlimited crates');
        onClose();
        navigate('/pro');
      } else {
        toast.error(`Failed to ${isEdit ? 'update' : 'create'} crate: ` + (error.message || 'Unknown error'));
      }
    },
  });

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="bottom"
        hideClose
        className="max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl p-6 space-y-5"
      >
        <SheetDescription className="sr-only">
          {isEdit ? 'Edit the name, icon, and description of this crate.' : 'Create a new crate to organize a subset of your collection.'}
        </SheetDescription>
        <div className="flex items-center justify-between">
          <SheetTitle asChild>
            <h2 className="text-base font-display font-bold text-foreground">{isEdit ? 'Edit Crate' : 'New Crate'}</h2>
          </SheetTitle>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
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
          <p className="text-xs font-mono text-muted-foreground mb-1.5">Description <span className="text-muted-foreground">(optional)</span></p>
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
      </SheetContent>
    </Sheet>
  );
}
