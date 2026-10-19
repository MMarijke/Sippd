import { motion } from 'framer-motion';
import { Flame, Star as StarIcon, ChevronRight, ChevronDown, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import RarityBadge from '@/components/shared/RarityBadge';
import DrawnCan, { CAN_PALETTES } from '@/components/login/DrawnCan';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

// The sections after the sign-up form, each a real product mechanism at
// honest scale rather than a shrunk preview card — recreated from the
// actual component patterns (CollectorsLeaderboard's medal/rank/score
// markup, ActivityCard's header/reaction-row, CollectionCard's real
// .hero-card token) so a first-time visitor sees the interface itself,
// not an illustration of it. Names, cans and counts are made-up examples;
// this page has no session to draw real data from, and real catalog photos
// are brand-owned (DrawnCan.jsx). One example can, Comet Fizz, runs through
// the rarity steps and into the feed, so the sections tell one story.

// A heading's closing full stop in the page's magenta: the opening's colour
// carried down the page as a signature, not as more glow.
function Title({ children, className }) {
  const text = String(children);
  const stop = text.endsWith('.');
  return (
    <h2 className={cn('font-display font-black text-foreground text-balance', className)}>
      {stop ? text.slice(0, -1) : text}
      {stop && <span className="text-primary">.</span>}
    </h2>
  );
}

// Every demo on the page is sample data (the page has no session, and the
// names and numbers are made up), so each one says so, in words a screen
// reader reads too.
function ExampleTag({ className }) {
  return (
    <p className={cn('mb-2 text-right text-xs font-mono uppercase tracking-wider text-muted-foreground', className)}>
      Example
    </p>
  );
}

// Phone: heading, line, then the demo, stacked. Desktop: a two-column row
// across the page, the demo alternating sides so the sections read as a
// sequence rather than identical blocks.
function ProofSection({ title, copy, flip = false, children }) {
  return (
    <section className="px-5 py-16 lg:py-24 border-t border-border">
      <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-2 lg:items-center lg:gap-20">
        <div className={cn(flip && 'lg:order-2')}>
          <Title className="text-3xl lg:text-5xl mb-2 lg:mb-4">{title}</Title>
          <p className="text-sm lg:text-lg font-body text-muted-foreground mb-6 lg:mb-0 max-w-sm">{copy}</p>
        </div>
        <div className={cn('w-full max-w-sm lg:max-w-md', flip ? 'lg:order-1 lg:justify-self-start' : 'lg:justify-self-end')}>
          <ExampleTag />
          {children}
        </div>
      </div>
    </section>
  );
}

// ── Scan → vote → rarity ─────────────────────────────────────────────────
// What makes Sippd different from a spreadsheet: a can's rarity is the
// community's call. Three steps, each shown as the thing itself (a can in
// the scanner, the vote tally, the badge it earns).

const VOTES = [
  { tier: 'Common', n: 6, bar: 'bg-rarity-common', text: 'text-rarity-common-text' },
  { tier: 'Uncommon', n: 14, bar: 'bg-rarity-uncommon', text: 'text-rarity-uncommon-text' },
  { tier: 'Rare', n: 38, bar: 'bg-rarity-rare', text: 'text-rarity-rare-text' },
  { tier: 'Ultra Rare', n: 9, bar: 'bg-rarity-ultra', text: 'text-rarity-ultra-text' },
  { tier: 'Legendary', n: 3, bar: 'bg-rarity-legendary', text: 'text-rarity-legendary-text' },
];
const TOTAL_VOTES = VOTES.reduce((sum, v) => sum + v.n, 0);
const TOP_VOTES = Math.max(...VOTES.map((v) => v.n));

function ScanStage() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="relative h-40 w-28">
      {/* Viewfinder corners. */}
      {['top-0 left-0 border-t-2 border-l-2 rounded-tl-lg', 'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
        'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg', 'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg'].map((c) => (
        <span key={c} className={cn('absolute w-5 h-5 border-primary', c)} aria-hidden="true" />
      ))}
      <DrawnCan palette={CAN_PALETTES.rare} word="COMET" sub="FIZZ" className="absolute inset-x-0 mx-auto top-3 h-[8.5rem] w-auto" />
      {/* The scan line sweeping the can. */}
      <motion.span
        className="absolute inset-x-1 h-0.5 rounded-full bg-primary"
        style={{ boxShadow: '0 0 12px 2px hsl(var(--primary) / 0.7)' }}
        initial={{ top: '50%' }}
        animate={reducedMotion ? { top: '50%' } : { top: ['18%', '82%', '18%'] }}
        transition={reducedMotion ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />
    </div>
  );
}

