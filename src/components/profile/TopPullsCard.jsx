import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Pin, ImageDown, X as XIcon } from 'lucide-react';
import { format } from 'date-fns';
import RarityBadge from '@/components/shared/RarityBadge';
import { MAX_PINS } from '@/hooks/useTogglePin';
import { getDisplayRarity, getConfidence, RARITY_HEX as RARITY_COLORS_HEX, rarityHexToRgba, RARITY_BG_CLASS } from '@/lib/rarityConsensus';
import { proxyImageUrl } from '@/lib/cardCapture';

// Capture-mode cell — proxied image, no links, no pin button, so it renders
// safely inside html2canvas. Carries the exact same visual language as the
// original ShareCardModal export card (not reinvented, per the shape brief).
function CaptureCell({ item, sharedCan }) {
  const conf = sharedCan ? getConfidence(sharedCan.total_votes) : 'unrated';
  const rarity = conf === 'unrated' ? null : getDisplayRarity(sharedCan || item);
  const imageUrl = item.can_image_url || sharedCan?.image_url;
  const color = rarity ? RARITY_COLORS_HEX[rarity] : '#6B7280';

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
      <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#F0F4F8', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.can_name || 'Unknown'}
        </div>
        <div style={{
          display: 'inline-flex', alignSelf: 'flex-start', fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
          letterSpacing: '0.05em', textTransform: 'uppercase', color,
          background: rarityHexToRgba(rarity || 'Common', 0.1),
          border: `1px solid ${rarityHexToRgba(rarity || 'Common', 0.3)}`,
          borderRadius: 6, padding: '2px 8px',
        }}>
          {rarity || '???'}
        </div>
      </div>
    </div>
  );
}

function EmptyCaptureCell() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ opacity: 0.15, fontSize: 20 }}>🥤</span>
    </div>
  );
}

// Renders in two modes from the same data: `live` is exactly what's on
// Profile.jsx (interactive, app-themed); `capture` is the branded,
// fixed-dimension export card html2canvas captures via `ref`. One owner
// for this markup instead of two hand-maintained copies that can drift.
const TopPullsCard = forwardRef(function TopPullsCard(
  {
    mode,
    top6,
    rarityBreakdown,
    latestAchievement,
    getEffectiveRarity,
    sharedCansMap = {},
    // live mode only
    pinnedCount,
    onTogglePin,
    pinPending,
    onShare,
    sharing,
    // capture mode only
    userName,
    score,
    totalCans,
    rarePulls,
    streak,
  },
  ref
) {
  if (mode === 'capture') {
    const filledCells = [...top6, ...Array(Math.max(0, 6 - top6.length)).fill(null)];
    const appUrl = typeof window !== 'undefined' ? window.location.origin.replace('https://', '').replace('http://', '') : '';

    return (
      <div
        ref={ref}
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
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, background: 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: 80, left: -60, width: 200, height: 200, background: 'radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%)', borderRadius: '50%' }} />

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
            <div style={{ fontSize: 15, fontWeight: 800, color: '#F0F4F8', lineHeight: 1.2 }}>{userName || 'Collector'}</div>
            <div style={{ fontSize: 11, color: '#00E5FF', fontFamily: 'monospace', marginTop: 2 }}>Score: {score}</div>
          </div>
        </div>

        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent)', margin: '0 24px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 24px' }}>
          {[
            { label: 'CANS', value: totalCans },
            { label: 'RARE', value: rarePulls },
            { label: 'STREAK', value: `${streak}d` },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#F0F4F8', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 8, color: 'rgba(240,244,248,0.4)', letterSpacing: '0.1em', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 10, color: 'rgba(0,229,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 10 }}>
            Top Pulls
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {filledCells.map((item, i) => (
              item
                ? <CaptureCell key={item.id} item={item} sharedCan={sharedCansMap[item.can_id]} />
                : <EmptyCaptureCell key={`empty-${i}`} />
            ))}
          </div>
        </div>

        {rarityBreakdown.length > 0 && (
          <div style={{ padding: '16px 20px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(0,229,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 8 }}>
              Rarity Breakdown
            </div>
            <div style={{ display: 'flex', height: 6, borderRadius: 9999, overflow: 'hidden', gap: 1 }}>
              {rarityBreakdown.map(({ rarity, pct }) => (
                <div key={rarity} style={{ width: `${pct}%`, height: '100%', background: RARITY_COLORS_HEX[rarity] || '#6B7280' }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 8 }}>
              {rarityBreakdown.map(({ rarity, count }) => (
                <span key={rarity} style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(240,244,248,0.5)' }}>
                  {rarity} <span style={{ color: '#F0F4F8' }}>{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {latestAchievement && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ fontSize: 9, color: 'rgba(0,229,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 8 }}>
              Latest Achievement
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ fontSize: 22 }}>{latestAchievement.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{latestAchievement.title}</div>
                {latestAchievement.unlockedAt && (
                  <div style={{ fontSize: 9, color: 'rgba(240,244,248,0.4)', fontFamily: 'monospace', marginTop: 2 }}>
                    {format(new Date(latestAchievement.unlockedAt), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 10, color: 'rgba(0,229,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
            {appUrl}
          </span>
        </div>
      </div>
    );
  }

  // live mode
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-primary/60">Top Pulls</p>
        <div className="flex items-center gap-2 min-w-0">
          {latestAchievement && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#FFD700] truncate">
              <span>{latestAchievement.icon}</span> {latestAchievement.title}
            </span>
          )}
          <button
            onClick={onShare}
            aria-label={sharing ? 'Close share card' : 'Create share card'}
            className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center flex-shrink-0"
          >
            {sharing ? <XIcon className="w-3.5 h-3.5" /> : <ImageDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {top6.map(item => (
          <div
            key={item.id}
            className="relative rounded-xl overflow-hidden border border-primary/20 bg-black/20 hover:border-primary/40 transition-colors"
          >
            <Link to={`/can/${item.can_id}`} className="block">
              <div className="aspect-square" style={{ backgroundColor: item.can_bg_color || '#0D2B2B' }}>
                {item.can_image_url ? (
                  <img
                    src={item.can_image_url}
                    alt={item.can_name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-lg opacity-20">🥤</span>
                  </div>
                )}
              </div>
              <div className="p-1.5 space-y-0.5">
                <p className="text-[10px] font-semibold text-foreground truncate">{item.can_name}</p>
                <RarityBadge rarity={getEffectiveRarity(item)} size="sm" />
              </div>
            </Link>
            <button
              onClick={() => onTogglePin(item)}
              disabled={pinPending}
              aria-label={item.pinned_at ? 'Unpin from showcase' : 'Pin to showcase'}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-background/90"
            >
              <Pin className={`w-3 h-3 transition-colors ${item.pinned_at ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
            </button>
          </div>
        ))}
      </div>
      {pinnedCount > 0 && (
        <p className="text-[10px] font-mono text-muted-foreground mt-2">
          {pinnedCount}/{MAX_PINS} pinned
        </p>
      )}

      {rarityBreakdown.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary/60 mb-2">Rarity Breakdown</p>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
            {rarityBreakdown.map(({ rarity, pct }) => (
              <div key={rarity} className={`h-full ${RARITY_BG_CLASS[rarity]}`} style={{ width: `${pct}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {rarityBreakdown.map(({ rarity, count }) => (
              <span key={rarity} className="text-[10px] font-mono text-muted-foreground">
                {rarity} <span className="text-foreground">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default TopPullsCard;
