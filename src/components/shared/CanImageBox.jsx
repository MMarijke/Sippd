import { Package } from 'lucide-react';
import { tileBackground } from '@/lib/canBgColors';

/**
 * Reusable image box behind a can image, washed with the can's rarity hue.
 * Used on: CanCard, CanDetail, PublicProfile, MonthlyReport, Wishlist, ...
 *
 * Props:
 *   imageUrl   — can image URL (optional)
 *   rarity     — the rarity the tile shows ("Rare", "Ultra Rare", ...);
 *                unrated/unknown gets the theme tile
 *   canBg      — a collection row's can_bg_color: a picked hue replaces the
 *                rarity wash (tileBackground); omit for catalog-only cans
 *   alt        — img alt text
 *   className  — extra classes on the container div
 *   style      — extra inline styles on the container
 *   iconSize   — tailwind class for Package icon size (default 'w-10 h-10')
 *   objectFit  — CSS object-fit value (default 'contain')
 *   loading    — img loading attribute (default 'lazy'; pass 'eager' for above-the-fold hero images)
 */
export default function CanImageBox({
  imageUrl,
  rarity,
  canBg,
  alt = '',
  className = '',
  style = {},
  iconSize = 'w-10 h-10',
  objectFit = 'contain',
  loading = 'lazy',
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: tileBackground(rarity, canBg), ...style }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          loading={loading}
          decoding="async"
          className="w-full h-full"
          style={{ objectFit }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {/* The tile is always a light wash of the card, so the glyph takes
              the foreground colour on every theme (white/20 vanished on
              light ones). */}
          <Package className={`${iconSize} text-foreground/30`} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