function VoteStage() {
  return (
    <div className="w-full max-w-[15rem] space-y-1.5">
      {VOTES.map((v) => (
        <div key={v.tier} className="grid grid-cols-[6.75rem_1fr_1.5rem] items-center gap-2">
          <span className={cn('text-xs font-mono uppercase tracking-wider', v.text)}>{v.tier}</span>
          <span className="h-2 rounded-full bg-secondary overflow-hidden">
            <span className={cn('block h-full rounded-full', v.bar)} style={{ width: `${(v.n / TOP_VOTES) * 100}%` }} />
          </span>
          <span className="text-xs font-mono tabular-nums text-foreground text-right">{v.n}</span>
        </div>
      ))}
    </div>
  );
}

function VerdictStage() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <RarityBadge rarity="Rare" size="lg" className="text-base px-4 py-1.5" />
      <p className="text-lg font-semibold text-foreground leading-none">Comet Fizz</p>
      <p className="text-xs font-mono text-muted-foreground">{TOTAL_VOTES} collectors voted</p>
    </div>
  );
}

const STEPS = [
  { title: 'Scan it', copy: 'Point your camera at the barcode.', Stage: ScanStage },
  { title: 'Collectors vote', copy: 'Everyone weighs in on how rare it is.', Stage: VoteStage },
  { title: 'It earns its rarity', copy: "The community's verdict goes on the can.", Stage: VerdictStage },
];

