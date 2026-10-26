import { cn } from '@/lib/utils';

// Glow classes (index.css) scale with the viewer's active theme tier via
// --glow-intensity, same as every other glow surface in the app — a can's
// rarity hue itself stays theme-invariant (see index.css's --rarity-* note).
// The TEXT uses --rarity-*-text: same hue per tier, lightness tuned per
// rendered tone so the label clears 4.5:1 on light themes too (the fixed
// hues read 1.9-3.3:1 there). Fill, border and glow keep the invariant hue.
const rarityConfig = {
  'Common': { color: 'text-rarity-common-text', bg: 'bg-rarity-common/10', border: 'border-rarity-common/30', glow: '' },
  'Uncommon': { color: 'text-rarity-uncommon-text', bg: 'bg-rarity-uncommon/10', border: 'border-rarity-uncommon/30', glow: '' },
  'Rare': { color: 'text-rarity-rare-text', bg: 'bg-rarity-rare/10', border: 'border-rarity-rare/30', glow: 'rarity-glow-rare' },
  'Ultra Rare': { color: 'text-rarity-ultra-text', bg: 'bg-rarity-ultra/10', border: 'border-rarity-ultra/30', glow: 'rarity-glow-ultra' },
  'Legendary': { color: 'text-rarity-legendary-text', bg: 'bg-rarity-legendary/10', border: 'border-rarity-legendary/30', glow: 'rarity-glow-legendary rarity-holo-badge' },
};

export default function RarityBadge({ rarity, size = 'sm', className }) {
  const config = rarityConfig[rarity] || rarityConfig['Common'];
  
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono font-semibold uppercase tracking-wider border rounded-md',
        config.color, config.bg, config.border, config.glow,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-3 py-1',
        className
      )}
    >
      {rarity === '???' ? '? ? ?' : rarity}
    </span>
  );
}