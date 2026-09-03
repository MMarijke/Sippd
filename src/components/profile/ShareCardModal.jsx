import { useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, Download, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RARITY_HEX as RARITY_COLORS_HEX, rarityHexToRgba } from '@/lib/rarityConsensus';
import { proxyImageUrl } from '@/lib/cardCapture';
import { useCardCapture } from '@/hooks/useCardCapture';

// Recap card for MonthlyReport.jsx. This used to also serve Profile.jsx's
// Top Pulls export (a `variant="profile"` path) — that now lives in
// CollectionCard's own capture mode plus Profile.jsx's inline share flow,
// both built on the same useCardCapture hook this file uses. This file only
// ever renders the monthly recap shape now.
export default function ShareCardModal({ user, onClose, monthlyData }) {
  const cardRef = useRef(null);

  const cardData = useMemo(() => ({
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
  }), [monthlyData]);

  const cardSignature = useMemo(() => JSON.stringify({
    monthLabel: cardData.monthLabel,
    stats: cardData.stats,
    bestPullId: cardData.bestPull?.id || null,
    bestPullRarity: cardData.bestPullRarity,
    rarityBreakdown: cardData.rarityBreakdown,
  }), [cardData]);

  const { generating, cardDataUrl, saving, generateCard, handleSave, handleShareImage } = useCardCapture(cardRef, cardSignature);

  const filename = `sippd-recap-${cardData.monthLabel.replace(/\s+/g, '-')}.png`;

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

  // Escape to close (keyboard-only users have no other way out besides
  // tabbing to one of the two close buttons)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const content = (
    <div role="dialog" aria-modal="true" aria-labelledby="share-card-title" className="fixed inset-0 z-[100] flex flex-col bg-background overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
        <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-mono">Back</span>
        </Button>
        <h2 id="share-card-title" className="text-sm font-display font-bold text-foreground tracking-wide">Recap Card</h2>
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
            background: 'linear-gradient(135deg, #0D2B2B 0%, #080C14 100%)',
            border: '1px solid rgba(0,229,255,0.3)',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#00E5FF', fontSize: 14 }}>⚡</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#00E5FF', letterSpacing: '0.15em', lineHeight: 1 }}>SIPPD</div>
                <div style={{ fontSize: 8, color: 'rgba(0,229,255,0.5)', letterSpacing: '0.05em', marginTop: 1 }}>ENERGY DRINK TRACKER</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#F0F4F8', lineHeight: 1.2 }}>{user?.full_name || 'Collector'}</div>
              <div style={{ fontSize: 11, color: '#00E5FF', fontFamily: 'monospace', marginTop: 2 }}>
                {cardData.monthLabel} Recap
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

          {/* Best Pull of the Month */}
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

          {/* Rarity bar */}
          {cardData.rarityBreakdown.length > 0 && (
            <div style={{ padding: '16px 20px 12px' }}>
              <div style={{ fontSize: 10, color: 'rgba(0,229,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 8 }}>
                Rarity Breakdown
              </div>
              <div style={{ display: 'flex', height: 6, borderRadius: 9999, overflow: 'hidden', gap: 1 }}>
                {cardData.rarityBreakdown.map(({ rarity, pct }) => (
                  <div key={rarity} style={{ width: `${pct}%`, height: '100%', background: RARITY_COLORS_HEX[rarity] || '#6B7280' }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 8 }}>
                {cardData.rarityBreakdown.map(({ rarity, count }) => (
                  <span key={rarity} style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(240,244,248,0.5)' }}>
                    {rarity} <span style={{ color: '#F0F4F8' }}>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 10, color: 'rgba(0,229,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
              {typeof window !== 'undefined' ? window.location.origin.replace('https://', '').replace('http://', '') : ''}
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
            <img src={cardDataUrl} alt="Recap card" className="w-full rounded-2xl border border-border" />
          </div>
        )}

        {/* Action button */}
        <Button
          className="w-full max-w-[360px] font-mono text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => handleSave(filename)}
          disabled={!cardDataUrl || generating || saving}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>

        {/* Share button — hands the image to the OS share sheet */}
        <Button
          variant="outline"
          className="w-full max-w-[360px] font-mono text-xs gap-2 border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => handleShareImage(filename, `My ${cardData.monthLabel} Sippd Recap`)}
          disabled={!cardDataUrl || generating || saving}
        >
          <Share2 className="w-4 h-4" />
          Share Image
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