// id="how-it-works": the desktop opening's "See how it works" scrolls here.
export function RarityProof() {
  return (
    <section id="how-it-works" className="px-5 py-16 lg:py-24 border-t border-border scroll-mt-4">
      <div className="mx-auto max-w-5xl">
        <Title className="text-3xl lg:text-5xl mb-2 lg:mb-4 max-w-2xl">The community calls the rarity.</Title>
        <p className="text-sm lg:text-lg font-body text-muted-foreground max-w-xl">
          No price guide decides how rare a can is. Collectors do.
        </p>

        <ExampleTag className="mt-10 lg:mt-14" />
        <ol className="grid gap-12 lg:grid-cols-3 lg:gap-12">
          {STEPS.map(({ title, copy, Stage }, i) => (
            <li key={title} className="relative">
              <div className="h-52 rounded-2xl border border-border bg-card flex items-center justify-center px-5">
                <Stage />
              </div>
              <h3 className="mt-4 font-display font-bold text-lg text-foreground">{title}</h3>
              <p className="mt-1 text-sm font-body text-muted-foreground">{copy}</p>
              {i < STEPS.length - 1 && (
                <>
                  <ChevronDown className="lg:hidden absolute left-1/2 -translate-x-1/2 -bottom-10 w-6 h-6 text-primary" aria-hidden="true" />
                  <ChevronRight className="hidden lg:block absolute top-[6.5rem] -translate-y-1/2 -right-9 w-6 h-6 text-primary" aria-hidden="true" />
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── Leaderboard ──────────────────────────────────────────────────────────

export function LeaderboardProof() {
  const rows = [
    { rank: 1, name: 'Juno R.', cans: 2412, medal: '🥇' },
    { rank: 2, name: 'Silas K.', cans: 1953, medal: '🥈' },
    { rank: 3, name: 'Wren T.', cans: 1608, medal: '🥉' },
  ];
  return (
    <ProofSection
      title="Climb the ranks."
      copy="Compete with other collectors by total cans or rare pulls."
    >
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border bg-card">
        {rows.map(r => (
          <div key={r.rank} className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-7 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
              <span className="text-base leading-none" aria-hidden="true">{r.medal}</span>
              <span className="text-xs font-mono text-muted-foreground leading-none">#{r.rank}</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-display font-bold text-foreground flex-shrink-0">
              {r.name[0]}
            </div>
            <p className="flex-1 text-sm font-semibold text-foreground truncate">{r.name}</p>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-display font-bold tabular-nums text-foreground">{r.cans.toLocaleString('en')}</p>
              <p className="text-xs font-mono text-muted-foreground">cans</p>
            </div>
          </div>
        ))}
      </div>
    </ProofSection>
  );
}

// ── Feed ─────────────────────────────────────────────────────────────────

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
            <p className="text-xs font-mono text-muted-foreground">2m ago</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DrawnCan palette={CAN_PALETTES.rare} word="COMET" sub="FIZZ" className="h-14 w-auto flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-xs font-mono leading-relaxed text-foreground">
              added <span className="font-semibold">Comet Fizz</span> to their vault
            </p>
            <RarityBadge rarity="Rare" />
          </div>
        </div>
        {/* Reaction counts in full foreground: muted on the chip's fill
            measured 4.08:1. */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          {[{ Icon: Flame, n: 12, label: 'fire reactions' }, { Icon: StarIcon, n: 4, label: 'stars' }].map(({ Icon, n, label }) => (
            <div key={label} className="h-8 px-2.5 flex items-center gap-1 rounded-full text-xs font-mono border bg-secondary border-border text-foreground">
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="tabular-nums">{n}</span>
              <span className="sr-only">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </ProofSection>
  );
}

// ── Trades ───────────────────────────────────────────────────────────────
// Sippd's trade log is a record of swaps you made with other collectors
// (Trades.jsx / TradeLogDialog: pick cans from your collection, name the
// other collector, track the status), not a marketplace, so the example is
// one logged trade, in the app's own statuses (Pending/Completed/Cancelled).

const TRADE = {
  with: 'Juno R.',
  date: '12 Oct',
  gave: [
    { palette: CAN_PALETTES.uncommon, word: 'KIWI', sub: 'ZEST', rarity: 'Uncommon', text: 'text-rarity-uncommon-text' },
    { palette: CAN_PALETTES.rare, word: 'COMET', sub: 'FIZZ', rarity: 'Rare', text: 'text-rarity-rare-text' },
  ],
  got: [
    { palette: CAN_PALETTES.ultra, word: 'VOLT', sub: 'GRAPE', rarity: 'Ultra Rare', text: 'text-rarity-ultra-text' },
  ],
};

function TradeSide({ label, cans }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <ul className="flex gap-3">
        {cans.map((c) => (
          <li key={c.word} className="flex flex-col items-center gap-1.5">
            <DrawnCan palette={c.palette} word={c.word} sub={c.sub} className="h-16 w-auto" />
            <span className={cn('text-xs font-mono', c.text)}>{c.rarity}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TradeProof() {
  const count = (n) => `${n} can${n === 1 ? '' : 's'}`;
  return (
    <ProofSection
      title="Every trade, on the record."
      copy="Log what you swapped, with whom, and where it stands, right next to the collection it came from."
    >
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">Trade with {TRADE.with}</p>
            <p className="text-xs font-mono text-muted-foreground">{TRADE.date} · {count(TRADE.gave.length)} for {count(TRADE.got.length)}</p>
          </div>
          <span className="flex-shrink-0 rounded-full border border-rarity-uncommon/40 bg-rarity-uncommon/10 px-2.5 py-1 text-xs font-mono text-rarity-uncommon-text">
            Completed
          </span>
        </div>
        <div className="flex items-end gap-3 pt-3 border-t border-border/60">
          <TradeSide label="You gave" cans={TRADE.gave} />
          <ArrowRightLeft className="w-5 h-5 text-primary mb-8 flex-shrink-0" aria-hidden="true" />
          <TradeSide label="You got" cans={TRADE.got} />
        </div>
      </div>
    </ProofSection>
  );
}
