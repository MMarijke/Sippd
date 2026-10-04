import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Upload, Zap, Link as LinkIcon, X, Users, ShieldCheck, ShieldAlert, Info, ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import RarityReveal from './RarityReveal';
import AddedConfirmation from './AddedConfirmation';
import { cn } from '@/lib/utils';
import { RARITY_ORDER, getDisplayRarity, getConfidence } from '@/lib/rarityConsensus';
import { DEFAULT_CAN_BG } from '@/lib/canBgColors';
import CanImageBox from '@/components/shared/CanImageBox';
import TasteRatingStars from '@/components/shared/TasteRatingStars';
import BeverageTypeToggle from '@/components/shared/BeverageTypeToggle';

const RARITIES = RARITY_ORDER;

const STATUS_OPTIONS = [
  { value: 'collected', label: 'Collected' },
  { value: 'wishlist',  label: 'Wishlist'  },
  { value: 'duplicate', label: 'Duplicate' },
];

// Settings.jsx writes defaultStatus/defaultRarity to this same key
// ('canvolt_prefs') via its own loadPrefs()/savePrefs() -- a private,
// unexported pair local to that page, so this reads the key directly
// rather than importing page-local state logic. Was saved successfully but
// never read anywhere, so the Settings toggles did nothing. (/impeccable critique)
function loadSavedDefaults() {
  try {
    return JSON.parse(localStorage.getItem('canvolt_prefs')) || {};
  } catch {
    return {};
  }
}

