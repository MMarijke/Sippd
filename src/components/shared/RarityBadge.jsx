import { cn } from '@/lib/utils';

const rarityConfig = {
  'Common': { color: 'text-rarity-common', bg: 'bg-rarity-common/10', border: 'border-rarity-common/30', glow: '' },
  'Uncommon': { color: 'text-rarity-uncommon', bg: 'bg-rarity-uncommon/10', border: 'border-rarity-uncommon/30', glow: '' },
  'Rare': { color: 'text-rarity-rare', bg: 'bg-rarity-rare/10', border: 'border-rarity-rare/30', glow: 'shadow-[0_0_8px_rgba(59,130,246,0.3)]' },
  'Ultra Rare': { color: 'text-rarity-ultra', bg: 'bg-rarity-ultra/10', border: 'border-rarity-ultra/30', glow: 'shadow-[0_0_8px_rgba(168,85,247,0.3)]' },
  'Legendary': { color: 'text-rarity-limited', bg: 'bg-rarity-limited/10', border: 'border-rarity-limited/30', glow: 'shadow-[0_0_8px_rgba(236,72,153,0.5)]' },
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