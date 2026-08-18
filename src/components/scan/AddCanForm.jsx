import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Upload, Zap, Link as LinkIcon, X, Users, ShieldCheck, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import RarityReveal from './RarityReveal';
import { cn } from '@/lib/utils';
import { RARITY_ORDER, VOTE_FIELDS, buildVoteUpdate, getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';
import { CAN_BG_COLORS, DEFAULT_CAN_BG } from '@/lib/canBgColors';
import { notifyFollowersOfRarePull } from '@/lib/notifyRarePull';

const RARITIES = RARITY_ORDER;

const STATUS_OPTIONS = [
  { value: 'collected', label: 'Collected' },
  { value: 'wishlist',  label: 'Wishlist'  },
  { value: 'duplicate', label: 'Duplicate' },
];

export default function AddCanForm({ prefillData, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const [showReveal, setShowReveal] = useState(false);
  const [revealRarity, setRevealRarity] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imageMode, setImageMode] = useState('upload');
  const [errors, setErrors] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

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
    queryKey: ['rarity-vote', prefillData?.id, currentUser?.email],
    queryFn: () => base44.entities.RarityVote.filter({ can_id: prefillData.id, created_by: currentUser.email }),
    enabled: !!prefillData?.id && !!currentUser,
    select: data => data?.[0] || null,
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

      if (prefillData?.id) {
        // Existing can — submit vote if not already voted
        sharedCan = prefillData;
        if (!alreadyVoted) {
          const voteUpdate = buildVoteUpdate(prefillData, form.rarity);
          await base44.entities.SharedCan.update(prefillData.id, voteUpdate);
          await base44.entities.RarityVote.create({ can_id: prefillData.id, voted_rarity: form.rarity });
        }
      } else {
        // New can — first vote
        const voteField = VOTE_FIELDS[form.rarity];
        sharedCan = await base44.entities.SharedCan.create({
          name:             form.name,
          brand:            form.brand,
          flavour:          form.flavour,
          edition:          form.edition,
          rarity:           form.rarity,
          image_url:        form.image_url,
          barcode:          form.barcode,
          [voteField]:      1,
          total_votes:      1,
          consensus_rarity: form.rarity,
          confidence:       'unrated',
        });
        await base44.entities.RarityVote.create({ can_id: sharedCan.id, voted_rarity: form.rarity });
      }

      // Add to user collection
      const displayRarity = prefillData?.id && !alreadyVoted
        ? buildVoteUpdate(prefillData, form.rarity).consensus_rarity
        : (sharedCan.consensus_rarity || form.rarity);

      await base44.entities.UserCollection.create({
        can_id:        sharedCan.id,
        status:        form.status,
        notes:         form.notes,
        can_name:      form.name      || sharedCan.name,
        can_brand:     form.brand     || sharedCan.brand,
        can_image_url: form.image_url || sharedCan.image_url,
        can_rarity:    displayRarity,
        can_flavour:   form.flavour   || sharedCan.flavour,
        can_edition:   form.edition   || sharedCan.edition,
        can_bg_color:  form.bg_color  || DEFAULT_CAN_BG,
        user_rarity_vote: form.rarity,
      });

      return displayRarity;
    },
    onSuccess: (displayRarity) => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      queryClient.invalidateQueries({ queryKey: ['shared-cans'] });
      // Fan-out rare pull notifications to followers who opted in
      if (form.status === 'collected' && ['Ultra Rare', 'Legendary'].includes(displayRarity) && currentUser) {
        notifyFollowersOfRarePull({
          user: currentUser,
          canName: form.name,
          canBrand: form.brand,
          canRarity: displayRarity,
          canId: prefillData?.id || '',
          canImageUrl: form.image_url,
        });
      }
      if (['Rare', 'Ultra Rare', 'Legendary'].includes(displayRarity)) {
        setRevealRarity(displayRarity);
        setShowReveal(true);
      } else {
        toast.success('Can added to your vault!');
        onSuccess?.();
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
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update('image_url', file_url);
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
          onSuccess?.();
        }}
      />
    );
  }

  return (
    <div className="space-y-5 px-5 pb-10">

      {/* Open Food Facts source banner */}
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

      {/* Community Consensus Banner (existing cans only) */}
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

      {/* Can Name */}
      <div className="space-y-1.5">
        <Label className={cn('text-xs font-mono uppercase tracking-wider', errors.name ? 'text-destructive' : 'text-muted-foreground')}>
          Can Name {errors.name && <span className="normal-case">— required</span>}
        </Label>
        <Input
          value={form.name}
          onChange={e => update('name', e.target.value)}
          placeholder="e.g. Monster Ultra Paradise"
          readOnly={!!prefillData?.id}
          className={cn('bg-secondary border-border font-body', errors.name && 'border-destructive', prefillData?.id && 'opacity-60 cursor-default')}
        />
      </div>

      {/* Brand + Flavour */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className={cn('text-xs font-mono uppercase tracking-wider', errors.brand ? 'text-destructive' : 'text-muted-foreground')}>
            Brand {errors.brand && <span className="normal-case">— required</span>}
          </Label>
          <Input
            value={form.brand}
            onChange={e => update('brand', e.target.value)}
            placeholder="Monster"
            readOnly={!!prefillData?.id}
            className={cn('bg-secondary border-border font-body', errors.brand && 'border-destructive', prefillData?.id && 'opacity-60 cursor-default')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Flavour / Variant</Label>
          <Input
            value={form.flavour}
            onChange={e => update('flavour', e.target.value)}
            placeholder="Ultra Paradise"
            readOnly={!!prefillData?.id}
            className={cn('bg-secondary border-border font-body', prefillData?.id && 'opacity-60 cursor-default')}
          />
        </div>
      </div>

      {/* Edition + Date Added */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Edition</Label>
          <Input
            value={form.edition}
            onChange={e => update('edition', e.target.value)}
            placeholder="2024 Special"
            readOnly={!!prefillData?.id}
            className={cn('bg-secondary border-border font-body', prefillData?.id && 'opacity-60 cursor-default')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Date Added</Label>
          <Input
            type="date"
            value={form.date_added}
            onChange={e => update('date_added', e.target.value)}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
      </div>

      {/* Barcode */}
      {!prefillData?.id && (
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Barcode (optional)</Label>
          <Input
            value={form.barcode}
            onChange={e => update('barcode', e.target.value.replace(/\D/g, ''))}
            placeholder="e.g. 5000112548167"
            inputMode="numeric"
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
      )}

      {/* Rarity Vote */}
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

      {/* Status */}
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

      {/* Image */}
      {!prefillData?.id && (
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Image (optional)</Label>
          {form.image_url ? (
            <div className="space-y-3">
              {/* Preview with selected background */}
              <div className="relative w-full h-40 rounded-xl overflow-hidden" style={{ backgroundColor: form.bg_color }}>
                <img src={form.image_url} alt="Can" className="w-full h-full object-contain" />
                <button
                  onClick={() => update('image_url', '')}
                  className="absolute top-2 right-2 w-7 h-7 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-border hover:bg-background"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Background colour picker */}
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
                        borderColor: form.bg_color === hex ? '#00E5FF' : 'rgba(255,255,255,0.1)',
                        boxShadow: form.bg_color === hex ? '0 0 0 2px rgba(0,229,255,0.3)' : 'none',
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

      {/* Image preview for existing cans */}
      {prefillData?.id && prefillData.image_url && (
        <div className="w-full h-40 rounded-xl overflow-hidden bg-secondary">
          <img src={prefillData.image_url} alt="Can" className="w-full h-full object-contain" />
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
        <Textarea
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          placeholder="Where you found it, condition, trade value..."
          className="bg-secondary border-border font-body h-24 resize-none"
        />
      </div>

      {/* Actions */}
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