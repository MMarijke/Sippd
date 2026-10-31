import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme, THEME_FAMILIES, THEMES, getRenderedTone, familyHasPolarityToggle, PICKER_LABEL_FONTS_URL, RETIRED_THEMES } from '@/hooks/useTheme';
import { ArrowLeft, ChevronRight, ChevronLeft, Lock, Loader2, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LegalFooter from '@/components/legal/LegalFooter';
import { exportUserData, downloadJson } from '@/lib/exportUserData';
import { MIN_PASSWORD } from '@/lib/authErrors';

const STATUSES = ['collected', 'wishlist'];
const PREFS_KEY = 'canvolt_prefs';
const FOLLOW_NOTIFY_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'rare_only', label: 'Rare Only' },
  { value: 'all', label: 'Every Can' },
];

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
}
function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function SectionHeader({ title }) {
  return (
    <p className="text-2xs font-mono text-muted-foreground uppercase tracking-widest px-1 mb-1 mt-5 first:mt-0">
      {title}
    </p>
  );
}

function SettingsRow({ label, sub, onClick, danger, right }) {
  const content = (
    <>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs font-mono text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {right !== undefined ? right : onClick && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
    </>
  );

  if (!onClick) {
    return (
      <div className={cn('w-full flex items-center justify-between px-4 py-3.5', danger ? 'text-destructive' : 'text-foreground')}>
        {content}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3.5 text-left',
        danger ? 'text-destructive' : 'text-foreground',
        'hover:bg-secondary/50 transition-colors'
      )}
    >
      {content}
    </button>
  );
}

// ─── Edit Display Name ────────────────────────────────────────────────────────
function EditNamePanel({ userId, initialName, onDone }) {
  const [value, setValue] = useState(initialName || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: value.trim() }).eq('id', userId);
    if (error) {
      toast.error('Failed to update name');
      setSaving(false);
      return;
    }
    toast.success('Display name updated');
    setSaving(false);
    onDone();
  };

  return (
    <div className="space-y-4 px-5 pt-4">
      <Label htmlFor="settings-display-name" className="text-xs font-mono text-muted-foreground block">Enter your new display name.</Label>
      <Input
        id="settings-display-name"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); }}
        maxLength={40}
        className="bg-secondary border-primary/30 focus-visible:ring-primary/50"
        placeholder="Display name"
        autoFocus
      />
      <Button className="w-full font-mono text-xs" onClick={save} disabled={saving || !value.trim()}>
        {saving ? 'Saving…' : 'Save Name'}
      </Button>
    </div>
  );
}

// ─── Edit Region ──────────────────────────────────────────────────────────────
function EditRegionPanel({ userId, initialRegion, onDone }) {
  const [value, setValue] = useState(initialRegion || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ region: value.trim() || null }).eq('id', userId);
    if (error) {
      toast.error('Failed to update region');
      setSaving(false);
      return;
    }
    toast.success('Region updated');
    setSaving(false);
    onDone();
  };

  return (
    <div className="space-y-4 px-5 pt-4">
      <Label htmlFor="settings-region" className="text-xs font-mono text-muted-foreground block">Your city or country (shown on leaderboard)</Label>
      <Input
        id="settings-region"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); }}
        maxLength={40}
        className="bg-secondary border-primary/30 focus-visible:ring-primary/50"
        placeholder="e.g. Cape Town, South Africa"
        autoFocus
      />
      <Button className="w-full font-mono text-xs" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save Region'}
      </Button>
    </div>
  );
}

