import { cn } from '@/lib/utils';

// Colours follow the viewer's theme (2026-10-26): fill, border and glow
// use --rarity-*, which is the theme's own gauge colour (--breakdown-*), so
// a badge matches the rarity bar and key beside it. The TEXT uses
// --rarity-*-text, the same colour moved in lightness until it reads at
// 4.6:1 on that theme's page, card and the badge's tint
// (scripts/generate-rarity-text.mjs). Glows also scale with --glow-intensity.
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