export default function AddCanForm({ prefillData, onSuccess, onScanNext, onCancel }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showReveal, setShowReveal] = useState(false);
  const [showAddedConfirmation, setShowAddedConfirmation] = useState(false);
  const [revealRarity, setRevealRarity] = useState('');
  const [pendingCan, setPendingCan] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [imageMode, setImageMode] = useState('upload');
  const [errors, setErrors] = useState({});
  // Collapsed by default so Submit is reachable right after Status without
  // scrolling past four optional fields — this is a "log it fast" flow
  // (PRODUCT.md: "the Scan flow implies logging a can at the point of
  // acquisition"). Starts open only when there's already something to show
  // here: voting on an existing catalog can whose community-sourced image
  // renders read-only in this same section.
  const [showPersonalize, setShowPersonalize] = useState(!!(prefillData?.id && prefillData.image_url));
  const personalizeTriggerRef = useRef(null);

  // Expanding reveals ~500px of new content (Taste Rating/Image/Background/
  // Notes), but the trigger itself usually sits near the bottom of the
  // visible viewport — without this, the newly-revealed fields render below
  // the fold, behind the fixed bottom nav's screen position, so tapping
  // "Personalize" visually appears to do almost nothing. Scrolling the
  // trigger to the top of the scroll container brings the revealed content
  // into the space below it instead.
  const handlePersonalizeToggle = (open) => {
    setShowPersonalize(open);
    if (open) {
      requestAnimationFrame(() => {
        personalizeTriggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const [form, setForm] = useState(() => {
    const savedDefaults = loadSavedDefaults();
    return {
      name:       prefillData?.name    || '',
      brand:      prefillData?.brand   || '',
      flavour:    prefillData?.flavour || '',
      edition:    prefillData?.edition || '',
      // Starts unselected. It used to start on the community's answer (or a
      // Settings default), so a vote that can never be changed could be cast
      // without anyone choosing it, and votes drifted toward the consensus.
      // The community's answer now shows as a hint beside the pills.
      rarity:     null,
      image_url:  prefillData?.image_url || '',
      barcode:    prefillData?.barcode || '',
      // Existing catalog can: its own established beverage_type (read-only
      // below, same as name/brand). New can: whatever OFF's category guess
      // landed on (see Scan.jsx's guessBeverageType), or energy_drink by
      // default -- either way, always shown and always editable before
      // submit (never silently trusted).
      beverage_type: prefillData?.beverage_type || 'energy_drink',
      notes:      '',
      status:     savedDefaults.defaultStatus || 'collected',
      date_added: format(new Date(), 'yyyy-MM-dd'),
      bg_color:   prefillData?.can_bg_color || DEFAULT_CAN_BG,
      // Always null here, even when voting on an existing shared_can — that
      // record is the global catalog entry, never this user's own
      // user_collection row, so there's never a prior personal rating to
      // prefill regardless of path.
      taste_rating: null,
    };
  });

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  };

  // Rarity votes lock once cast, but the only warning used to be a small
  // static line below a 6-button grid — the same visual weight as any other
  // field label, for the single highest-stakes tap in this form. A first
  // tap now only stages the choice (pendingRarity); a second tap on the
  // same pill is what actually commits it to form.rarity. Tapping a
  // different pill just re-stages instead of committing, so changing your
  // mind mid-decision never accidentally locks the wrong tier.
  // (/impeccable critique)
  const [pendingRarity, setPendingRarity] = useState(null);
  const selectRarity = (r) => {
    if (pendingRarity === r) {
      update('rarity', r);
      setPendingRarity(null);
      setVoteNudge(false);
    } else if (form.rarity === r) {
      // Tapping the already-confirmed pill while a different one is
      // pending reads as "actually, keep this one" — clear the pending
      // change instead of leaving it stuck showing "Confirm?".
      setPendingRarity(null);
    } else {
      setPendingRarity(r);
    }
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
  // The rarity the new tile will wear: the same rule the insert below saves
  // as can_rarity (community consensus if there is one, else your vote).
  const tileRarity = prefillData?.consensus_rarity || form.rarity;
  const totalVotes = prefillData?.total_votes || 0;
  const confidence = getConfidence(totalVotes);
  // The community's answer, shown as a hint next to the vote, never pre-picked.
  const communityHint = prefillData?.id && confidence !== 'unrated' ? consensusRarity : null;

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = true;
    if (!form.brand.trim()) e.brand = true;
    setErrors(e);
    return e;
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
          p_beverage_type: form.beverage_type,
        });
        if (error) throw error;
        sharedCan = data;
      }

      const myVote = alreadyVoted ? existingVote?.voted_rarity : form.rarity;
      const displayRarity = sharedCan.consensus_rarity || myVote;

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
        can_beverage_type: form.beverage_type || sharedCan.beverage_type,
        can_bg_color:      form.bg_color  || DEFAULT_CAN_BG,
        user_rarity_vote:  myVote,
        taste_rating:      form.taste_rating,
        // The "Date Added" field below; it was never saved before.
        acquired_on:       form.date_added || null,
      }).select().single();
      if (insertError) throw insertError;

      return { displayRarity, insertedRow };
    },
    onSuccess: ({ displayRarity, insertedRow }) => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      queryClient.invalidateQueries({ queryKey: ['shared-cans'] });
      if (['Rare', 'Ultra Rare', 'Legendary'].includes(displayRarity)) {
        setRevealRarity(displayRarity);
        setPendingCan(insertedRow);
        setShowReveal(true);
      } else {
        // Previously just a toast fired in the same tick as onSuccess (which
        // navigates away in Scan.jsx), so the toast for the common case —
        // the majority of real adds — was easy to miss entirely underneath
        // the page transition. This gives every successful add a real,
        // visible beat before moving on, scaled down from RarityReveal so
        // a rare pull still feels distinctly bigger.
        setPendingCan(insertedRow);
        setShowAddedConfirmation(true);
      }
    },
    onError: (error) => {
      // vote_on_can() no longer raises already_collected — re-voting on a
      // can this user already voted on (e.g. logging a duplicate) is now
      // silently skipped server-side instead of blocking the
      // user_collection insert below it. See its migration's doc comment.
      // Numbers match vote_on_can (20260925000001_vote_on_can_beverage_type.sql):
      // 30 votes per rolling hour, and 10 barcode scans per rolling 24 hours.
      // The hourly limit is anti-spam for everyone; the daily scan cap is a
      // free-tier limit that Pro removes (PRODUCT.md, the Pro page), so its
      // message says so plainly.
      if (error?.message?.includes('rate_limit_exceeded')) {
        toast.error("You've added 30 cans in the last hour. Take a short break, then try again.");
      } else if (error?.message?.includes('daily_scan_limit_reached')) {
        toast.error("You've scanned 10 barcodes in the last 24 hours, the free daily limit. You can scan more once the oldest scan is a day old. Pro removes the limit.", {
          action: { label: 'See Pro', onClick: () => navigate('/pro') },
        });
      } else {
        console.error('Failed to add can:', error);
        toast.error('Failed to add can — please try again.');
      }
    },
  });

  const [voteNudge, setVoteNudge] = useState(false);
  const voteGroupRef = useRef(null);
  const needsVote = !alreadyVoted && !form.rarity;

  const handleSubmit = () => {
    if (needsVote && !pendingRarity) {
      setVoteNudge(true);
      voteGroupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      voteGroupRef.current?.querySelector('button')?.focus({ preventScroll: true });
      return;
    }
    // An unconfirmed rarity tap shouldn't silently submit the previous
    // value — that would look to the user like their tap did nothing,
    // when really it just never got confirmed.
    if (pendingRarity && !alreadyVoted) {
      toast(`Tap ${pendingRarity} again to lock in your rarity vote before submitting.`);
      return;
    }
    const e = validate();
    if (Object.keys(e).length === 0) {
      createMutation.mutate();
      return;
    }
    // The form is a single long scroll with no section anchors — on a
    // failed submit, jump to whichever required field is invalid instead
    // of just coloring a label that may already be off-screen above.
    const firstInvalidId = e.name ? 'addcan-name' : e.brand ? 'addcan-brand' : null;
    const el = firstInvalidId && document.getElementById(firstInvalidId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
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
    } catch {
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
        onScanNext={() => {
          setShowReveal(false);
          toast.success('Rare pull added to your vault!');
          onScanNext?.(pendingCan);
        }}
      />
    );
  }

  if (showAddedConfirmation) {
    return (
      <AddedConfirmation
        canName={form.name}
        imageUrl={pendingCan?.can_image_url}
        rarity={pendingCan?.can_rarity}
        onComplete={() => {
          setShowAddedConfirmation(false);
          onSuccess?.(pendingCan);
        }}
        onScanNext={() => {
          setShowAddedConfirmation(false);
          onScanNext?.(pendingCan);
        }}
      />
    );
  }

  return (
    <div className="space-y-5 px-5 pb-10">

      {(prefillData?._offMiss || (prefillData?._offSource && (!prefillData?.name || !prefillData?.brand))) && (
        <div className="mb-2 px-3 py-2 rounded-xl border border-caution/30 bg-caution/5">
          <p className="text-xs font-mono text-caution">
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
            <p className="text-2xs font-mono text-muted-foreground mt-0.5">
              Verify the details below before saving — select rarity, status, beverage type & flavour manually.
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
                  className="p-[15px] -m-[15px] text-muted-foreground hover:text-foreground transition-colors"
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
              <p className="text-2xs font-mono text-muted-foreground mt-1">
                You voted: <span className="text-foreground">{existingVote?.voted_rarity}</span> · vote locked
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
            <Users className="w-3 h-3" />
            <span className="text-2xs font-mono">{totalVotes}</span>
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
          className={cn('h-11 bg-secondary border-border font-body', errors.name && 'border-destructive', prefillData?.id && 'opacity-60 cursor-default')}
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
            className={cn('h-11 bg-secondary border-border font-body', errors.brand && 'border-destructive', prefillData?.id && 'opacity-60 cursor-default')}
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
            className={cn('h-11 bg-secondary border-border font-body', prefillData?.id && 'opacity-60 cursor-default')}
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
            className={cn('h-11 bg-secondary border-border font-body', prefillData?.id && 'opacity-60 cursor-default')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addcan-date-added" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Date Added</Label>
          <Input
            id="addcan-date-added"
            type="date"
            max={format(new Date(), 'yyyy-MM-dd')}
            value={form.date_added}
            onChange={e => update('date_added', e.target.value)}
            className="h-11 bg-secondary border-border font-mono text-sm"
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
            className="h-11 bg-secondary border-border font-mono text-sm"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {alreadyVoted ? 'Your Vote (locked)' : prefillData?.id ? 'Cast Your Vote' : 'Your Rarity Vote'}
        </Label>
        {alreadyVoted ? (
          // pointer-events-none, not a blanket opacity on the row — that
          // used to wash out the SELECTED pill's own primary fill to 60%,
          // reading as a dimmer, distinctly different teal-green next to
          // the full-brightness "Collected" status pill just below. Only
          // the unselected pills get the muted treatment now; the locked
          // choice itself stays exactly as bright as any other confirmed
          // selection in this form.
          <div className="grid grid-cols-3 gap-2 pointer-events-none" role="radiogroup" aria-label="Your rarity vote (locked)">
            {RARITIES.map(r => {
              const selected = existingVote?.voted_rarity === r;
              return (
                <div
                  key={r}
                  role="radio"
                  aria-checked={selected}
                  aria-disabled="true"
                  className={cn(
                    'h-11 px-2 flex items-center justify-center text-center rounded-lg border text-xs font-mono font-semibold uppercase tracking-wider',
                    selected
                      ? 'bg-primary border-primary text-primary-foreground shadow'
                      : 'border-border text-muted-foreground opacity-60'
                  )}
                >
                  {r}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* role="group", not "radiogroup" -- matches the locked sibling
                block's intent (these buttons together are one rarity vote)
                without claiming role="radio"/arrow-key nav this never
                implements, same reasoning as BeverageTypeToggle.jsx.
                (/impeccable critique) */}
            {communityHint && (
              <p className="text-xs font-mono text-muted-foreground">
                Community says <span className="text-foreground font-semibold">{communityHint}</span> — your vote is your own call.
              </p>
            )}
            <div ref={voteGroupRef} className="grid grid-cols-3 gap-2" role="group" aria-label="Your rarity vote">
              {RARITIES.map(r => {
                const isPending = pendingRarity === r;
                const isConfirmed = form.rarity === r && !isPending;
                const isCommunity = communityHint === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => selectRarity(r)}
                    aria-pressed={isConfirmed}
                    aria-label={`${isPending ? `Confirm ${r}` : r}${isCommunity ? ', community pick' : ''}`}
                    className={cn(
                      'h-11 px-2 flex flex-col items-center justify-center text-center rounded-lg border text-xs font-mono font-semibold uppercase tracking-wider leading-tight transition-all',
                      isConfirmed
                        ? 'bg-primary border-primary text-primary-foreground shadow'
                        : isPending
                          ? 'bg-primary/15 border-primary text-primary ring-2 ring-primary/40'
                          : cn('text-muted-foreground hover:border-muted-foreground hover:text-foreground', isCommunity ? 'border-dashed border-foreground/40' : 'border-border')
                    )}
                  >
                    {r}
                    {/* The tier name stays on the pill being confirmed; it
                        used to be replaced by "Confirm?". */}
                    {isPending && <span className="text-2xs normal-case tracking-normal font-normal">tap again</span>}
                  </button>
                );
              })}
            </div>
            {/* The Community Rarity card above explains this same rule via a
                tap-to-open Popover, but that card only renders when
                prefillData?.id is set (existing catalog cans) — a brand-new
                can has no explanation anywhere before this commits. This
                stays visible unconditionally so the warning is never gated
                behind an optional interaction. */}
            <p className={cn('text-xs font-mono', voteNudge && !pendingRarity ? 'text-destructive' : 'text-muted-foreground')} aria-live="polite">
              {pendingRarity
                ? `Tap ${pendingRarity} again to lock it in.`
                : voteNudge
                  ? 'Pick a rarity first. Your vote locks once cast.'
                  : 'Vote locks once cast — choose carefully.'}
            </p>
          </div>
        )}
      </div>

      {/* A plain hairline, the only one in this form — everywhere else a
          field is separated from the next by the same space-y-5 rhythm and
          nothing else. Rarity is the one irreversible tap in this whole
          form and just rendered a hard lock; Beverage Type sits directly
          below it using near-identical pill chrome, with nothing signaling
          "the permanence ends here." A visual reset plus the explicit
          "change this anytime" line below answer that without inventing a
          second divider style anywhere else in the app. (/impeccable critique) */}
      <div className="h-px bg-border" />

      <div className="space-y-1.5">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Beverage Type</Label>
        <BeverageTypeToggle
          value={form.beverage_type}
          onChange={v => update('beverage_type', v)}
          disabled={!!prefillData?.id}
        />
        {!prefillData?.id && !prefillData?._offSource && (
          <p className="text-xs font-mono text-muted-foreground">You can change this anytime.</p>
        )}
        {/* Three distinct states a silent value can't tell apart on its own:
            an existing catalog can (locked, someone already decided this);
            a real OFF category guess (worth trusting more, but still just a
            guess); and OFF returning no usable category at all, where
            'energy_drink' below is a plain fallback, not a detection —
            without this line that case was indistinguishable from a real
            guess, so a wrong default could ship into the shared catalog
            with nothing telling the one person able to catch it that it
            was ever in question. (/impeccable critique) */}
        {prefillData?.id ? (
          <p className="text-xs font-mono text-muted-foreground">Set by this can's catalog entry.</p>
        ) : prefillData?._offSource && prefillData?.beverage_type ? (
          <p className="text-xs font-mono text-primary">Guessed from Open Food Facts — tap to change if wrong.</p>
        ) : prefillData?._offSource ? (
          <p className="text-xs font-mono text-warning">Open Food Facts didn't specify a category — defaulted to Energy Drink, please confirm.</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label id="addcan-status-label" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Status</Label>
        <div role="group" aria-labelledby="addcan-status-label" className="flex bg-secondary rounded-xl border border-border p-1 gap-1">
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

      {/* Everything below is genuinely optional — nothing here is needed to
          log the can, so it's collapsed by default rather than standing
          between Status and Submit on a flow PRODUCT.md frames as
          in-the-moment capture. */}
      <Collapsible open={showPersonalize} onOpenChange={handlePersonalizeToggle}>
        <CollapsibleTrigger
          ref={personalizeTriggerRef}
          type="button"
          className="flex items-center justify-between w-full h-11 group"
          aria-label={showPersonalize ? 'Hide personalize fields' : 'Show personalize fields'}
        >
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
            Personalize <span className="normal-case text-muted-foreground/70">— taste, photo, notes</span>
          </span>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform flex-shrink-0', showPersonalize && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-5 pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Taste Rating (optional)</Label>
            <TasteRatingStars value={form.taste_rating} onChange={v => update('taste_rating', v)} />
          </div>

          {!prefillData?.id && (
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Image (optional)</Label>
              {form.image_url ? (
                // Same component as the real tile, so it shows the tile you'll
                // get, rarity wash included.
                <div className="relative">
                  <CanImageBox
                    imageUrl={form.image_url}
                    rarity={tileRarity}
                    alt={form.name || 'Can'}
                    className="w-full h-40 rounded-xl border border-border"
                    loading="eager"
                  />
                  <button
                    onClick={() => update('image_url', '')}
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
                      className={cn('h-11 px-3 rounded-md text-xs font-mono transition-all flex items-center gap-1.5',
                        imageMode === 'upload' ? 'bg-card text-foreground' : 'text-muted-foreground')}
                    >
                      <Upload className="w-3 h-3" /> Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode('url')}
                      aria-pressed={imageMode === 'url'}
                      className={cn('h-11 px-3 rounded-md text-xs font-mono transition-all flex items-center gap-1.5',
                        imageMode === 'url' ? 'bg-card text-foreground' : 'text-muted-foreground')}
                    >
                      <LinkIcon className="w-3 h-3" /> Paste URL
                    </button>
                  </div>
                  {imageMode === 'upload' ? (
                    <label className="flex items-center justify-center gap-2 p-5 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors focus-within:ring-2 focus-within:ring-ring">
                      {uploading
                        ? <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        : <Upload className="w-5 h-5 text-muted-foreground" />}
                      <span className="text-sm text-muted-foreground font-mono">
                        {uploading ? 'Uploading...' : 'Tap to choose a photo'}
                      </span>
                      {/* sr-only, not hidden: display:none took the picker out of the tab
                          order, so a photo couldn't be added by keyboard. */}
                      <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
                    </label>
                  ) : (
                    <Input
                      aria-label="Image URL"
                      value={form.image_url}
                      onChange={e => update('image_url', e.target.value)}
                      placeholder="https://example.com/can.jpg"
                      className="h-11 bg-secondary border-border font-mono text-sm"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {prefillData?.id && prefillData.image_url && (
            <CanImageBox
              imageUrl={prefillData.image_url}
              rarity={tileRarity}
              alt={form.name || 'Can'}
              className="w-full h-40 rounded-xl border border-border"
              loading="eager"
            />
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
        </CollapsibleContent>
      </Collapsible>

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-11 flex-1 font-mono text-xs border-border"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="h-11 flex-1 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
        >
          {createMutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Zap className="w-4 h-4" />}
          {alreadyVoted ? 'Add to Vault' : needsVote && !pendingRarity ? 'Pick a rarity to add' : 'Vote & Add to Vault'}
        </Button>
      </div>
    </div>
  );
}
