import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Upload, Link as LinkIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RARITY_ORDER } from '@/lib/rarityConsensus';
import { DEFAULT_CAN_BG } from '@/lib/canBgColors';
import CanBackgroundPicker from '@/components/shared/CanBackgroundPicker';
import TasteRatingStars from '@/components/shared/TasteRatingStars';
import BeverageTypeToggle from '@/components/shared/BeverageTypeToggle';

const STATUS_OPTIONS = [
  { value: 'collected', label: 'Collected' },
  { value: 'wishlist',  label: 'Wishlist'  },
  { value: 'duplicate', label: 'Duplicate' },
];

export default function EditEntrySheet({ open, onClose, item, myVote, sharedCan, onBarcodeAdded }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [imageMode, setImageMode] = useState('upload');
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage
        .from('can-images')
        .upload(fileName, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('can-images')
        .getPublicUrl(fileName);
      update('can_image_url', publicUrl);
    } catch (err) {
      toast.error('Failed to upload image');
    }
    setUploading(false);
  };

  const [form, setForm] = useState({
    status:    item?.status    || 'collected',
    notes:     item?.notes     || '',
    can_name:  item?.can_name  || '',
    can_brand: item?.can_brand || '',
    can_flavour:  item?.can_flavour  || '',
    can_edition:  item?.can_edition  || '',
    can_beverage_type: item?.can_beverage_type || 'energy_drink',
    can_image_url: item?.can_image_url || '',
    can_bg_color: item?.can_bg_color || DEFAULT_CAN_BG,
    taste_rating: item?.taste_rating || null,
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Barcode lives on shared_cans (the community catalog), not on this
  // user_collection row, so it can't just be another field in `form` — it's
  // its own RPC (set_can_barcode), separate from saveMutation below. Only
  // addable while missing: the RPC itself rejects overwriting a barcode
  // that's already set, so once one exists this renders read-only instead
  // of a form control that would just reject the save.
  const [barcodeInput, setBarcodeInput] = useState('');

  const addBarcodeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('set_can_barcode', {
        p_caller_id: user.id,
        p_can_id: item.can_id,
        p_barcode: barcodeInput,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Barcode added');
      setBarcodeInput('');
      onBarcodeAdded?.();
    },
    onError: (error) => {
      if (error.message?.includes('barcode_already_used')) {
        toast.error('That barcode is already used by a different can');
      } else {
        toast.error('Failed to add barcode: ' + (error.message || 'Unknown error'));
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('user_collection').update(form).eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      toast.success('Entry updated');
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to update entry: ' + (error.message || 'Unknown error'));
    },
  });

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-card border-t border-border rounded-t-2xl pb-10 overflow-y-auto max-h-[90vh]"
      >
        <SheetHeader className="mb-5">
          <SheetTitle className="font-display text-sm tracking-wide text-foreground">Edit Entry</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-can-name" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Can Name</Label>
            <Input
              id="edit-can-name"
              value={form.can_name}
              onChange={e => update('can_name', e.target.value)}
              className="bg-secondary border-border font-body"
            />
          </div>

          {/* Brand + Flavour */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-can-brand" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Brand</Label>
              <Input
                id="edit-can-brand"
                value={form.can_brand}
                onChange={e => update('can_brand', e.target.value)}
                className="bg-secondary border-border font-body"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-can-flavour" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Flavour</Label>
              <Input
                id="edit-can-flavour"
                value={form.can_flavour}
                onChange={e => update('can_flavour', e.target.value)}
                className="bg-secondary border-border font-body"
              />
            </div>
          </div>

          {/* Edition */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-can-edition" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Edition</Label>
            <Input
              id="edit-can-edition"
              value={form.can_edition}
              onChange={e => update('can_edition', e.target.value)}
              className="bg-secondary border-border font-body"
            />
          </div>

          {/* Beverage Type — a personal snapshot like can_name/can_brand
              above, not locked, always editable here even though this
              can's shared_cans.beverage_type is the canonical, first-
              contributor-only value elsewhere (AddCanForm.jsx). */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Beverage Type</Label>
            <BeverageTypeToggle
              value={form.can_beverage_type}
              onChange={v => update('can_beverage_type', v)}
            />
          </div>

          {/* Barcode — previously had no field here at all, so a can added
              without one (manual entry, or a scan that didn't resolve)
              could never get one added later. */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-can-barcode" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Barcode</Label>
            {sharedCan?.barcode ? (
              <p className="h-11 flex items-center px-3 rounded-lg bg-secondary border border-border font-mono text-sm text-foreground">
                {sharedCan.barcode}
              </p>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="edit-can-barcode"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Scan or type the barcode"
                  inputMode="numeric"
                  className="bg-secondary border-border font-mono text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addBarcodeMutation.mutate()}
                  disabled={!barcodeInput.trim() || addBarcodeMutation.isPending}
                  className="h-11 font-mono text-xs px-4 border-primary/30 text-primary hover:bg-primary/10 flex-shrink-0"
                >
                  {addBarcodeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                </Button>
              </div>
            )}
          </div>

          {/* Image */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Image</Label>
            {form.can_image_url ? (
              <div className="relative w-full h-40 rounded-xl overflow-hidden" style={{ backgroundColor: form.can_bg_color }}>
                <img src={form.can_image_url} alt="Can" className="w-full h-full object-contain" />
                <button
                  onClick={() => update('can_image_url', '')}
                  aria-label="Remove image"
                  className="group absolute top-0 right-0 w-11 h-11 flex items-center justify-center"
                >
                  {/* Real tap target is the full 44px button above; this stays a
                      small visual badge so it doesn't dominate the preview. */}
                  <span className="w-7 h-7 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-border group-hover:bg-background">
                    <X className="w-3.5 h-3.5" />
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex bg-secondary rounded-lg border border-border p-0.5 w-fit gap-0.5">
                  <button
                    type="button"
                    onClick={() => setImageMode('upload')}
                    aria-pressed={imageMode === 'upload'}
                    className={cn('h-10 px-3 rounded-md text-xs font-mono transition-all flex items-center gap-1.5',
                      imageMode === 'upload' ? 'bg-card text-foreground' : 'text-muted-foreground')}
                  >
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('url')}
                    aria-pressed={imageMode === 'url'}
                    className={cn('h-10 px-3 rounded-md text-xs font-mono transition-all flex items-center gap-1.5',
                      imageMode === 'url' ? 'bg-card text-foreground' : 'text-muted-foreground')}
                  >
                    <LinkIcon className="w-3 h-3" /> Paste URL
                  </button>
                </div>
                {imageMode === 'upload' ? (
                  <label className="flex items-center justify-center gap-2 p-5 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
                    {uploading
                      ? <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      : <Upload className="w-5 h-5 text-muted-foreground" />}
                    <span className="text-sm text-muted-foreground font-mono">
                      {uploading ? 'Uploading...' : 'Tap to choose a photo'}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                ) : (
                  <Input
                    aria-label="Image URL"
                    value={form.can_image_url}
                    onChange={e => update('can_image_url', e.target.value)}
                    placeholder="https://example.com/can.jpg"
                    className="bg-secondary border-border font-mono text-sm"
                  />
                )}
              </div>
            )}
          </div>

          {/* Independent of whether an image is set — can_bg_color also
              backs the fallback tile shown behind the generic can icon
              when there's no image at all (see CollectionCard.jsx). */}
          <CanBackgroundPicker
            value={form.can_bg_color}
            onChange={v => update('can_bg_color', v)}
            imageUrl={form.can_image_url}
            previewAlt={form.can_name || 'Can preview'}
          />

          {/* Rarity vote — read only */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Your Rarity Vote <span className="normal-case text-muted-foreground">(locked)</span>
            </Label>
            {/* pointer-events-none, not a blanket opacity on the row — see
                the matching fix in AddCanForm.jsx's own locked-vote block
                (same duplicated pattern): a row-level opacity washes out
                the SELECTED pill's own primary fill along with the
                unselected ones, so only the unselected pills get muted
                here, keeping the locked choice itself at full brightness. */}
            <div className="grid grid-cols-3 gap-2 pointer-events-none" role="radiogroup" aria-label="Your rarity vote (locked)">
              {RARITY_ORDER.map(r => {
                const selected = myVote?.voted_rarity === r;
                return (
                  <div
                    key={r}
                    role="radio"
                    aria-checked={selected}
                    aria-disabled="true"
                    className={cn(
                      'px-3 py-1.5 flex items-center justify-center rounded-lg border text-xs font-mono font-semibold uppercase tracking-wider',
                      selected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border text-muted-foreground opacity-60'
                    )}
                  >
                    {r}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status</Label>
            <div className="flex bg-secondary rounded-xl border border-border p-1 gap-1">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('status', opt.value)}
                  aria-pressed={form.status === opt.value}
                  className={cn(
                    'flex-1 h-11 flex items-center justify-center rounded-lg text-xs font-mono font-semibold transition-all',
                    form.status === opt.value
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Taste Rating */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Taste Rating</Label>
            <TasteRatingStars value={form.taste_rating} onChange={v => update('taste_rating', v)} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-can-notes" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea
              id="edit-can-notes"
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              placeholder="Where you found it, condition, trade value..."
              className="bg-secondary border-border font-body h-24 resize-none"
            />
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="h-11 w-full font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saveMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
