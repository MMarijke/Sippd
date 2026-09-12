import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { clampToDarkSafeBg } from '@/lib/canBgColors';

// Shared by AddCanForm and EditEntrySheet — was a 12-swatch fixed preset
// grid duplicated in both files; replaced with a free-hue picker (the
// native OS color dialog via <input type="color">) so any hue is
// available, not just the original twelve. Every pick still gets pulled
// back into the same dark-safe lightness band the old presets lived in
// (clampToDarkSafeBg) so the result stays readable as a tile/card
// background everywhere can_bg_color is used, the same guarantee the
// fixed presets gave for free.
export default function CanBackgroundPicker({ value, onChange, label = 'Card Background' }) {
  const inputId = useId();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-3">
        {/* The 44px label wrapper is the real tap target; the native color
            input sits invisibly on top of it (opacity-0), so tapping
            anywhere on the visible swatch opens the OS color dialog. */}
        <label
          htmlFor={inputId}
          className="relative w-11 h-11 rounded-lg border-2 border-border cursor-pointer overflow-hidden flex-shrink-0"
          style={{ backgroundColor: value }}
        >
          <input
            id={inputId}
            type="color"
            value={value}
            onChange={e => onChange(clampToDarkSafeBg(e.target.value))}
            aria-label={label}
            className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
          />
        </label>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-semibold text-foreground uppercase">{value}</p>
          <p className="text-[11px] font-mono text-muted-foreground leading-snug">
            Tap the swatch to pick any color — it's automatically kept dark enough to stay readable.
          </p>
        </div>
      </div>
    </div>
  );
}
