import { Package } from 'lucide-react';
import { canTileBackground, THEME_CAN_BG } from '@/lib/canBgColors';

/**
 * Reusable image box that applies a background colour behind the can image.
 * Used on: CanCard, CanDetail, PublicProfile, MonthlyReport.
 *
 * Props:
 *   imageUrl   — can image URL (optional)
 *   bgColor    — hex background colour (defaults to Deep Teal)
 *   alt        — img alt text
 *   className  — extra classes on the container div
 *   style      — extra inline styles on the container
 *   iconSize   — tailwind class for Package icon size (default 'w-10 h-10')
 *   objectFit  — CSS object-fit value (default 'contain')
 *   loading    — img loading attribute (default 'lazy'; pass 'eager' for above-the-fold hero images)
 */
export default function CanImageBox({
  imageUrl,
  bgColor,
  alt = '',
  className = '',
  style = {},
  iconSize = 'w-10 h-10',
  objectFit = 'contain',
  loading = 'lazy',
}) {
  const bg = canTileBackground(bgColor);
  // Placeholder glyph: the theme tile can be light (Sage, Candy), where the
  // old white/20 vanished; picked colours are always clamped dark
  // (clampToDarkSafeBg), where white still reads best.
  const isThemeTile = bg === THEME_CAN_BG;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: bg, ...style }}
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
          <Package className={`${iconSize} ${isThemeTile ? 'text-foreground/30' : 'text-white/20'}`} />
        </div>
      )}
    </div>
  );
}