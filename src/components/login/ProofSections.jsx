import { Flame, Star as StarIcon, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import RarityBadge from '@/components/shared/RarityBadge';

// Phone: heading, line, then the demo, stacked. Desktop: a two-column row
// across the page, the demo alternating sides so the three sections read
// as a sequence rather than three identical blocks.
function ProofSection({ title, copy, flip = false, children }) {
  return (
    <section className="px-5 py-16 lg:py-24 border-t border-border">
      <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-2 lg:items-center lg:gap-20">
        <div className={cn(flip && 'lg:order-2')}>
          <h2 className="font-display font-black text-3xl lg:text-5xl text-foreground mb-2 lg:mb-4 text-balance">{title}</h2>
          <p className="text-sm lg:text-lg font-body text-muted-foreground mb-6 lg:mb-0 max-w-sm">{copy}</p>
        </div>
        <div className={cn('w-full max-w-sm lg:max-w-md', flip ? 'lg:order-1 lg:justify-self-start' : 'lg:justify-self-end')}>
          {children}
        </div>
      </div>
    </section>
  );
}

// Three full-width scroll sections, each a real product mechanism at
// honest scale rather than a shrunk preview card — recreated from the
// actual component patterns (CollectorsLeaderboard's medal/rank/score
// markup, ActivityCard's header/reaction-row, CollectionCard's real
// .hero-card token) so a first-time visitor sees the interface itself,
// not an illustration of it. Names/counts are representative placeholders;
// this page has no session to draw real data from. Section headings stay
// short and un-numbered — the sequence itself carries no information a
// reader needs, so no "01/02/03" kicker.

export function LeaderboardProof() {
  const rows = [
    { rank: 1, name: 'Juno R.', cans: 412, medal: '🥇', color: 'text-yellow-400' },
    { rank: 2, name: 'Silas K.', cans: 389, medal: '🥈', color: 'text-slate-300' },
    { rank: 3, name: 'Wren T.', cans: 351, medal: '🥉', color: 'text-amber-600' },
  ];
  return (
    <ProofSection
      title="Climb the ranks."
      copy="Compete with collectors worldwide by total cans or rare pulls."
    >
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border bg-card">
        {rows.map(r => (
          <div key={r.rank} className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-7 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
              <span className={cn('text-base leading-none', r.color)} aria-hidden="true">{r.medal}</span>
              <span className="text-xs font-mono text-muted-foreground leading-none">#{r.rank}</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-display font-bold text-foreground flex-shrink-0">
              {r.name[0]}
            </div>
            <p className="flex-1 text-sm font-semibold text-foreground truncate">{r.name}</p>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-display font-bold tabular-nums text-foreground">{r.cans}</p>
              <p className="text-2xs font-mono text-muted-foreground">cans</p>
            </div>
          </div>
        ))}
      </div>
    </ProofSection>
  );
}

export function FeedProof() {
  return (
    <ProofSection
      title="Share every pull."
      copy="Your friends see it the moment it happens."
      flip
    >
      <div className="rounded-2xl border border-rarity-rare/30 rarity-glow-rare bg-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-display font-bold text-primary flex-shrink-0">
            W
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Wren T.</p>
            <p className="text-2xs font-mono text-muted-foreground">2m ago</p>
          </div>
        </div>
        <p className="text-xs font-mono text-muted-foreground leading-relaxed">
          <span className="text-foreground">added </span>
          <span className="text-foreground font-semibold">Comet Fizz</span>
          <span className="text-foreground"> to their vault</span>
        </p>
        <RarityBadge rarity="Rare" />
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          {[{ Icon: Flame, n: 12 }, { Icon: StarIcon, n: 4 }].map(({ Icon, n }, i) => (
            <div key={i} className="h-8 px-2.5 flex items-center gap-1 rounded-full text-xs font-mono border bg-secondary border-border text-muted-foreground">
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="tabular-nums">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </ProofSection>
  );
}

export function CollectionProof() {
  const tiles = ['#0C1D38', '#170B33', '#2B0D1F', '#0D1F0D', '#2B0F0F', '#1C1C1E'];
  return (
    <ProofSection
      title="Build your vault."
      copy="Every can, cataloged, scored, and yours to show off."
    >
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="hero-card rounded-2xl p-4 mb-3 text-center">
          <p className="text-2xs font-mono uppercase tracking-widest text-foreground">Collection Score</p>
          <p className="text-4xl font-mono font-black text-foreground tabular-nums">2,140</p>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {tiles.map((bg, i) => (
            <div key={i} className="aspect-square rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
              <Package className="w-4 h-4 text-white/20" />
            </div>
          ))}
        </div>
      </div>
    </ProofSection>
  );
}
