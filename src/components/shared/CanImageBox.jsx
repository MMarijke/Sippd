import { Package } from 'lucide-react';
import { DEFAULT_CAN_BG } from '@/lib/canBgColors';

/**
 * Reusable image box that applies a background colour behind the can image.
 * Used on: CanCard, CanDetail, PublicProfile, MonthlyReport, ShareCardModal.
 *
 * Props:
 *   imageUrl   — can image URL (optional)
 *   bgColor    — hex background colour (defaults to Deep Teal)
 *   alt        — img alt text
 *   className  — extra classes on the container div
 *   style      — extra inline styles on the container
 *   iconSize   — tailwind class for Package icon size (default 'w-10 h-10')
 *   objectFit  — CSS object-fit value (default 'contain')
 */
export default function CanImageBox({
  imageUrl,
  bgColor,
  alt = '',
  className = '',
  style = {},
  iconSize = 'w-10 h-10',
  objectFit = 'contain',
}) {
  const bg = bgColor || DEFAULT_CAN_BG;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: bg, ...style }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full"
          style={{ objectFit }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Package className={`${iconSize} text-white/20`} />
        </div>
      )}
    </div>
  );
}