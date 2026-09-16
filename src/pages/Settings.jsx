import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme, THEMES } from '@/hooks/useTheme';
import { ArrowLeft, ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LegalFooter from '@/components/legal/LegalFooter';
import { exportUserData, downloadJson } from '@/lib/exportUserData';

const STATUSES = ['collected', 'wishlist'];
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary'];
const PREFS_KEY = 'canvolt_prefs';

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
}
function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function SectionHeader({ title }) {
  return (
    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest px-1 mb-1 mt-5 first:mt-0">
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
    if (form.next.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (form.next !== form.confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    // supabase.auth.updateUser() alone doesn't verify the current password —
    // re-authenticate first so "change password" actually requires knowing the old one.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: form.current,
    });
    if (verifyError) {
      toast.error('Current password is incorrect');
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
function ChipToggle({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            'h-10 px-3 flex items-center rounded-full text-xs font-mono border transition-colors',
            value === opt
              ? 'bg-primary/10 border-primary/40 text-primary'
              : 'bg-secondary border-border text-muted-foreground hover:border-primary/20'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Theme Picker ────────────────────────────────────────────────────────────
function ThemePicker({ theme, setTheme, isPro, isPending, onLockedTap }) {
  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {THEMES.map(({ id, label, pro, swatch }) => {
        const locked = pro && !isPro;
        const selected = theme === id;
        return (
          <button
            key={id}
            onClick={() => (locked ? onLockedTap() : setTheme(id))}
            disabled={isPending}
            aria-label={locked ? `${label} — Pro only, tap to upgrade` : `Use ${label} theme`}
            aria-pressed={selected}
            className={cn(
              'relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors',
              selected ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/20'
            )}
          >
            <div
              className="w-9 h-9 rounded-full border border-white/10"
              style={{ background: swatch }}
            />
            <span className="text-[10px] font-mono text-muted-foreground text-center leading-tight">{label}</span>
            {locked && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-background/80 border border-border flex items-center justify-center">
                <Lock className="w-2.5 h-2.5 text-muted-foreground" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { isPro, isLoading: isProLoading } = useSubscription();
  const { theme, setTheme, isPending: themePending } = useTheme();
  const [panel, setPanel] = useState(null); // 'name' | 'region' | 'password'
  const [prefs, setPrefs] = useState(loadPrefs);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notifyPending, setNotifyPending] = useState(false);
  const [privatePending, setPrivatePending] = useState(false);

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

  const toggleNotifyRareFollows = async () => {
    setNotifyPending(true);
    const next = !profile?.notify_rare_follows;
    const { error } = await supabase.from('profiles').update({ notify_rare_follows: next }).eq('id', user.id);
    setNotifyPending(false);
    if (error) {
      toast.error('Failed to update rare pull alerts: ' + (error.message || 'Unknown error'));
      return;
    }
    refetchProfile();
    toast.success(next ? 'Rare pull alerts enabled' : 'Rare pull alerts disabled');
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
  const defaultRarity = prefs.defaultRarity || 'Common';

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
            sub={profile?.full_name || '—'}
            onClick={() => setPanel(panel === 'name' ? null : 'name')}
          />
          {panel === 'name' && (
            <div className="bg-secondary/30 border-t border-border">
              <EditNamePanel userId={user?.id} initialName={profile?.full_name} onDone={() => { setPanel(null); refetchProfile(); }} />
            </div>
          )}
          <SettingsRow
            label="Region"
            sub={profile?.region || '—'}
            onClick={() => setPanel(panel === 'region' ? null : 'region')}
          />
          {panel === 'region' && (
            <div className="bg-secondary/30 border-t border-border">
              <EditRegionPanel userId={user?.id} initialRegion={profile?.region} onDone={() => { setPanel(null); refetchProfile(); }} />
            </div>
          )}
          <SettingsRow
            label="Email"
            sub={user?.email || '—'}
            right={<span className="text-[10px] font-mono text-muted-foreground">read-only</span>}
          />
          <SettingsRow
            label="Change Password"
            onClick={() => setPanel(panel === 'password' ? null : 'password')}
          />
          {panel === 'password' && (
            <div className="bg-secondary/30">
              <ChangePasswordPanel user={user} />
            </div>
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
                right={<span className="text-xs font-mono font-semibold text-primary">Pro — active</span>}
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
                          : '—'
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
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              {isProLoading ? 'Loading…' : isPro ? 'Pick your look' : 'Signal Cyan is free — the rest unlock with Pro'}
            </p>
          </div>
          {isProLoading ? (
            // Same reasoning as the Subscription section above: locked is
            // computed from isPro, so rendering real tiles here would briefly
            // lock every theme — including a Pro user's own already-selected
            // one — until the subscription query resolves.
            <div className="grid grid-cols-3 gap-3 p-4">
              {THEMES.map(({ id }) => (
                <div key={id} className="flex flex-col items-center gap-2 rounded-xl border border-border p-3">
                  <div className="w-9 h-9 rounded-full bg-secondary/60 animate-pulse" />
                  <div className="h-2.5 w-10 rounded bg-secondary/60 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <ThemePicker
              theme={theme}
              setTheme={setTheme}
              isPro={isPro}
              isPending={themePending}
              onLockedTap={() => navigate('/pro')}
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
          <div>
            <div className="px-4 pt-3.5 pb-2">
              <p className="text-sm font-medium text-foreground">Default Rarity Vote</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">Pre-selected when voting</p>
            </div>
            {/* A 5-option chip row put every rarity on screen at once, over
                the ≤4-visible-options guideline this app applies elsewhere
                (see FilterBar's Select for Status/Rarity/Sort) — a select
                shows one value at a time and reaches the same 44px target
                the chips needed anyway. */}
            <div className="px-4 pb-3.5">
              <Select value={defaultRarity} onValueChange={v => updatePref('defaultRarity', v)}>
                <SelectTrigger className="h-11 bg-secondary border-border text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <SectionHeader title="Notifications" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Rare Pull Alerts</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">Notify me when someone I follow adds an Ultra Rare or Legendary can</p>
            </div>
            {profileLoading ? (
              // Not a real switch reading the actual saved value yet — the
              // profile query hasn't resolved, and asserting an aria-checked
              // "off" state (which is what !!undefined would render below)
              // would momentarily lie about the user's real setting.
              <div className="w-11 h-6 rounded-full bg-secondary/60 animate-pulse flex-shrink-0" />
            ) : (
              <button
                onClick={toggleNotifyRareFollows}
                role="switch"
                aria-checked={!!profile?.notify_rare_follows}
                aria-label="Rare Pull Alerts"
                disabled={notifyPending}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  profile?.notify_rare_follows ? 'bg-primary' : 'bg-secondary border border-border'
                )}
              >
                <div className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-foreground shadow transition-all',
                  profile?.notify_rare_follows ? 'left-5' : 'left-0.5'
                )} />
              </button>
            )}
          </div>
        </div>

        <SectionHeader title="Privacy" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
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
        </div>

        <SectionHeader title="Your Data" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          <SettingsRow
            label="Export My Data"
            sub="Download everything Sippd has on you"
            onClick={handleExportData}
            right={isExporting ? <span className="text-[10px] font-mono text-muted-foreground">Exporting…</span> : undefined}
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
