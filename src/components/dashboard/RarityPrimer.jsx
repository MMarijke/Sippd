import RarityBadge from '@/components/shared/RarityBadge';
import { RARITY_ORDER, RARITY_POINTS } from '@/lib/rarityConsensus';

// First-visit only (Home with zero cans): what makes a can valuable here,
// shown with the real tier badges rather than explained in a paragraph.
// It replaces the zeros, the empty carousel and the empty-month report a
// new collector used to see (/impeccable onboard).
const STEPS = [
  'Scan a can and add it to your vault.',
  'Vote on how rare you think it is. Once 5 collectors have voted, the community tier shows.',
  'Rarer cans are worth more points, and points set your place on Ranks.',
];

export default function RarityPrimer() {
  return (
    <section aria-labelledby="rarity-primer-heading" className="bg-card border border-border rounded-2xl p-5">
      <h2 id="rarity-primer-heading" className="text-base font-display font-bold text-foreground">
        How rarity works
      </h2>

      <ul className="mt-4 grid grid-cols-1 gap-2" aria-label="Rarity tiers and their points">
        {[...RARITY_ORDER].reverse().map(tier => (
          <li key={tier} className="flex items-center justify-between gap-3">
            <RarityBadge rarity={tier} />
            <span className="text-xs font-mono text-foreground tabular-nums">
              {RARITY_POINTS[tier]} {RARITY_POINTS[tier] === 1 ? 'pt' : 'pts'}
            </span>
          </li>
        ))}
      </ul>

      <ol className="mt-5 space-y-2.5">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm text-foreground leading-snug">
            <span className="w-6 h-6 rounded-full bg-primary/15 text-foreground text-xs font-mono font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
