import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Upload, Zap, Link as LinkIcon, X, Users, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { format } from 'date-fns';
import RarityReveal from './RarityReveal';
import { cn } from '@/lib/utils';
import { RARITY_ORDER, getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';
import { CAN_BG_COLORS, DEFAULT_CAN_BG } from '@/lib/canBgColors';

const RARITIES = RARITY_ORDER;

const STATUS_OPTIONS = [
  { value: 'collected', label: 'Collected' },
  { value: 'wishlist',  label: 'Wishlist'  },
  { value: 'duplicate', label: 'Duplicate' },
];

export default function AddCanForm({ prefillData, onSuccess, onCancel }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showReveal, setShowReveal] = useState(false);
  const [revealRarity, setRevealRarity] = useState('');
  const [pendingCan, setPendingCan] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [imageMode, setImageMode] = useState('upload');
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name:       prefillData?.name    || '',
    brand:      prefillData?.brand   || '',
    flavour:    prefillData?.flavour || '',
    edition:    prefillData?.edition || '',
    rarity:     prefillData?.consensus_rarity || prefillData?.rarity || 'Common',
    image_url:  prefillData?.image_url || '',
    barcode:    prefillData?.barcode || '',
    notes:      '',
    status:     'collected',
    date_added: format(new Date(), 'yyyy-MM-dd'),
    bg_color:   prefillData?.can_bg_color || DEFAULT_CAN_BG,
  });

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  };

  // Check if user already voted on this can
  const { data: existingVote } = useQuery({
    queryKey: ['rarity-vote', prefillData?.id, currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rarity_votes')
        .select('*')
        .eq('can_id', prefillData.id)
        .eq('voter_id', currentUser.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows, not an error here
      return data ?? null;
    },
    enabled: !!prefillData?.id && !!currentUser,
  });

  const alreadyVoted = !!existingVote;
  const consensusRarity = prefillData ? getDisplayRarity(prefillData) : null;
  const totalVotes = prefillData?.total_votes || 0;
  const confidence = getConfidence(totalVotes);

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = true;
    if (!form.brand.trim()) e.brand = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      let sharedCan;

      if (prefillData?.id && alreadyVoted) {
        // Already voted on this can — don't vote again, just use its current data
        sharedCan = prefillData;
      } else {
        // Either a brand-new can (first vote) or an existing can this user hasn't voted on yet.
        // vote_on_can() handles can creation, vote recording, and aggregate updates atomically.
        const { data, error } = await supabase.rpc('vote_on_can', {
          p_caller_id: currentUser.id,
          p_can_id: prefillData?.id ?? null,
          p_rarity: form.rarity,
          p_name: form.name || null,
          p_brand: form.brand || null,
          p_flavour: form.flavour || null,
          p_edition: form.edition || null,
          p_image_url: form.image_url || null,
          p_barcode: form.barcode || null,
        });
        if (error) throw error;
        sharedCan = data;
      }

      const displayRarity = sharedCan.consensus_rarity || form.rarity;

      const { data: insertedRow, error: insertError } = await supabase.from('user_collection').insert({
        owner_id:         currentUser.id,
        can_id:            sharedCan.id,
        status:            form.status,
        notes:             form.notes,
        can_name:          form.name      || sharedCan.name,
        can_brand:         form.brand     || sharedCan.brand,
        can_image_url:     form.image_url || sharedCan.image_url,
        can_rarity:        displayRarity,
        can_flavour:       form.flavour   || sharedCan.flavour,
        can_edition:       form.edition   || sharedCan.edition,
        can_bg_color:      form.bg_color  || DEFAULT_CAN_BG,
        user_rarity_vote:  form.rarity,
      }).select().single();
      if (insertError) throw insertError;

      return { displayRarity, insertedRow };
    },
    onSuccess: ({ displayRarity, insertedRow }) => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      queryClient.invalidateQueries({ queryKey: ['shared-cans'] });
      // TODO: server-side rare pull notification fan-out (deferred to edge function)
      if (['Rare', 'Ultra Rare', 'Legendary'].includes(displayRarity)) {
        setRevealRarity(displayRarity);
        setPendingCan(insertedRow);
        setShowReveal(true);
      } else {
        toast.success('Can added to your vault!');
        onSuccess?.(insertedRow);
      }
    },
    onError: (error) => {
      if (error?.message?.includes('already_collected')) {
        toast('You already have this can in your vault');
        onSuccess?.();
      } else if (error?.message?.includes('rate_limit_exceeded')) {
        toast.error('You are adding cans too quickly — try again in an hour');
      } else if (error?.message?.includes('daily_scan_limit_reached')) {
        toast.error('Daily scan limit reached — upgrade to Pro for unlimited scans', {
          action: { label: 'Upgrade', onClick: () => navigate('/pro') },
        });
      } else {
        toast.error('Failed to add can: ' + (error?.message || 'Unknown error'));
      }
    },
  });

  const handleSubmit = () => {
    if (validate()) createMutation.mutate();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage
        .from('can-images')
        .upload(fileName, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('can-images')
        .getPublicUrl(fileName);
      update('image_url', publicUrl);
    } catch (err) {
      toast.error('Failed to upload image');
    }
    setUploading(false);
  };

  if (showReveal) {
    return (
      <RarityReveal
        rarity={revealRarity}
        canName={form.name}
        onComplete={() => {
          setShowReveal(false);
          toast.success('Rare pull added to your vault!');
          onSuccess?.(pendingCan);
        }}
      />
    );
  }

  return (
    <div className="space-y-5 px-5 pb-10">

      {(prefillData?._offMiss || (prefillData?._offSource && (!prefillData?.name || !prefillData?.brand))) && (
        <div className="mb-2 px-3 py-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
          <p className="text-xs font-mono text-yellow-400">
            {prefillData?._offMiss
              ? "This barcode isn't in Open Food Facts yet — fill in the details below to add it."
              : "Some details couldn't be found automatically — please fill them in below."}
          </p>
        </div>
      )}

      {prefillData?._offSource && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
          <span className="text-lg">🌍</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-primary font-semibold">Found on Open Food Facts</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              Verify the details below before saving — select rarity, status & flavour manually.
            </p>
          </div>
        </div>
      )}

      {prefillData?.id && (
        <div className={cn(
          'rounded-xl border p-3 flex items-start gap-3',
          confidence === 'confirmed' ? 'bg-primary/5 border-primary/20' : 'bg-secondary border-border'
        )}>
          {confidence === 'confirmed'
            ? <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            : <ShieldAlert className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">Community says:</span>
              <Popover>
                <PopoverTrigger
                  onClick={e => e.stopPropagation()}
                  className="p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="How Community Rarity works"
                >
                  <Info className="w-3.5 h-3.5" />
                </PopoverTrigger>
                <PopoverContent className="w-64 text-xs font-mono leading-relaxed" side="top">
                  <p className="font-semibold text-foreground mb-1">How Community Rarity works</p>
                  <p className="text-muted-foreground">
                    Collectors vote on each can's rarity. A tier shows once 5+ votes come in (low confidence), and locks in as confirmed at 15+. Your vote can't be changed once cast — that keeps the count trustworthy.
                  </p>
                </PopoverContent>
              </Popover>
              {confidence === 'unrated' ? (
                <span className="text-xs font-mono text-muted-foreground italic">Not enough votes yet</span>
              ) : (
                <span className={cn(
                  'text-xs font-mono font-bold uppercase tracking-wider',
                  confidence === 'confirmed' ? 'text-primary' : 'text-foreground'
                )}>
                  {consensusRarity}
                </span>
              )}
              <span className="text-xs font-mono text-muted-foreground">
                — {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                {confidence === 'unrated' && ` (need ${5 - totalVotes} more)`}
              </span>
            </div>
            {alreadyVoted && (
              <p className="text-[11px] font-mono text-muted-foreground mt-1">
                You voted: <span className="text-foreground">{existingVote?.voted_rarity}</span> · vote locked
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
            <Users className="w-3 h-3" />
            <span className="text-[11px] font-mono">{totalVotes}</span>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="addcan-name" className={cn('text-xs font-mono uppercase tracking-wider', errors.name ? 'text-destructive' : 'text-muted-foreground')}>
          Can Name {errors.name && <span className="normal-case">— required</span>}
        </Label>
        <Input
          id="addcan-name"
          value={form.name}
          onChange={e => update('name', e.target.value)}
          placeholder="e.g. Monster Ultra Paradise"
          readOnly={!!prefillData?.id}
          className={cn('bg-secondary border-border font-body', errors.name && 'border-destructive', prefillData?.id && 'opacity-60 cursor-default')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="addcan-brand" className={cn('text-xs font-mono uppercase tracking-wider', errors.brand ? 'text-destructive' : 'text-muted-foreground')}>
            Brand {errors.brand && <span className="normal-case">— required</span>}
          </Label>
          <Input
            id="addcan-brand"
            value={form.brand}
            onChange={e => update('brand', e.target.value)}
            placeholder="Monster"
            readOnly={!!prefillData?.id}
            className={cn('bg-secondary border-border font-body', errors.brand && 'border-destructive', prefillData?.id && 'opacity-60 cursor-default')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addcan-flavour" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Flavour / Variant</Label>
          <Input
            id="addcan-flavour"
            value={form.flavour}
            onChange={e => update('flavour', e.target.value)}
            placeholder="Ultra Paradise"
            readOnly={!!prefillData?.id}
            className={cn('bg-secondary border-border font-body', prefillData?.id && 'opacity-60 cursor-default')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="addcan-edition" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Edition</Label>
          <Input
            id="addcan-edition"
            value={form.edition}
            onChange={e => update('edition', e.target.value)}
            placeholder="2024 Special"
            readOnly={!!prefillData?.id}
            className={cn('bg-secondary border-border font-body', prefillData?.id && 'opacity-60 cursor-default')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addcan-date-added" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Date Added</Label>
          <Input
            id="addcan-date-added"
            type="date"
            value={form.date_added}
            onChange={e => update('date_added', e.target.value)}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
      </div>

      {!prefillData?.id && (
        <div className="space-y-1.5">
          <Label htmlFor="addcan-barcode" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Barcode (optional)</Label>
          <Input
            id="addcan-barcode"
            value={form.barcode}
            onChange={e => update('barcode', e.target.value.replace(/\D/g, ''))}
            placeholder="e.g. 5000112548167"
            inputMode="numeric"
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {alreadyVoted ? 'Your Vote (locked)' : prefillData?.id ? 'Cast Your Vote' : 'Your Rarity Vote'}
        </Label>
        {alreadyVoted ? (
          <div className="flex gap-2 flex-wrap opacity-60 pointer-events-none">
            {RARITIES.map(r => (
              <div
                key={r}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold uppercase tracking-wider',
                  existingVote?.voted_rarity === r
                    ? 'bg-primary border-primary text-primary-foreground shadow'
                    : 'border-border text-muted-foreground'
                )}
              >
                {r}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {RARITIES.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => update('rarity', r)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold uppercase tracking-wider transition-all',
                  form.rarity === r
                    ? 'bg-primary border-primary text-primary-foreground shadow'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Status</Label>
        <div className="flex bg-secondary rounded-xl border border-border p-1 gap-1">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('status', opt.value)}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
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

      {!prefillData?.id && (
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Image (optional)</Label>
          {form.image_url ? (
            <div className="space-y-3">
              <div className="relative w-full h-40 rounded-xl overflow-hidden" style={{ backgroundColor: form.bg_color }}>
                <img src={form.image_url} alt="Can" className="w-full h-full object-contain" />
                <button
                  onClick={() => update('image_url', '')}
                  aria-label="Remove image"
                  className="absolute top-2 right-2 w-7 h-7 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-border hover:bg-background"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Card Background</Label>
                <div className="flex gap-2 flex-wrap">
                  {CAN_BG_COLORS.map(({ label, hex }) => (
                    <button
                      key={hex}
                      type="button"
                      title={label}
                      onClick={() => update('bg_color', hex)}
                      className="w-8 h-8 rounded-lg border-2 transition-all"
                      style={{
                        backgroundColor: hex,
                        borderColor: form.bg_color === hex ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.1)',
                        boxShadow: form.bg_color === hex ? '0 0 0 2px hsl(var(--primary) / 0.3)' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex bg-secondary rounded-lg border border-border p-0.5 w-fit gap-0.5">
                <button
                  type="button"
                  onClick={() => setImageMode('upload')}
                  className={cn('px-3 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1.5',
                    imageMode === 'upload' ? 'bg-card text-foreground' : 'text-muted-foreground')}
                >
                  <Upload className="w-3 h-3" /> Upload
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('url')}
                  className={cn('px-3 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1.5',
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
                  value={form.image_url}
                  onChange={e => update('image_url', e.target.value)}
                  placeholder="https://example.com/can.jpg"
                  className="bg-secondary border-border font-mono text-sm"
                />
              )}
            </div>
          )}
        </div>
      )}

      {prefillData?.id && prefillData.image_url && (
        <div className="w-full h-40 rounded-xl overflow-hidden bg-secondary">
          <img src={prefillData.image_url} alt="Can" className="w-full h-full object-contain" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="addcan-notes" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
        <Textarea
          id="addcan-notes"
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          placeholder="Where you found it, condition, trade value..."
          className="bg-secondary border-border font-body h-24 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 font-mono text-xs border-border"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="flex-1 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
        >
          {createMutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Zap className="w-4 h-4" />}
          {alreadyVoted ? 'Add to Vault' : 'Vote & Add to Vault'}
        </Button>
      </div>
    </div>
  );
}