// ─── Change Password ──────────────────────────────────────────────────────────
function ChangePasswordPanel({ user }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (form.next.length < MIN_PASSWORD) { toast.error(`New password must be at least ${MIN_PASSWORD} characters`); return; }
    if (form.next !== form.confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    // supabase.auth.updateUser() alone doesn't verify the current password —
    // re-authenticate first so "change password" actually requires knowing the old one.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: form.current,
    });
    if (verifyError) {
      // Every verification failure used to show "Current password is
      // incorrect," even a network error or Supabase's own sign-in
      // rate-limit after several attempts — misleading someone whose
      // password actually was correct. invalid_credentials is the one
      // case that's genuinely about the password typed here.
      if (verifyError.code === 'invalid_credentials' || verifyError.status === 400) {
        toast.error('Current password is incorrect');
      } else if (verifyError.status === 429 || verifyError.code === 'over_request_rate_limit') {
        toast.error('Too many attempts — please wait a moment and try again');
      } else {
        toast.error('Could not verify your current password: ' + (verifyError.message || 'Unknown error'));
      }
      setSaving(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: form.next });
    if (updateError) {
      toast.error('Something went wrong. Please try again.');
    } else {
      toast.success('Password changed');
      setForm({ current: '', next: '', confirm: '' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3 px-5 pt-4">
      <div>
        <label htmlFor="current-password" className="text-xs font-mono text-muted-foreground mb-1.5 block">Current password</label>
        <Input
          id="current-password"
          type="password"
          placeholder="Current password"
          autoComplete="current-password"
          value={form.current}
          onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
          className="bg-secondary border-border focus-visible:ring-primary/50"
        />
      </div>
      <div>
        <label htmlFor="new-password" className="text-xs font-mono text-muted-foreground mb-1.5 block">New password</label>
        <Input
          id="new-password"
          type="password"
          placeholder="New password"
          autoComplete="new-password"
          value={form.next}
          onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
          className="bg-secondary border-border focus-visible:ring-primary/50"
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="text-xs font-mono text-muted-foreground mb-1.5 block">Confirm new password</label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Confirm new password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
          className="bg-secondary border-border focus-visible:ring-primary/50"
        />
      </div>
      <Button className="w-full font-mono text-xs" onClick={save} disabled={saving}>
        {saving ? 'Updating…' : 'Update Password'}
      </Button>
    </div>
  );
}

// ─── Chip Toggle ─────────────────────────────────────────────────────────────
// Options are plain strings (Status/Rarity below, where the value IS the
// label) or {value, label} pairs, for a preference like notify_follows_pref
// whose stored values ('rare_only') aren't fit to display as-is.
function ChipToggle({ options, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {options.map(opt => {
        const optValue = typeof opt === 'string' ? opt : opt.value;
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        return (
          <button
            key={optValue}
            onClick={() => onChange(optValue)}
            aria-pressed={value === optValue}
            disabled={disabled}
            className={cn(
              'h-10 px-3 flex items-center rounded-full text-xs font-mono border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              value === optValue
                ? 'bg-primary/10 border-primary/40 text-primary'
                // On the card, not bg-secondary: muted text on --secondary
                // measured 4.1:1 on Power-Up dark (FilterBar's pills sit on
                // the background for the same reason).
                : 'border-border text-muted-foreground hover:border-primary/20'
            )}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

// ─── Swatch styling ──────────────────────────────────────────────────────────
// A two-tone gradient from the theme's own Scan colour to its own accent,
// read live from its tokens inside the swatch's [data-theme] wrapper: the
// swatch is always exactly what the theme ships. (Until 2026-10-28 it was
// hand-copied hexes in useTheme.js, which drifted on ~12 themes, e.g. Sour
// Apple promised neon lime and shipped olive-lime.)
const SWATCH_FILL = 'linear-gradient(135deg, hsl(var(--cta)) 0%, hsl(var(--accent)) 100%)';

// A theme's swatch, drawn in its family's structure as well as its colours:
// the wrapper carries the theme's data-theme/data-polarity (as RarityStrip
// does), so rounded-xl follows that family's --radius-scale (Noir square,
// Candy round) and the fill carries its --card-texture (Neon's scanlines,
// Soda Fountain's halftone). Families differ by more than colour since the
// 2026-10-26 bolder pass; a plain circle hid that until you'd applied one.
function ThemeSwatch({ theme, polarity, familyId }) {
  return (
    <div
      data-theme={theme.id}
      data-polarity={getRenderedTone(theme, polarity)}
      className="relative w-9 h-9"
      aria-hidden="true"
    >
      <div
        className="w-9 h-9 rounded-xl border border-foreground/10"
        style={{ backgroundImage: `var(--card-texture), ${SWATCH_FILL}` }}
      />
      {familyId === 'cosmic' && <StarDots />}
    </div>
  );
}

// Cosmic's swatches read as generic warm/amber circles with nothing evoking
// "space" (same critique) — a few star-dots is a small, contained way to
// give the one family whose whole concept is astronomy an actual motif,
// without touching the live app's own background treatment.
function StarDots() {
  return (
    <>
      <span className="absolute top-1.5 left-2 w-[3px] h-[3px] rounded-full bg-white/90" />
      <span className="absolute top-4 right-2 w-[2px] h-[2px] rounded-full bg-white/70" />
      <span className="absolute bottom-2 left-3.5 w-[2px] h-[2px] rounded-full bg-white/80" />
    </>
  );
}

// ─── Polarity Toggle ─────────────────────────────────────────────────────────
// A 3rd axis, independent of family/palette: every theme id renders in both
// a dark and a light polarity (index.css's [data-theme][data-polarity]
// blocks), so this always reads the CURRENT theme's own dark/light swatch —
// never a fixed pair of colors — meaning it stays accurate no matter which
// theme is active, and previews exactly what tapping it will produce.
function PolarityToggle({ theme, polarity, onSelectPolarity, isPending }) {
  const match = THEMES.find(t => t.id === theme);
  return (
    // pt-3: the header above has no bottom padding, so without it the
    // last header line ("N new families", the retired note) sat ~6px off
    // these buttons while every other group gets 12-16px.
    <div className="px-4 pt-3 pb-3.5">
      <div className="flex items-center gap-2">
        {['dark', 'light'].map(p => {
          const selected = polarity === p;
          return (
            // aria-disabled + a guarded onClick, not `disabled`: a disabled
            // button leaves the tab order, so the current polarity was
            // unreachable by keyboard, and pressing the other one dropped
            // focus to <body> the moment the mutation went pending.
            <button
              key={p}
              onClick={() => { if (!selected && !isPending) onSelectPolarity(p); }}
              aria-disabled={isPending || undefined}
              aria-pressed={selected}
              className={cn(
                PICKER_FOCUS,
                'flex-1 flex items-center justify-center gap-2 h-11 rounded-full border text-xs font-mono capitalize transition-colors aria-disabled:cursor-not-allowed',
                selected ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/20'
              )}
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-foreground/10 flex-shrink-0"
                style={{ background: match?.[p]?.background }}
                aria-hidden="true"
              />
              {p}
            </button>
          );
        })}
      </div>
      {/* This toggle changes whichever theme is actually APPLIED, not
          whichever family the picker happens to be browsing below it —
          two independent /impeccable critique reviewers both flagged that
          distinction as invisible (it reads as broken when you're looking
          at a family that doesn't even support light/dark). Naming the
          real target theme here resolves it without needing a "browsing
          vs. applied" mode of its own. */}
      <p className="text-2xs font-mono text-muted-foreground mt-1.5 px-1">
        Applies to your current theme, {match?.label ?? theme}.
      </p>
    </div>
  );
}

// ─── Theme Picker ────────────────────────────────────────────────────────────
// Two-step now that there are 8 families (39 palettes, 2-6 each): Step 1
// picks a family, Step 2 picks a palette within it. `viewedFamilyId` is
// which family the picker is currently *browsing* — independent of `theme`
// (the actually *applied* palette) — so tapping around families to look at
// them never changes what's live until a swatch is actually tapped.
// Polarity (light/dark) is a separate control (PolarityToggle above) rather
// than folded into either step — but it only applies to Neon Arcade, the
// one family where every palette genuinely has both a dark and light
// rendering. Every other family is a single fixed
// polarity per theme (Botanical mixes light/dark PALETTES within itself,
// but no individual palette toggles), so the toggle only renders when the
// viewed family actually supports it — see familyHasPolarityToggle.
// Both picker steps lay out 3 per row with any short final row centered,
// not a CSS grid: 8 families (and Neon Arcade's 5 palettes) would
// leave a grid's last row as 2 tiles plus an empty slot that reads like
// something failed to load. Centered 3-over-2 reads as deliberate.
// A single row of 5 was ruled out -- at 375px each tile gets ~54px and
// "Botanical" alone needs ~59px in the 11px mono label.
const PICKER_ROW = 'flex flex-wrap justify-center gap-3';
const PICKER_TILE = 'w-[calc((100%_-_1.5rem)/3)]';
// One deliberate keyboard focus treatment for every picker control. The
// global `outline-ring/50` fallback was a half-alpha browser outline that
// all but vanished on light themes. --ring tracks --primary, so the ring is
// always this theme's own accent; offset against the card it sits on.
const PICKER_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card';

// Moves keyboard focus to `ref` when `request` matches `key`, then reports
// back so the request is spent. Only ever driven by a user's own step
// change -- never on first render, so opening Settings doesn't jump focus.
function useFocusRequest(ref, request, key, onHandled) {
  useEffect(() => {
    if (request !== key || !ref.current) return;
    ref.current.focus();
    onHandled();
  }, [request, key, ref, onHandled]);
}

function FamilyTile({ family, polarity, isCurrent, showNewBadge, onSelect, focusRequest, onFocusHandled }) {
  const ref = useRef(null);
  useFocusRequest(ref, focusRequest, `family:${family.id}`, onFocusHandled);
  // The tile previews the family's most characteristic theme (its
  // `preview`, e.g. Noir's Crimson rather than grey Carbon), else its free
  // theme, else its first: a family tile sells the family.
  const previewTheme = family.themes.find(t => t.id === family.preview)
    ?? family.themes.find(t => !t.pro) ?? family.themes[0];
  // This tile opens a family; it doesn't toggle anything, so no
  // aria-pressed (it always read "not pressed"). Where the user's own
  // theme lives is said in words instead.
  const label = [
    `Browse ${family.label} themes`,
    isCurrent && 'your current theme family',
    showNewBadge && 'new',
  ].filter(Boolean).join(', ');
  return (
    <button
      ref={ref}
      onClick={() => onSelect(family.id)}
      aria-label={label}
      className={cn(
        PICKER_TILE, PICKER_FOCUS, 'relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors',
        isCurrent ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/20'
      )}
    >
      {showNewBadge && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
      )}
      <ThemeSwatch theme={previewTheme} polarity={polarity} familyId={family.id} />
      {/* Each family names itself in its own display face -- the one part
          of a theme a swatch can't show. Sized per family
          (THEME_FAMILIES.labelSize, 11-14px) rather than one class: the
          five faces' x-heights differ enough that a single size made
          "Noir" read a size smaller than "Neon Arcade" (see useTheme.js). */}
      <span
        className="text-foreground text-center leading-tight"
        style={{ fontFamily: family.displayFont, fontSize: family.labelSize }}
      >
        {family.label}
      </span>
      {/* Words, not just the accent border: the dot carries the accent,
          the text stays foreground so it clears 4.5:1 at 11px on every
          theme (primary as small text doesn't). */}
      {isCurrent && (
        <span className="flex items-center gap-1 text-2xs font-mono text-foreground" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Current
        </span>
      )}
    </button>
  );
}

const RARITY_TIERS = ['common', 'uncommon', 'rare', 'ultra', 'legendary'];

// A palette's rarity ramp, previewed before you commit to it -- the ramp
// is the part of a theme that shows up on your collection (the Collection
// bar, Home's donut) and a swatch can't show it. The wrapper carries the
// tile theme's own data-theme/data-polarity, so every theme block in
// index.css (keyed on those attributes, not :root) scopes its
// --breakdown-* and --card to just this strip. It sits on that theme's
// own card colour, so the preview matches what you'd actually get.
// Equal widths: this previews the colours, not anyone's distribution.
function RarityStrip({ themeId, polarity }) {
  return (
    <div
      data-theme={themeId}
      data-polarity={polarity}
      className="w-full rounded-md bg-card border border-foreground/10 p-1"
      aria-hidden="true"
    >
      <div className="flex h-1.5 gap-px rounded-full overflow-hidden">
        {RARITY_TIERS.map(tier => (
          <div key={tier} className="flex-1 gauge-seg" style={{ background: tier === 'legendary' ? 'var(--holo-gradient, hsl(var(--breakdown-legendary)))' : `hsl(var(--breakdown-${tier}))` }} />
        ))}
      </div>
    </div>
  );
}

function ThemeFamilyTiles({ activeFamilyId, onSelectFamily, seenFamilies, polarity, focusRequest, onFocusHandled }) {
  return (
    <div className={cn(PICKER_ROW, 'p-4')}>
      {THEME_FAMILIES.map(family => (
        <FamilyTile
          key={family.id}
          family={family}
          polarity={polarity}
          isCurrent={family.id === activeFamilyId}
          // Clears itself the first time this tile is actually opened
          // (Settings' onSelectFamily marks it seen), not on a timer or a
          // manual dismiss — a launch that only ever shows up if you already
          // knew to look defeats the point of a "New" marker. A quiet dot,
          // not a text pill — an /impeccable critique found 4-5 loud "New"
          // pills showing at once (every Phase 2 family, all unseen on a
          // fresh install) diluted the signal rather than drawing attention.
          showNewBadge={family.isNew && !seenFamilies.has(family.id)}
          onSelect={onSelectFamily}
          focusRequest={focusRequest}
          onFocusHandled={onFocusHandled}
        />
      ))}
    </div>
  );
}

function ThemePalettePicker({ family, theme, polarity, onSelectTheme, isPro, isPending, onLockedTap, onBack, focusRequest, onFocusHandled }) {
  // Arriving from a family tile unmounts that tile, which would drop focus
  // to <body>; the family heading takes it instead, so a screen reader
  // announces where you landed.
  const headingRef = useRef(null);
  useFocusRequest(headingRef, focusRequest, 'palette-heading', onFocusHandled);
  // Botanical and Alloy mix fixed polarities (Meadow and Brushed
  // Aluminium are light pages; the rest dark), so
  // tapping between them flips the whole app light/dark. In those families
  // each tile says which it is, in words under its name, and the themes run
  // one kind then the other (in the order each first appears). They sit in
  // the same centred rows as every other family: Light and Dark headings
  // left a lone tile under a heading of its own (Alloy's one
  // light theme), and a 10px corner glyph before that was easy to miss.
  const tone = (t) => (t.light ? 'light' : 'dark');
  const kinds = [...new Set(family.themes.filter(t => !(t.dark && t.light)).map(tone))];
  const familyMixedPolarity = kinds.length > 1;
  const ordered = familyMixedPolarity
    ? kinds.flatMap(kind => family.themes.filter(t => tone(t) === kind))
    : family.themes;

  return (
    <div className="p-4 space-y-3">
      {/* 44px tall hit area (was ~16px), pulled back into the row with
          negative margins so the visible text keeps its alignment. */}
      <button
        onClick={onBack}
        className={cn(PICKER_FOCUS, 'h-11 -my-2.5 -ml-2 px-2 flex items-center gap-1 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground transition-colors')}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> All families
      </button>
      {/* The whole point of a two-step picker is orientation at 39 options
          — landing on 6 swatches with nothing naming which family they
          belong to defeated that, especially since this step is usually
          reached by the picker's own default (viewedFamilyId starts on the
          family containing your current theme), not a tap the user just
          made themselves. (/impeccable critique) */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-sm font-medium text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {family.label}
      </h2>
      <div className={PICKER_ROW}>
        {ordered.map((themeEntry) => {
          const { id, label, pro } = themeEntry;
          const locked = pro && !isPro;
          const selected = theme === id;
          const kind = familyMixedPolarity ? tone(themeEntry) : null;
          // Light/dark is only worth saying where it varies tile to tile
          // (the mixed families) -- elsewhere the old template left an
          // empty "()". Locked copy says what happens on activation
          // rather than naming a gesture, and warns that it leaves Settings.
          const modeNote = kind ? `, ${kind} mode` : '';
          const ariaLabel = locked
            ? `${label}${modeNote}, Pro only. Opens the upgrade page`
            : `Use ${label} theme${modeNote}`;
          return (
            // aria-disabled while a change is saving, not `disabled`: a
            // disabled button drops keyboard focus to <body> mid-change.
            <button
              key={id}
              onClick={() => {
                if (isPending) return;
                if (locked) onLockedTap();
                else onSelectTheme(id);
              }}
              aria-disabled={isPending || undefined}
              aria-label={ariaLabel}
              aria-pressed={selected}
              className={cn(
                PICKER_TILE, PICKER_FOCUS, 'relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors aria-disabled:cursor-wait',
                selected ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/20'
              )}
            >
              <ThemeSwatch theme={themeEntry} polarity={polarity} familyId={family.id} />
              {/* The applied theme's name steps up to foreground, so the
                  selection reads in the label as well as the border. */}
              <span className={cn('text-2xs font-mono text-center leading-tight', selected ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
              {kind && (
                <span className="-mt-1 flex items-center gap-1 text-2xs font-mono text-muted-foreground capitalize" aria-hidden="true">
                  {kind === 'light' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                  {kind}
                </span>
              )}
              <RarityStrip themeId={id} polarity={getRenderedTone(themeEntry, polarity)} />
              {locked && (
                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-background/80 border border-border flex items-center justify-center">
                  <Lock className="w-2.5 h-2.5 text-muted-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { isPro, isLoading: isProLoading } = useSubscription();
  const { theme, polarity, setTheme, setPolarity, isThemeLoading, isPending: themePending, retiredTheme, dismissRetiredTheme } = useTheme();
  // Both queries gate the picker: `theme` reads as Power-Up until the real
  // value loads, so rendering early flashed a Neon Arcade grid with
  // Power-Up pressed (and the Neon-only polarity toggle) for everyone else.
  const pickerLoading = isProLoading || isThemeLoading;
  // Each family tile names itself in its own display face (FamilyTile), so
  // those faces are needed before a family is ever applied. Only the
  // display weights, and the browser only downloads a face once a label
  // actually uses it. Deliberately NOT Google's text= subsetting: that
  // registers a glyph-partial face under the real family name, which could
  // win over the full face app-wide once that family is applied.
  useEffect(() => {
    const id = 'picker-label-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = PICKER_LABEL_FONTS_URL;
    document.head.appendChild(link);
  }, []);
  // Which control should take keyboard focus after a picker step change:
  // 'palette-heading' going in, 'family:<id>' coming back out. Null
  // otherwise, so nothing steals focus on first render.
  const [focusRequest, setFocusRequest] = useState(null);
  const clearFocusRequest = useCallback(() => setFocusRequest(null), []);
  // Polite status text for screen readers once a change is actually saved.
  // The optimistic reskin is visual-only; an error is already announced by
  // the toast useTheme raises, so only success needs saying here.
  const [themeAnnouncement, setThemeAnnouncement] = useState('');
  const announce = (text) => {
    // Clear first so the same message twice in a row is re-announced.
    setThemeAnnouncement('');
    requestAnimationFrame(() => setThemeAnnouncement(text));
  };
  const handleSelectTheme = (id) => {
    const label = THEMES.find(t => t.id === id)?.label ?? id;
    setTheme(id, { onSuccess: () => announce(`Theme changed to ${label}`) });
  };
  const handleSelectPolarity = (p) => {
    setPolarity(p, { onSuccess: () => announce(`Switched to ${p} mode`) });
  };
  // Which family the theme picker is currently browsing — defaults to
  // whichever family the actually-applied `theme` belongs to, so opening
  // Settings always lands on a step-2 view of your real theme rather than
  // step 1 every time. null once explicitly backed out to "all families".
  const [viewedFamilyId, setViewedFamilyId] = useState(
    () => THEME_FAMILIES.find(f => f.themes.some(t => t.id === theme))?.id ?? null
  );
  // The initializer above runs once at mount, using `theme`'s pre-load
  // default (power-up) — for anyone whose real theme isn't Power-Up, that
  // default resolves to the wrong family and nothing ever corrects it,
  // since useState's initial value never re-runs. Sync once, the moment
  // the real value actually loads; never again after that, so it doesn't
  // fight the user's own picker navigation.
  useEffect(() => {
    if (!isThemeLoading) {
      const realFamilyId = THEME_FAMILIES.find(f => f.themes.some(t => t.id === theme))?.id ?? null;
      setViewedFamilyId(realFamilyId);
      // Same pre-load default bit the "seen" set below: it was seeded from
      // Power-Up's family, so the family you're actually using kept its
      // "new" dot (and counted in "N new families"). In-memory only, same
      // as the original seed -- opening a tile is what persists it.
      if (realFamilyId) setSeenFamilies(prev => (prev.has(realFamilyId) ? prev : new Set(prev).add(realFamilyId)));
    }
     
  }, [isThemeLoading]);
  // The toggle changes the polarity of the ACTIVE theme, not whichever
  // family is currently being browsed — so its visibility depends on the
  // active theme's own family, not viewedFamilyId. Only Neon Arcade
  // currently has every palette in both polarities.
  const activeFamily = THEME_FAMILIES.find(f => f.themes.some(t => t.id === theme));
  const showPolarityToggle = familyHasPolarityToggle(activeFamily);
  // Tracks which theme families this browser has ever opened, purely to
  // clear the "New" badge on Cosmic/Botanical/Noir/Candy's tiles once seen —
  // per-device is fine for a one-time UI hint like this, same reasoning as
  // any other localStorage-backed "seen" flag. A family whose theme is
  // already applied (e.g. already on a Cosmic palette) counts as seen
  // immediately, not just once its tile is tapped.
  const [seenFamilies, setSeenFamilies] = useState(() => {
    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem('sippd_seen_theme_families') || '[]');
    } catch {
      stored = [];
    }
    return new Set(viewedFamilyId ? [...stored, viewedFamilyId] : stored);
  });
  const markFamilySeen = (id) => {
    setSeenFamilies(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem('sippd_seen_theme_families', JSON.stringify([...next]));
      } catch {
        // Best-effort only — a blocked/full localStorage just means the
        // badge may reappear next visit, not a functional failure.
      }
      return next;
    });
  };
  // One consolidated count instead of a "New" pill repeated on every
  // unseen family tile — a fresh install has 4 new Phase 2 families at
  // once, and 4 loud pills diluted the signal (/impeccable critique).
  const unseenNewFamilyCount = THEME_FAMILIES.filter(f => f.isNew && !seenFamilies.has(f.id)).length;
  const [panel, setPanel] = useState(null); // 'name' | 'region' | 'password'
  const [prefs, setPrefs] = useState(loadPrefs);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notifyPending, setNotifyPending] = useState(false);
  const [privatePending, setPrivatePending] = useState(false);

  // Google-only accounts have no password credential at all — ChangePasswordPanel's
  // "verify current password" step would always fail for them with a
  // confusing "Current password is incorrect," when the real issue is
  // there's no password to enter in the first place. Defaults to true
  // (show the normal password flow) if identities is ever unavailable,
  // so a data gap never hides a real feature by mistake.
  const hasPasswordAuth = user?.identities
    ? user.identities.some(i => i.provider === 'email')
    : true;

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profileError) toast.error('Could not load your profile');
  }, [profileError]);

  const refetchProfile = () => queryClient.invalidateQueries({ queryKey: ['my-profile', user?.id] });

  const {
    data: subscriptionDetails,
    isLoading: subscriptionLoading,
    isError: subscriptionError,
  } = useQuery({
    queryKey: ['subscription-status', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-subscription-status');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    enabled: !!user?.id && isPro,
  });

  useEffect(() => {
    if (subscriptionError) toast.error('Could not load your subscription details');
  }, [subscriptionError]);

  const handleManageSubscription = () => {
    if (!subscriptionDetails?.manage_url) {
      toast.error('Could not load subscription management link');
      return;
    }
    window.open(subscriptionDetails.manage_url, '_blank', 'noopener,noreferrer');
  };

  const updatePref = (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    savePrefs(next);
  };

  const updateFollowNotifyPref = async (next) => {
    if (next === profile?.notify_follows_pref) return;
    setNotifyPending(true);
    const { error } = await supabase.from('profiles').update({ notify_follows_pref: next }).eq('id', user.id);
    setNotifyPending(false);
    if (error) {
      toast.error('Failed to update pull alerts: ' + (error.message || 'Unknown error'));
      return;
    }
    refetchProfile();
    toast.success('Pull alerts updated');
  };

  const togglePrivate = async () => {
    setPrivatePending(true);
    const next = !profile?.is_private;
    const { error } = await supabase.from('profiles').update({ is_private: next }).eq('id', user.id);
    setPrivatePending(false);
    if (error) {
      toast.error('Failed to update privacy setting: ' + (error.message || 'Unknown error'));
      return;
    }
    refetchProfile();
    toast.success(next ? 'Account set to private' : 'Account set to public');
  };

  const defaultStatus = prefs.defaultStatus || 'collected';

  const handleExportData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const data = await exportUserData(user.id);
      downloadJson(data, `sippd-data-export-${format(new Date(), 'yyyy-MM-dd')}.json`);
      toast.success('Your data has been downloaded');
    } catch (error) {
      toast.error('Failed to export your data: ' + (error.message || 'Unknown error'));
    }
    setIsExporting(false);
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    const { data, error } = await supabase.functions.invoke('delete-account');
    if (error || data?.error) {
      toast.error('Failed to delete account: ' + (data?.error || error?.message || 'Unknown error'));
      setDeletingAccount(false);
      return;
    }
    await signOut();
    // Toaster is mounted at the app root (App.jsx), so this survives the
    // navigate() below — without it, the whole flow ends in silence: the
    // user is just dropped on the landing page with nothing confirming the
    // irreversible action they just took actually happened.
    toast.success('Your account has been deleted');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center border border-border"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-base font-display font-bold text-foreground tracking-wide">Settings</h1>
      </div>

      <div className="px-5 pt-4 pb-24">

        <SectionHeader title="Account" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          <SettingsRow
            label="Display Name"
            sub={profile?.full_name || 'Not set'}
            onClick={() => setPanel(panel === 'name' ? null : 'name')}
          />
          {panel === 'name' && (
            <div className="bg-secondary/30 border-t border-border">
              <EditNamePanel userId={user?.id} initialName={profile?.full_name} onDone={() => { setPanel(null); refetchProfile(); }} />
            </div>
          )}
          <SettingsRow
            label="Region"
            sub={profile?.region || 'Not set'}
            onClick={() => setPanel(panel === 'region' ? null : 'region')}
          />
          {panel === 'region' && (
            <div className="bg-secondary/30 border-t border-border">
              <EditRegionPanel userId={user?.id} initialRegion={profile?.region} onDone={() => { setPanel(null); refetchProfile(); }} />
            </div>
          )}
          <SettingsRow
            label="Email"
            sub={user?.email || 'Not set'}
            right={<span className="text-2xs font-mono text-muted-foreground">read-only</span>}
          />
          {hasPasswordAuth ? (
            <>
              <SettingsRow
                label="Change Password"
                onClick={() => setPanel(panel === 'password' ? null : 'password')}
              />
              {panel === 'password' && (
                <div className="bg-secondary/30">
                  <ChangePasswordPanel user={user} />
                </div>
              )}
            </>
          ) : (
            <SettingsRow
              label="Change Password"
              sub="You sign in with Google — no password to change"
            />
          )}
        </div>

        <SectionHeader title="Subscription" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {isProLoading ? (
            // isPro defaults to false while useSubscription()'s own query is
            // in flight — rendering the isPro branches below on that default
            // would show a real Pro subscriber "Upgrade to Pro" for a beat
            // on every load, which is worse than a loading row.
            <div className="px-4 py-3.5">
              <div className="h-4 w-40 rounded bg-secondary/60 animate-pulse" />
            </div>
          ) : isPro ? (
            <>
              <SettingsRow
                label="Status"
                right={<span className="text-xs font-mono font-semibold text-foreground">Pro — active</span>}
              />
              <SettingsRow
                label="Next Billing Date"
                sub={
                  subscriptionLoading
                    ? 'Loading…'
                    : subscriptionError
                      ? "Couldn't load"
                      : subscriptionDetails?.cancel_at
                        ? `Cancels ${format(new Date(subscriptionDetails.cancel_at), 'MMM d, yyyy')}`
                        : subscriptionDetails?.next_billing_date
                          ? format(new Date(subscriptionDetails.next_billing_date), 'MMM d, yyyy')
                          : 'Not available'
                }
              />
              <SettingsRow
                label="Manage Subscription"
                onClick={handleManageSubscription}
              />
            </>
          ) : (
            <SettingsRow
              label="Upgrade to Pro"
              sub="Unlimited crates, scans, and more"
              onClick={() => navigate('/pro')}
            />
          )}
        </div>

        <SectionHeader title="Appearance" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 pt-3.5">
            <p className="text-sm font-medium text-foreground">Theme</p>
            {/* Says what a theme actually changes (was "Pick your look",
                which restated the control). Free users also get the Pro
                rule, on its own line so neither sentence buries the other. */}
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              {pickerLoading ? 'Loading…' : 'Changes your colours, fonts and rarity bar.'}
            </p>
            {!pickerLoading && !isPro && (
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                Themes without a lock are free; the rest unlock with Pro.
              </p>
            )}
            {/* One-time note for users the retire migrations moved
                (profiles.retired_theme). Without it their look changed with
                no explanation. Stays until dismissed. */}
            {!pickerLoading && retiredTheme && RETIRED_THEMES[retiredTheme] && (
              <div className="flex items-start justify-between gap-2 mt-1.5">
                <p className="text-2xs font-mono text-foreground pt-0.5">
                  {RETIRED_THEMES[retiredTheme].label} was retired, so we moved you to{' '}
                  {THEMES.find(t => t.id === RETIRED_THEMES[retiredTheme].movedTo)?.label}, its closest match.
                </p>
                <button
                  onClick={() => dismissRetiredTheme()}
                  className={cn(PICKER_FOCUS, 'h-11 -my-3 -mr-2 px-2 flex-shrink-0 rounded-lg text-2xs font-mono text-muted-foreground hover:text-foreground transition-colors')}
                >
                  Dismiss
                </button>
              </div>
            )}
            <p className="sr-only" role="status" aria-live="polite">{themeAnnouncement}</p>
            {!pickerLoading && unseenNewFamilyCount > 0 && (
              <p className="text-2xs font-mono text-primary mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />
                {unseenNewFamilyCount} new {unseenNewFamilyCount === 1 ? 'family' : 'families'} this update
              </p>
            )}
          </div>
          {showPolarityToggle && !pickerLoading && (
            <PolarityToggle theme={theme} polarity={polarity} onSelectPolarity={handleSelectPolarity} isPending={themePending} />
          )}
          {pickerLoading ? (
            // Same reasoning as the Subscription section above: locked is
            // computed from isPro, so rendering real tiles here would
            // briefly lock every theme — including a Pro user's own
            // already-selected one — until the subscription query
            // resolves. Shaped to match whichever step will actually
            // resolve once loading finishes, not always step 1 — for most
            // returning users viewedFamilyId is already non-null (it
            // defaults to the family containing their current theme), so
            // the real resolved view is step 2's swatch grid, and a
            // step-1 skeleton there was a real layout jump, not the
            // "no jump" the old comment here claimed. (/impeccable critique)
            // aria-busy + a status line so a screen reader hears that the
            // picker is loading rather than meeting an empty region. No real
            // controls in here: the old skeleton's live "All families" button
            // could be pressed mid-load.
            <div aria-busy="true">
              <p className="sr-only" role="status">Loading themes</p>
              {viewedFamilyId ? (
                (() => {
                  const loadingFamily = THEME_FAMILIES.find(f => f.id === viewedFamilyId);
                  return (
                    <div className="p-4 space-y-3" aria-hidden="true">
                      <div className="h-4 w-24 rounded bg-secondary/60 animate-pulse" />
                      {/* While the theme itself is loading, viewedFamilyId is
                          still the Power-Up default, so naming it would flash
                          "Neon Arcade" at everyone. A bar until it's real. */}
                      {isThemeLoading
                        ? <div className="h-5 w-28 rounded bg-secondary/60 animate-pulse" />
                        : <p className="text-sm font-medium text-foreground">{loadingFamily?.label}</p>}
                      <div className={PICKER_ROW}>
                        {loadingFamily?.themes.map(({ id }) => (
                          <div key={id} className={cn(PICKER_TILE, 'flex flex-col items-center gap-2 rounded-xl border border-border p-3')}>
                            <div className="w-9 h-9 rounded-full bg-secondary/60 animate-pulse" />
                            <div className="h-2.5 w-10 rounded bg-secondary/60 animate-pulse" />
                            {/* Same footprint as RarityStrip, so tiles don't grow on load. */}
                            <div className="h-4 w-full rounded-md bg-secondary/60 animate-pulse" />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className={cn(PICKER_ROW, 'p-4')} aria-hidden="true">
                  {THEME_FAMILIES.map(({ id }) => (
                    <div key={id} className={cn(PICKER_TILE, 'flex flex-col items-center gap-2 rounded-xl border border-border p-3')}>
                      <div className="w-9 h-9 rounded-full bg-secondary/60 animate-pulse" />
                      <div className="h-2.5 w-10 rounded bg-secondary/60 animate-pulse" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : viewedFamilyId ? (
            <ThemePalettePicker
              family={THEME_FAMILIES.find(f => f.id === viewedFamilyId)}
              theme={theme}
              polarity={polarity}
              onSelectTheme={handleSelectTheme}
              isPro={isPro}
              isPending={themePending}
              onLockedTap={() => navigate('/pro')}
              onBack={() => { setFocusRequest(`family:${viewedFamilyId}`); setViewedFamilyId(null); }}
              focusRequest={focusRequest}
              onFocusHandled={clearFocusRequest}
            />
          ) : (
            <ThemeFamilyTiles
              activeFamilyId={activeFamily?.id}
              onSelectFamily={id => { setFocusRequest('palette-heading'); setViewedFamilyId(id); markFamilySeen(id); }}
              seenFamilies={seenFamilies}
              polarity={polarity}
              focusRequest={focusRequest}
              onFocusHandled={clearFocusRequest}
            />
          )}
        </div>

        <SectionHeader title="Preferences" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          <div>
            <div className="px-4 pt-3.5 pb-1">
              <p className="text-sm font-medium text-foreground">Default Status</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">When adding a new can</p>
            </div>
            <ChipToggle
              options={STATUSES}
              value={defaultStatus}
              onChange={v => updatePref('defaultStatus', v)}
            />
          </div>
        </div>

        <SectionHeader title="Notifications" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-sm font-medium text-foreground">Pull Alerts</p>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">Notify me when someone I follow adds a can</p>
          </div>
          {profileLoading ? (
            // Not real chips reading the actual saved value yet — the
            // profile query hasn't resolved, and asserting a pressed state
            // (whichever chip !!undefined would match below) would
            // momentarily lie about the user's real setting.
            <div className="flex gap-2 px-4 pb-3.5">
              {FOLLOW_NOTIFY_OPTIONS.map(o => (
                <div key={o.value} className="h-10 w-20 rounded-full bg-secondary/60 animate-pulse" />
              ))}
            </div>
          ) : (
            <ChipToggle
              options={FOLLOW_NOTIFY_OPTIONS}
              value={profile?.notify_follows_pref || 'off'}
              onChange={updateFollowNotifyPref}
              disabled={notifyPending}
            />
          )}
        </div>

        <SectionHeader title="Privacy" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Private Account</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">Only approved followers can see your collection</p>
            </div>
            {profileLoading ? (
              <div className="w-11 h-6 rounded-full bg-secondary/60 animate-pulse flex-shrink-0" />
            ) : (
              <button
                onClick={togglePrivate}
                role="switch"
                aria-checked={!!profile?.is_private}
                aria-label="Private Account"
                disabled={privatePending}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  profile?.is_private ? 'bg-primary' : 'bg-secondary border border-border'
                )}
              >
                <div className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-foreground shadow transition-all',
                  profile?.is_private ? 'left-5' : 'left-0.5'
                )} />
              </button>
            )}
          </div>
          <SettingsRow
            label="Preview Public Profile"
            sub="See exactly what a stranger or follower sees"
            onClick={() => navigate(`/u/${user.id}?preview=true`)}
          />
        </div>

        <SectionHeader title="Your Data" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          <SettingsRow
            label="Export My Data"
            sub="Includes your collection, votes, trades, and account info — keep the file safe"
            onClick={isExporting ? undefined : handleExportData}
            right={isExporting ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" /> : undefined}
          />
        </div>

        <SectionHeader title="Danger Zone" />
        <div className="bg-card border border-destructive/20 rounded-2xl overflow-hidden divide-y divide-border">
          <SettingsRow
            label="Delete Account"
            sub="Permanently remove all your data"
            danger
            onClick={() => setShowDeleteConfirm(true)}
          />
        </div>

        <LegalFooter className="pt-2" />
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        isPending={deletingAccount}
        requireTypedConfirmation
        title="Delete Account?"
        description="This will permanently delete your account and all your data. This cannot be undone."
        confirmLabel="Delete My Account"
      />
    </div>
  );
}
