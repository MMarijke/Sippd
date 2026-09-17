import { useId } from 'react';
import { Palette } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { clampToDarkSafeBg, QUICK_PICK_BG_COLORS } from '@/lib/canBgColors';
import CanImageBox from '@/components/shared/CanImageBox';
import { cn } from '@/lib/utils';

// Shared by AddCanForm and EditEntrySheet. Originally a 12-swatch fixed
// preset grid (duplicated in both files), then a free-hue-only native
// color dialog — /impeccable critique flagged that second version: the OS's
// own color picker is the one moment in this dark neon-glow form where the
// app's identity disappears entirely, and a bare hex string gave no real
// feedback on what the result would look like. This pairs both: seven
// curated quick-picks (six echo the --rarity-* ladder in index.css, so
// choosing a background can double as choosing a mood, not just a random
// color) plus a "Custom" swatch that still opens the same native picker for
// any hue, all previewed live through CanImageBox — the exact component
// CanCard/CanDetail/PublicProfile/MonthlyReport already use, so this shows
// precisely what the real collection tile will look like.
//
// Two swatches (Gilded, Voidglass) were briefly Pro-locked as a Trophy
// Case perk. Removed: the Custom swatch already opens a free-hue native
// picker for any hex, so a "locked" preset color was never actually
// restricting anything — a free user could reproduce the identical hex
// in two taps, making the lock theater rather than a real gate.
export default function CanBackgroundPicker({ value, onChange, label = 'Card Background', imageUrl, previewAlt }) {
  const inputId = useId();
  const isCustomActive = !QUICK_PICK_BG_COLORS.some(p => p.hex === value);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</Label>

      <div className="flex items-center gap-3">
        {/* Live preview — without this, picking a color had zero visual
            feedback whenever there was no photo yet (the common case,
            since Image is optional), beyond a hex string. */}
        <CanImageBox
          imageUrl={imageUrl}
          bgColor={value}
          alt={previewAlt || 'Card background preview'}
          className="w-16 h-16 rounded-xl border border-border flex-shrink-0"
          iconSize="w-6 h-6"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-semibold text-foreground uppercase">{value}</p>
          <p className="text-[11px] font-mono text-muted-foreground leading-snug">
            Pick a color below, or Custom for any hue — it's automatically kept dark enough to stay readable.
          </p>
        </div>
      </div>

      {/* Seven curated swatches presented as one visually undivided group
          with Custom (/impeccable critique: 8 simultaneous options at a
          single decision point, no distinction between "pick one of these"
          and "or open the free-hue escape hatch"). A thin vertical divider
          now separates the two groups so that distinction reads at a
          glance instead of needing to be inferred from the rainbow icon. */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {QUICK_PICK_BG_COLORS.map(({ label: swatchLabel, hex }) => {
            const selected = value === hex;
            return (
              <button
                key={hex}
                type="button"
                title={swatchLabel}
                aria-label={swatchLabel}
                aria-pressed={selected}
                onClick={() => onChange(hex)}
                className={cn(
                  'relative w-11 h-11 rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]'
                    : 'border-border hover:border-muted-foreground'
                )}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>

        <div className="w-px h-8 bg-border flex-shrink-0" aria-hidden="true" />

        {/* Custom — the free-hue escape hatch. Ring lives on this outer
            wrapper, not the label below it: a box-shadow gets clipped by
            overflow-hidden on the SAME element it's drawn on, and the
            label needs overflow-hidden to clip its own fill to its rounded
            corners, so the focus ring has to sit one level up. */}
        <div className="relative w-11 h-11 rounded-lg flex-shrink-0 focus-within:ring-2 focus-within:ring-ring">
          <label
            htmlFor={inputId}
            title="Custom color"
            className={cn(
              'absolute inset-0 rounded-lg border-2 cursor-pointer overflow-hidden flex items-center justify-center transition-all',
              isCustomActive
                ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]'
                : 'border-border hover:border-muted-foreground'
            )}
            style={isCustomActive
              ? { backgroundColor: value }
              : { background: 'conic-gradient(from 90deg, #ff5c5c, #ffb85c, #f5e85c, #7dff5c, #5cc9ff, #7d5cff, #ff5cd6, #ff5c5c)' }}
          >
            <Palette className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" aria-hidden="true" />
            <input
              id={inputId}
              type="color"
              value={value}
              onChange={e => onChange(clampToDarkSafeBg(e.target.value))}
              aria-label="Custom color"
              className="absolute inset-0 w-full h-full cursor-pointer opacity-0 focus:outline-none"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
