import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, Package, Pencil, RefreshCw, Trash2, Calendar, Tag,
  FileText, Users, ShieldCheck, ShieldAlert, StickyNote, Star, Info, CheckCircle,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useFavourite } from '@/hooks/useFavourite';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import RarityBadge from '@/components/shared/RarityBadge';
import { getDisplayRarity, getConfidence, RARITY_ORDER, RARITY_TEXT_CLASS } from '@/lib/rarityConsensus';
import { cn } from '@/lib/utils';
import DeleteConfirmDialog from '@/components/candetail/DeleteConfirmDialog';
import EditEntrySheet from '@/components/candetail/EditEntrySheet';
import CanImageBox from '@/components/shared/CanImageBox';
import { toast } from 'sonner';

// Invert VOTE_FIELDS: field name → tier label
const VOTE_LABELS = Object.fromEntries(
  Object.entries({ Common: 'common_votes', Uncommon: 'uncommon_votes', Rare: 'rare_votes', 'Ultra Rare': 'ultra_rare_votes', Legendary: 'legendary_votes' })
    .map(([tier, field]) => [field, tier])
);

const STATUS_CONFIG = {
  collected: { label: 'In Vault', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  wishlist:  { label: 'Wishlist', color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/30'    },
  duplicate: { label: 'Duplicate', color: 'text-muted-foreground', bg: 'bg-secondary border-border' },
};

export default function CanDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canId = window.location.pathname.split('/can/')[1];
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const { toggleFavourite } = useFavourite();

  const {
    data: collectionItems = [],
    isLoading: isLoadingCollectionItems,
    isError: isCollectionItemsError,
    refetch: refetchCollectionItems,
  } = useQuery({
    queryKey: ['user-collection', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    data: can,
    isLoading: isLoadingCan,
    isError: isCanError,
    refetch: refetchCan,
  } = useQuery({
    queryKey: ['shared-can', canId],
    queryFn: async () => {
      const { data, error } = await supabase.from('shared_cans').select('*').eq('id', canId).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!canId,
  });

  const {
    data: myVote,
    isLoading: isLoadingMyVote,
    isError: isMyVoteError,
    refetch: refetchMyVote,
  } = useQuery({
    queryKey: ['rarity-vote', canId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rarity_votes')
        .select('*')
        .eq('can_id', canId)
        .eq('voter_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!canId && !!user?.id,
  });

  const isLoading = isLoadingCan || isLoadingCollectionItems || isLoadingMyVote;
  const isError = isCanError || isCollectionItemsError || isMyVoteError;

  useEffect(() => {
    if (isError) toast.error("Couldn't load this can");
  }, [isError]);

  const item = collectionItems.find(c => c.can_id === canId);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('user_collection')
        .delete()
        .eq('id', item.id)
        .eq('owner_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-collection'] });
      setShowDelete(false);
      navigate('/collection');
    },
    onError: (error) => {
      toast.error('Failed to remove from collection: ' + (error?.message || 'Unknown error'));
    },
  });

  const name = item?.can_name || can?.name || 'Unknown';
  const brand = item?.can_brand || can?.brand || '';
  const imageUrl = item?.can_image_url || can?.image_url;
  const flavour = item?.can_flavour || can?.flavour;
  const edition = item?.can_edition || can?.edition;

  const totalVotes = can?.total_votes || 0;
  const confidence = getConfidence(totalVotes);
  const rarity = confidence === 'unrated' ? '???' : (can ? getDisplayRarity(can) : (item?.can_rarity || 'Common'));

  const rarityBreakdown = can
    ? RARITY_ORDER
        .map(r => {
          const fieldKey = Object.keys(VOTE_LABELS).find(k => VOTE_LABELS[k] === r);
          return { rarity: r, votes: can[fieldKey] || 0 };
        })
        .filter(b => b.votes > 0)
        .sort((a, b) => b.votes - a.votes)
    : [];

  // No fallback to 'collected' — an absent item means this can isn't in
  // the viewer's vault at all (unowned, or their collection is still
  // loading), and showing "In Vault" in either case would be a lie.
  const statusCfg = item ? (STATUS_CONFIG[item.status] || STATUS_CONFIG.collected) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="w-full aspect-square bg-card/40 animate-pulse rounded-none" />
        <div className="h-8 w-48 bg-card/40 animate-pulse rounded-xl mx-5 mt-4" />
        <div className="h-6 w-24 bg-card/40 animate-pulse rounded-full mx-5 mt-2" />
        <div className="grid grid-cols-2 gap-3 px-5 mt-4">
          <div className="h-20 bg-card/40 animate-pulse rounded-2xl" />
          <div className="h-20 bg-card/40 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background px-5 pt-24">
        <div className="bg-card border border-destructive/30 rounded-2xl p-10 flex flex-col items-center text-center">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Couldn't load this can</p>
          <Button
            variant="outline"
            size="sm"
            className="h-11 mt-4 font-mono text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => { refetchCan(); refetchCollectionItems(); refetchMyVote(); }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (can == null && !item) {
    return (
      <div className="min-h-screen bg-background px-5 pt-24">
        <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center">
          <Package className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm font-display font-semibold text-foreground">Can not found</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">It may have been removed.</p>
          <Button
            variant="outline"
            size="sm"
            className="h-11 mt-4 font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => navigate('/collection')}
          >
            Back to Collection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero image */}
      <div className="relative">
        <div className="w-full aspect-[4/3] relative overflow-hidden max-h-[55vw] min-h-[240px]">
          <CanImageBox
            imageUrl={imageUrl}
            bgColor={item?.can_bg_color}
            alt={name}
            className="w-full h-full"
            iconSize="w-24 h-24"
            objectFit="contain"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute top-4 left-4 w-11 h-11 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        {/* Actions (only if user has this in their collection) */}
        {item && (
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => toggleFavourite({ collectionItem: item, sharedCan: can })}
              aria-label={item.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
              aria-pressed={item.is_favourite}
              className={cn(
                'w-11 h-11 rounded-lg backdrop-blur-sm flex items-center justify-center border transition-colors',
                item.is_favourite
                  ? 'bg-primary/20 border-primary/40'
                  : 'bg-background/80 border-border'
              )}
            >
              <Star className={cn('w-4 h-4', item.is_favourite ? 'fill-primary text-primary' : 'text-foreground')} />
            </button>
            <button
              onClick={() => setShowEdit(true)}
              aria-label="Edit entry"
              className="w-11 h-11 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border"
            >
              <Pencil className="w-4 h-4 text-foreground" />
            </button>
          </div>
        )}
      </div>

      {can?.verified && can?.verified_by && (
        <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5">
          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-xs font-mono text-primary">
            Verified by {can?.verified_by}
          </p>
        </div>
      )}

      {/* Content */}
      <div className="px-5 -mt-6 relative z-10 space-y-4 pb-32">

        {/* Title block */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground leading-tight">{name}</h1>
          <p className="text-sm font-mono text-primary mt-0.5">{brand}</p>
        </div>

        {/* Status + Rarity row */}
        <div className="flex items-center gap-2 flex-wrap">
          {statusCfg && (
            <span className={cn('text-xs font-mono font-semibold px-2.5 py-1 rounded-full border', statusCfg.bg, statusCfg.color)}>
              {statusCfg.label}
            </span>
          )}
          {confidence !== 'unrated' && <RarityBadge rarity={rarity} size="md" />}
          {confidence === 'unrated' && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
              <ShieldAlert className="w-2.5 h-2.5" /> Unrated
            </span>
          )}
          {confidence === 'low' && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-yellow-400 border border-yellow-400/30 rounded px-1.5 py-0.5">
              <ShieldAlert className="w-2.5 h-2.5" /> Low Confidence
            </span>
          )}
          {confidence === 'confirmed' && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-primary border border-primary/30 rounded px-1.5 py-0.5">
              <ShieldCheck className="w-2.5 h-2.5" /> Confirmed
            </span>
          )}
        </div>

        {/* Rarity consensus section */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Community Rarity
              <Popover>
                <PopoverTrigger
                  className="p-2 -m-2 normal-case tracking-normal text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="How Community Rarity works"
                >
                  <Info className="w-3 h-3" />
                </PopoverTrigger>
                <PopoverContent className="w-64 text-xs font-mono leading-relaxed normal-case tracking-normal" side="top" align="start">
                  <p className="font-semibold text-foreground mb-1">How Community Rarity works</p>
                  <p className="text-muted-foreground">
                    Collectors vote on each can's rarity. A tier shows once 5+ votes come in (low confidence), and locks in as confirmed at 15+. Your vote can't be changed once cast — that keeps the count trustworthy.
                  </p>
                </PopoverContent>
              </Popover>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
          </div>

          {confidence === 'unrated' ? (
            <div>
              <p className="text-3xl font-display font-black tracking-wide text-muted-foreground">? ? ?</p>
              <p className="text-[11px] font-mono text-muted-foreground mt-1">Not enough votes yet — need {Math.max(0, 5 - totalVotes)} more</p>
            </div>
          ) : (
            <p className={cn('text-3xl font-display font-black tracking-wide', RARITY_TEXT_CLASS[rarity] || 'text-foreground')}>
              {rarity}
            </p>
          )}

          {/* Vote breakdown */}
          {rarityBreakdown.length > 0 ? (
            <div className="space-y-1.5">
              {rarityBreakdown.map(({ rarity: r, votes }) => (
                <div key={r} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-20 flex-shrink-0">{r}</span>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(votes / totalVotes) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-6 text-right tabular-nums">{votes}</span>
                </div>
              ))}
              <p className="text-[10px] font-mono text-muted-foreground pt-1">
                {rarityBreakdown.map(({ rarity: r, votes }) => `${r}: ${votes}`).join(' · ')}
              </p>
            </div>
          ) : (
            <p className="text-xs font-mono text-muted-foreground">No votes yet</p>
          )}

          {/* User's own vote */}
          {myVote && (
            <div className="pt-2 border-t border-border">
              <p className="text-[11px] font-mono text-muted-foreground">
                Your vote:{' '}
                <span className={cn('font-semibold', RARITY_TEXT_CLASS[myVote.voted_rarity] || 'text-foreground')}>
                  {myVote.voted_rarity}
                </span>
                <span className="ml-1 text-muted-foreground">· locked</span>
              </p>
            </div>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3">
          {flavour && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Tag className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Flavour</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{flavour}</p>
            </div>
          )}
          {edition && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Edition</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{edition}</p>
            </div>
          )}
          {item?.created_at && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Added</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {format(new Date(item.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        {item?.notes && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Notes</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{item.notes}</p>
          </div>
        )}

        {/* Delete */}
        {item && (
          <Button
            variant="outline"
            className="w-full font-mono text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 mt-4"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="w-4 h-4" />
            Remove from Collection
          </Button>
        )}
      </div>

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={showDelete}
        onCancel={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
        canName={name}
      />

      {/* Edit sheet */}
      {item && (
        <EditEntrySheet
          open={showEdit}
          onClose={() => setShowEdit(false)}
          item={item}
          myVote={myVote}
        />
      )}
    </div>
  );
}
