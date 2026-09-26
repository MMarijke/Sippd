import { cn } from '@/lib/utils';

export const BEVERAGE_TYPE_OPTIONS = [
  { value: 'energy_drink', label: 'Energy Drink' },
  { value: 'soft_drink',   label: 'Soft Drink'   },
];

// Shared between AddCanForm.jsx (editable while adding a new can, or
// read-only once a catalog can's own beverage_type is already established)
// and EditEntrySheet.jsx (always editable -- a personal snapshot
// correction, same as can_name/can_brand there). Same segmented-toggle
// visual pattern as STATUS_OPTIONS in both forms.
export default function BeverageTypeToggle({ value, onChange, disabled = false }) {
  return (
    // role="group", not "radiogroup" -- a radiogroup's children must be
    // role="radio" with arrow-key navigation between them, which this (like
    // every other segmented toggle in this app -- Status, Feed's scope
    // filter, etc.) never implements. Claiming radiogroup with aria-pressed
    // buttons told screen readers this was a radio widget while behaving
    // like a plain button group, which is worse than making no semantic
    // claim beyond "these buttons are related". (/impeccable critique)
    <div
      role="group"
      aria-label="Beverage type"
      className={cn('flex bg-secondary rounded-xl border border-border p-1 gap-1', disabled && 'pointer-events-none')}
    >
      {BEVERAGE_TYPE_OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !disabled && onChange(opt.value)}
            aria-pressed={selected}
            aria-disabled={disabled || undefined}
            className={cn(
              'flex-1 h-11 flex items-center justify-center rounded-lg text-xs font-mono font-semibold transition-all',
              selected
                ? 'bg-primary text-primary-foreground shadow'
                : disabled ? 'text-muted-foreground opacity-60' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
