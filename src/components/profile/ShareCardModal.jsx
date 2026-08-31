import { useRef, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { X, ArrowLeft, Download, Loader2, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDisplayRarity, getConfidence, getItemScore, RARITY_HEX as RARITY_COLORS_HEX, rarityHexToRgba } from '@/lib/rarityConsensus';
import { useCollectionHighlights } from '@/hooks/useCollectionHighlights';
import { useShare } from '@/hooks/useShare';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function proxyImageUrl(url) {
  if (!url) return null;
  // Supabase Storage URLs already have CORS — don't proxy them
  if (url.includes(SUPABASE_URL) || url.includes('supabase.co')) return url;
  // Proxy all other external URLs
  return `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
}

function CanCell({ item, sharedCan }) {
  const conf = sharedCan ? getConfidence(sharedCan.total_votes) : 'unrated';
  const rarity = conf === 'unrated' ? null : getDisplayRarity(sharedCan || item);
  const imageUrl = item.can_image_url || sharedCan?.image_url;
  const color = rarity ? RARITY_COLORS_HEX[rarity] : '#6B7280';
  const bg = rarity ? rarityHexToRgba(rarity, 0.15) : rarityHexToRgba('Common', 0.1);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}33`,
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Image */}
      <div style={{ width: '100%', aspectRatio: '1', background: item.can_bg_color || '#0D2B2B', position: 'relative', overflow: 'hidden' }}>
        {imageUrl ? (
          <img
            src={proxyImageUrl(imageUrl)}
            alt={item.can_name}
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 28, opacity: 0.2 }}>🥤</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '6px 8px 8px' }}>
        <div style={{ fontSize: 9, color: '#00E5FF', fontFamily: 'monospace', opacity: 0.7, marginBottom: 2, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.can_brand}
        </div>
        <div style={{ fontSize: 10, color: '#F0F4F8', fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
          {item.can_name || 'Unknown'}
        </div>
        <div style={{
          display: 'inline-block',
          fontSize: 8,
          fontFamily: 'monospace',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: color,
          background: bg,
          border: `1px solid ${color}55`,
          borderRadius: 4,
          padding: '2px 5px',
        }}>
          {rarity || '? ? ?'}
        </div>
      </div>
    </div>
  );
}

export default function ShareCardModal({ user, onClose, variant = 'profile', monthlyData }) {
  const cardRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [cardDataUrl, setCardDataUrl] = useState(null);

  // The monthly variant receives its content as props (MonthlyReport
  // already computes it, month-scoped) — these queries only run for the
  // profile variant, which needs the whole collection.
  const { data: collection = [] } = useQuery({
    queryKey: ['user-collection', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('*')
        .eq('owner_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: variant === 'profile' && !!user?.id,
  });

  const { data: sharedCans = [] } = useQuery({
    queryKey: ['shared-cans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_cans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: variant === 'profile',
  });

  const { data: votes = [] } = useQuery({
    queryKey: ['my-votes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rarity_votes')
        .select('*')
        .eq('voter_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: variant === 'profile' && !!user?.id,
  });

  const sharedCansMap = useMemo(
    () => Object.fromEntries(sharedCans.map(c => [c.id, c])),
    [sharedCans]
  );

  const streak = user?.current_streak || 0;

  const { collected, getEffectiveRarity, top6, rarityBreakdown, latestAchievement } = useCollectionHighlights({
    collection,
    sharedCansMap,
    streak,
    voteCount: votes.length,
    userCreatedDate: user?.created_at,
  });

  const score = collected.reduce((acc, item) => acc + getItemScore(item, sharedCansMap[item.can_id]), 0);
  const rarePulls = collected.filter(i => ['Rare', 'Ultra Rare', 'Legendary'].includes(getEffectiveRarity(i))).length;

  const appUrl = window.location.origin;

  const [saving, setSaving] = useState(false);
  const { shareFile } = useShare();

  // Unifies what the two variants render: the monthly variant's content
  // arrives fully computed via props; the profile variant computes its
  // own from the queries above. Everything downstream (JSX, signature)
  // reads from this instead of branching on `variant` repeatedly.
  const cardData = useMemo(() => {
    if (variant === 'monthly' && monthlyData) {
      return {
        kind: 'monthly',
        monthLabel: monthlyData.monthLabel,
        stats: [
          { label: 'CANS', value: monthlyData.cansAdded },
          { label: 'SCORE', value: `+${monthlyData.monthScore}` },
          { label: 'STREAK', value: `${monthlyData.streak}d` },
        ],
        bestPull: monthlyData.bestPull,
        bestPullImage: monthlyData.bestPullImage,
        bestPullRarity: monthlyData.bestPullRarity,
        rarityBreakdown: monthlyData.rarityBreakdown,
      };
    }
    return {
      kind: 'profile',
      stats: [
        { label: 'CANS', value: collected.length },
        { label: 'RARE', value: rarePulls },
        { label: 'STREAK', value: `${streak}d` },
      ],
      top6,
      rarityBreakdown,
      latestAchievement,
    };
  }, [variant, monthlyData, collected.length, rarePulls, streak, top6, rarityBreakdown, latestAchievement]);

  // Everything that actually appears on the rendered card, condensed into
  // one comparable value — watching this instead of raw array lengths
  // means a rarity-vote update, pin toggle, or streak change (any of
  // which can leave collected.length/sharedCans.length unchanged) still
  // triggers a regeneration instead of leaving a stale card on screen.
  const cardSignature = useMemo(() => {
    if (cardData.kind === 'monthly') {
      return JSON.stringify({
        monthLabel: cardData.monthLabel,
        stats: cardData.stats,
        bestPullId: cardData.bestPull?.id || null,
        bestPullRarity: cardData.bestPullRarity,
        rarityBreakdown: cardData.rarityBreakdown,
      });
    }
    const cans = cardData.top6.map(item => `${item.id}:${getEffectiveRarity(item)}:${item.pinned_at || ''}`).join('|');
    const breakdown = cardData.rarityBreakdown.map(r => `${r.rarity}:${r.count}`).join(',');
    return `${cans}__${breakdown}__${cardData.latestAchievement?.title || ''}__${streak}__${score}`;
  }, [cardData, streak, score]);

  const generateCard = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    setCardDataUrl(null);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#080C14',
        logging: false,
      });
      setCardDataUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      toast.error('Failed to generate card');
    }
    setGenerating(false);
  };

  // Auto-generate on open, and whenever the card's actual content changes
  useEffect(() => {
    const t = setTimeout(generateCard, 300);
    return () => clearTimeout(t);
  }, [cardSignature]);

  // Hardware back button (Android)
  useEffect(() => {
    window.history.pushState({ shareCard: true }, '');
    const handlePopState = (e) => {
      if (e.state?.shareCard) onClose();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Convert data URL to Blob without fetch (works everywhere)
  const dataUrlToBlob = (dataUrl) => {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const handleSave = async () => {
    if (!cardDataUrl) return;
    setSaving(true);
    try {
      const blob = dataUrlToBlob(cardDataUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cardData.kind === 'monthly'
        ? `sippd-recap-${cardData.monthLabel.replace(/\s+/g, '-')}.png`
        : `sippd-${(user?.full_name || 'collection').replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Saved!');
    } catch (e) {
      toast.error('Failed to save');
    }
    setSaving(false);
  };

  const handleInstagram = async () => {
    if (!cardDataUrl) return;
    setSaving(true);
    try {
      const blob = dataUrlToBlob(cardDataUrl);
      const filename = cardData.kind === 'monthly'
        ? `sippd-recap-${cardData.monthLabel.replace(/\s+/g, '-')}.png`
        : 'sippd-collection.png';

      // Try Web Share API with files (works on mobile Safari/Chrome)
      const result = await shareFile({ blob, filename, title: cardData.kind === 'monthly' ? `My ${cardData.monthLabel} Sippd Recap` : 'My Sippd Collection' });
      if (result.supported) {
        if (result.error) toast.error('Could not share to Instagram');
        setSaving(false);
        return;
      }

      // Fallback: download image + open Instagram
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Image saved! Open Instagram and post it to your feed.', { duration: 4000 });
      setTimeout(() => {
        window.open('instagram://app', '_blank');
      }, 800);
    } catch (e) {
      if (e.name !== 'AbortError') toast.error('Could not share to Instagram');
    }
    setSaving(false);
  };

  const content = (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
        <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-mono">Back</span>
        </Button>
        <h2 className="text-sm font-display font-bold text-foreground tracking-wide">{cardData.kind === 'monthly' ? 'Recap Card' : 'Share Card'}</h2>
        <Button size="icon" variant="ghost" className="w-11 h-11 text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Close">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 py-6 gap-5">
        {/* Hidden card for html2canvas — not visible to user */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <div
          ref={cardRef}
          style={{
            width: 360,
            minHeight: 640,
            background: 'linear-gradient(160deg, #0D1320 0%, #080C14 60%, #0A1018 100%)',
            borderRadius: 20,
            overflow: 'hidden',
            fontFamily: "'Exo 2', sans-serif",
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {/* Cyan glow blobs */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, background: 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: 80, left: -60, width: 200, height: 200, background: 'radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%)', borderRadius: '50%' }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 24px 16px' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#00E5FF', fontSize: 14 }}>⚡</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#00E5FF', letterSpacing: '0.15em', lineHeight: 1 }}>SIPPD</div>
                <div style={{ fontSize: 8, color: 'rgba(0,229,255,0.5)', letterSpacing: '0.05em', marginTop: 1 }}>ENERGY DRINK TRACKER</div>
              </div>
            </div>
            {/* User info */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#F0F4F8', lineHeight: 1.2 }}>{user?.full_name || 'Collector'}</div>
              <div style={{ fontSize: 11, color: '#00E5FF', fontFamily: 'monospace', marginTop: 2 }}>
                {cardData.kind === 'monthly' ? `${cardData.monthLabel} Recap` : `Score: ${score}`}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent)', margin: '0 24px' }} />

          {/* Stats row */}
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 24px' }}>
            {cardData.stats.map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#F0F4F8', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 8, color: 'rgba(240,244,248,0.4)', letterSpacing: '0.1em', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          {cardData.kind === 'monthly' ? (
            /* Best Pull of the Month */
            <div style={{ padding: '0 20px' }}>
              <div style={{ fontSize: 9, color: 'rgba(0,229,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 10 }}>
                Best Pull of the Month
              </div>
              {cardData.bestPull ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${(RARITY_COLORS_HEX[cardData.bestPullRarity] || '#6B7280')}33`, borderRadius: 14, padding: 12 }}>
                  <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', background: cardData.bestPull.can_bg_color || '#0D2B2B', flexShrink: 0 }}>
                    {cardData.bestPullImage ? (
                      <img
                        src={proxyImageUrl(cardData.bestPullImage)}
                        alt={cardData.bestPull.can_name}
                        crossOrigin="anonymous"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 24, opacity: 0.2 }}>🥤</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: '#00E5FF', fontFamily: 'monospace', opacity: 0.7, textTransform: 'uppercase', marginBottom: 2 }}>{cardData.bestPull.can_brand}</div>
                    <div style={{ fontSize: 15, color: '#F0F4F8', fontWeight: 800, lineHeight: 1.2, marginBottom: 6 }}>{cardData.bestPull.can_name}</div>
                    <div style={{
                      display: 'inline-block', fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                      color: RARITY_COLORS_HEX[cardData.bestPullRarity] || '#6B7280',
                      background: rarityHexToRgba(cardData.bestPullRarity || 'Common', 0.15),
                      border: `1px solid ${(RARITY_COLORS_HEX[cardData.bestPullRarity] || '#6B7280')}55`,
                      borderRadius: 4, padding: '3px 7px',
                    }}>
                      {cardData.bestPullRarity || '???'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: 'rgba(240,244,248,0.3)', fontFamily: 'monospace' }}>No pulls yet this month</span>
                </div>
              )}
            </div>
          ) : (
            /* Top 6 grid */
            <div style={{ padding: '0 20px' }}>
              <div style={{ fontSize: 9, color: 'rgba(0,229,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 10 }}>
                TOP PULLS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(cardData.top6.length > 0 ? cardData.top6 : Array(6).fill(null)).map((item, i) => (
                  item ? (
                    <CanCell key={item.id} item={item} sharedCan={sharedCansMap[item.can_id]} />
                  ) : (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px dashed rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      aspectRatio: '3/4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span style={{ opacity: 0.15, fontSize: 20 }}>🥤</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Rarity bar */}
          {cardData.rarityBreakdown.length > 0 && (
            <div style={{ padding: '16px 20px 12px' }}>
              <div style={{ fontSize: 9, color: 'rgba(0,229,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 8 }}>
                RARITY BREAKDOWN
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                {cardData.rarityBreakdown.map(({ rarity, pct }) => (
                  <div key={rarity} style={{ width: `${pct}%`, background: RARITY_COLORS_HEX[rarity] || '#6B7280', borderRadius: 2 }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
                {cardData.rarityBreakdown.map(({ rarity, count }) => (
                  <div key={rarity} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: RARITY_COLORS_HEX[rarity] }} />
                    <span style={{ fontSize: 9, color: 'rgba(240,244,248,0.5)', fontFamily: 'monospace' }}>{rarity} {count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Latest Achievement — profile variant only */}
          {cardData.kind === 'profile' && cardData.latestAchievement && (
            <div style={{ padding: '0 20px 16px' }}>
              <div style={{ fontSize: 9, color: 'rgba(0,229,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 8 }}>
                Latest Achievement
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 10, padding: '8px 12px' }}>
                <span style={{ fontSize: 22 }}>{cardData.latestAchievement.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cardData.latestAchievement.title}</div>
                  {cardData.latestAchievement.unlockedAt && (
                    <div style={{ fontSize: 9, color: 'rgba(240,244,248,0.4)', fontFamily: 'monospace', marginTop: 2 }}>
                      {format(new Date(cardData.latestAchievement.unlockedAt), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '0 0' }}>
            <span style={{ fontSize: 10, color: 'rgba(0,229,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
              {appUrl.replace('https://', '').replace('http://', '')}
            </span>
          </div>
        </div>
        </div>{/* end hidden wrapper */}

        {/* Generated image preview — the only visible card */}
        {generating && (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs font-mono text-muted-foreground">Generating card…</p>
          </div>
        )}

        {cardDataUrl && !generating && (
          <div className="w-full max-w-[360px]">
            <p className="text-[10px] font-mono text-muted-foreground text-center mb-2">Long-press the image to save</p>
            <img src={cardDataUrl} alt="Share card" className="w-full rounded-2xl border border-border" />
          </div>
        )}

        {/* Action button */}
        <Button
          className="w-full max-w-[360px] font-mono text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleSave}
          disabled={!cardDataUrl || generating || saving}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>

        {/* Instagram share button */}
        <Button
          className="w-full max-w-[360px] font-mono text-xs gap-2"
          style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)', color: '#fff', border: 'none' }}
          onClick={handleInstagram}
          disabled={!cardDataUrl || generating || saving}
        >
          <Instagram className="w-4 h-4" />
          Share to Instagram
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-xs text-muted-foreground gap-2"
          onClick={generateCard}
          disabled={generating}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '↻'} Regenerate
        </Button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
