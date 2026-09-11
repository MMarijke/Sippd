import { cn } from '@/lib/utils';

// Glow classes (index.css) scale with the viewer's active theme tier via
// --glow-intensity, same as every other glow surface in the app — a can's
// rarity hue itself stays theme-invariant (see index.css's --rarity-* note).
const rarityConfig = {
  'Common': { color: 'text-rarity-common', bg: 'bg-rarity-common/10', border: 'border-rarity-common/30', glow: '' },
  'Uncommon': { color: 'text-rarity-uncommon', bg: 'bg-rarity-uncommon/10', border: 'border-rarity-uncommon/30', glow: '' },
  'Rare': { color: 'text-rarity-rare', bg: 'bg-rarity-rare/10', border: 'border-rarity-rare/30', glow: 'rarity-glow-rare' },
  'Ultra Rare': { color: 'text-rarity-ultra', bg: 'bg-rarity-ultra/10', border: 'border-rarity-ultra/30', glow: 'rarity-glow-ultra' },
  'Legendary': { color: 'text-rarity-legendary', bg: 'bg-rarity-legendary/10', border: 'border-rarity-legendary/30', glow: 'rarity-glow-legendary' },
};

export default function RarityBadge({ rarity, size = 'sm', className }) {
  const config = rarityConfig[rarity] || rarityConfig['Common'];
  
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono font-semibold uppercase tracking-wider border rounded-md',
        config.color, config.bg, config.border, config.glow,
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1',
        className
      )}
    >
      {rarity === '???' ? '? ? ?' : rarity}
    </span>
  );
}