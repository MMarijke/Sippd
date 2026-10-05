import { useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_CAN_BG, TILE_HUES, hueValue, parseTileHue, hueSwatch,
  hueTileBackground, rarityTileBackground,
} from '@/lib/canBgColors';

// The tile colour behind a can: its rarity (the default) or a hue the
// collector picks. Every swatch is the real tile wash in the viewer's
// current theme, so what you pick is what Haul shows. Native radios, so
// arrow keys move between options and screen readers announce the group.
const HUE_TRACK = `linear-gradient(to right, ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].map(hueSwatch).join(', ')})`;
const DEFAULT_CUSTOM_HUE = 290;

function Swatch({ name, label, checked, onSelect, background, children }) {
  return (
    <label className="relative block cursor-pointer" title={label}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex w-11 h-11 items-center justify-center rounded-xl border border-border transition-shadow',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
          checked && 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-background'
        )}
        style={{ background }}
      >
        {checked ? <Check className="w-4 h-4 text-foreground" aria-hidden="true" /> : children}
      </span>
    </label>
  );
}

export default function CanTileColorPicker({ value, onChange, rarity, name = 'can-tile-colour' }) {
  const hue = parseTileHue(value);
  const quick = hue == null ? null : TILE_HUES.find(h => h.hue === hue);
  const mode = hue == null ? 'rarity' : quick ? quick.label : 'custom';
  const [customHue, setCustomHue] = useState(hue != null && !quick ? hue : DEFAULT_CUSTOM_HUE);

  const pickCustom = h => { setCustomHue(h); onChange(hueValue(h)); };
  const current = mode === 'rarity' ? 'Rarity' : mode === 'custom' ? `Custom (${hue}°)` : mode;

  return (
    <fieldset className="space-y-2">
      <legend className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
        Tile colour <span className="normal-case tracking-normal text-foreground/80">· {current}</span>
      </legend>
      <div className="flex flex-wrap gap-2.5 pt-1">
        <Swatch
          name={name}
          label="Rarity: the tile wears this can's rarity colour"
          checked={mode === 'rarity'}
          onSelect={() => onChange(DEFAULT_CAN_BG)}
          background={rarityTileBackground(rarity)}
        >
          <span className="text-2xs font-mono font-semibold text-foreground/80">R</span>
        </Swatch>
        {TILE_HUES.map(h => (
          <Swatch
            key={h.hue}
            name={name}
            label={h.label}
            checked={mode === h.label}
            onSelect={() => onChange(hueValue(h.hue))}
            background={hueTileBackground(h.hue)}
          />
        ))}
        <Swatch
          name={name}
          label="Custom hue"
          checked={mode === 'custom'}
          onSelect={() => pickCustom(customHue)}
          background={hueTileBackground(customHue)}
        >
          <Palette className="w-4 h-4 text-foreground/70" aria-hidden="true" />
        </Swatch>
      </div>

      {mode === 'custom' && (
        <div className="relative flex h-11 items-center">
          <div className="absolute inset-x-0 h-3 rounded-full border border-border" style={{ background: HUE_TRACK }} aria-hidden="true" />
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={customHue}
            onChange={e => pickCustom(Number(e.target.value))}
            aria-label="Custom tile hue"
            aria-valuetext={`${customHue} degrees`}
            className={cn(
              'relative w-full h-11 cursor-pointer appearance-none bg-transparent rounded-full',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-[var(--thumb)] [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgb(0_0_0/0.35)]',
              '[&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full',
              '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-[var(--thumb)]',
              '[&::-moz-range-track]:bg-transparent'
            )}
            style={{ '--thumb': hueSwatch(customHue) }}
          />
        </div>
      )}
      <p className="text-2xs font-mono text-muted-foreground">
        Tints the tile behind your can. Rarity matches its rarity colour.
      </p>
    </fieldset>
  );
}
