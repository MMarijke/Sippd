import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Zap, Star, Package, ArrowLeft, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CollectionCard from '@/components/shared/CollectionCard';
import SippdBranding from '@/components/shared/SippdBranding';
import ProBadge from '@/components/shared/ProBadge';
import { useProStatus } from '@/hooks/useProStatus';
import { getDisplayRarity, getConfidence, getItemScore, RARITY_ORDER } from '@/lib/rarityConsensus';

// Standalone, no-AppLayout page for a single shared crate — same shape as
// PublicProfile.jsx (header, read-only CollectionCard, SippdBranding
// footer), but scoped to one crate's cans rather than a whole collection.
// Works fully logged out: get_public_crate is a capability link (see its
// migration's doc comment) — it doesn't check is_private the way
// get_public_collection does, since sharing one specific crate is a
// scoped, active choice its owner made, not a window into their whole
// account.
export default function SharedCrate() {
  const { crateId } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-crate', crateId, currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_crate', {
        p_caller_id: currentUser?.id ?? null,
        p_crate_id: crateId,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!crateId,
    retry: false,
  });

  const crate = data?.crate;
  const cans = useMemo(() => data?.cans ?? [], [data]);

  // /impeccable critique: Trophy Case's badge/hero tile never rendered here
  // despite this being the app's most externally-visible surface — fixed
  // the same way PublicProfile.jsx does it, off the crate owner's id.
  const proUserIds = useProStatus(crate?.owner_id ? [crate.owner_id] : []);
  const isOwnerPro = crate ? proUserIds.has(crate.owner_id) : false;

  const { data: sharedCans = [] } = useQuery({
    queryKey: ['shared-cans-public'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shared_cans').select('*').limit(500);
      if (error) throw error;
      return data;
    },
  });

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const getEffectiveRarity = (item) => {
    const sc = sharedCansMap[item.can_id];
    if (!sc) return item.can_rarity || 'Common';
    const conf = getConfidence(sc.total_votes);
    return conf === 'unrated' ? null : getDisplayRarity(sc);
  };

  const score = useMemo(
    () => cans.reduce((acc, item) => acc + getItemScore(item, sharedCansMap[item.can_id]), 0),
    [cans, sharedCansMap]
  );

  const rarePulls = useMemo(
    () => cans.filter(item => {
      const r = getEffectiveRarity(item);
      return r && ['Rare', 'Ultra Rare', 'Legendary'].includes(r);
    }).length,
    [cans, sharedCansMap]
  );

  const rarityBreakdown = useMemo(() => {
    const counts = {};
    cans.forEach(item => {
      const r = getEffectiveRarity(item);
      counts[r] = (counts[r] || 0) + 1;
    });
    return RARITY_ORDER
      .filter(r => counts[r])
      .map(r => ({ rarity: r, count: counts[r], pct: cans.length ? (counts[r] / cans.length) * 100 : 0 }));
  }, [cans, sharedCansMap]);

  if (!isLoading && isError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-5">
        <Package className="w-14 h-14 text-muted-foreground/20" />
        <p className="text-sm font-mono text-muted-foreground">This crate doesn&rsquo;t exist or has been deleted</p>
        <button onClick={() => navigate('/')} className="text-xs font-mono text-primary underline">Go to Sippd</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-6 pb-4 border-b border-border flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <p className="text-base font-display font-black text-foreground tracking-widest">SIPPD</p>
            <p className="text-[10px] font-mono text-muted-foreground -mt-0.5">Shared Crate</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4 pb-16">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center neon-glow flex-shrink-0 text-3xl">
                {crate.emoji || '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-display font-bold text-foreground truncate">{crate.name}</h1>
                {crate.description && (
                  <p className="text-xs font-mono text-muted-foreground truncate">{crate.description}</p>
                )}
                {/* text-muted-foreground, not a diluted /70 — same WCAG
                    failure class CollectionCard.jsx already caught and
                    fixed twice for its own labels; this line just hadn't
                    inherited that fix yet. Owner name links to their public
                    profile — previously plain text, the page's only path
                    toward the actual growth loop it exists to create. */}
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1">
                  Curated by{' '}
                  <Link to={`/u/${crate.owner_id}`} className="text-primary underline inline-flex items-center gap-1">
                    {crate.owner_name}
                    {isOwnerPro && <ProBadge />}
                  </Link>
                </p>
              </div>
            </div>

            {cans.length > 0 ? (
              <CollectionCard
                score={score}
                items={cans}
                isPro={isOwnerPro}
                rarityBreakdown={rarityBreakdown}
                getEffectiveRarity={getEffectiveRarity}
                stats={[
                  { icon: Zap, label: 'Cans', value: cans.length },
                  { icon: Star, label: 'Rare Pulls', value: rarePulls },
                ]}
              />
            ) : (
              <div className="flex flex-col items-center py-12 gap-3">
                <Package className="w-12 h-12 text-muted-foreground/20" />
                <p className="text-sm font-mono text-muted-foreground">This crate is empty</p>
              </div>
            )}

            {/* The actual growth loop this feature exists to create —
                previously the only CTA on the whole page was a small
                underlined "Sippd" wordmark in the footer below. Mirrors
                PublicProfile.jsx's own Sign-In-to-Follow pattern exactly
                (same button shape, same state.from redirect) rather than
                inventing a second one. */}
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center text-center gap-3">
              <p className="text-xs font-mono text-muted-foreground">
                {currentUser
                  ? `See more of ${crate.owner_name}'s collection`
                  : `${crate.owner_name} collects on Sippd — see their full vault`}
              </p>
              {currentUser ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 font-mono text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
                  onClick={() => navigate(`/u/${crate.owner_id}`)}
                >
                  <Users className="w-3.5 h-3.5" /> View Full Collection
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-11 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow"
                  onClick={() => navigate('/login', { state: { from: `/crate/${crateId}` } })}
                >
                  <UserPlus className="w-3.5 h-3.5" /> Sign In to Follow
                </Button>
              )}
            </div>

            <SippdBranding />
          </>
        )}
      </div>
    </div>
  );
}
