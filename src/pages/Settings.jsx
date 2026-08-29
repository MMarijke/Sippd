import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
      <p className="text-xs font-mono text-muted-foreground">Enter your new display name.</p>
      <Input
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
      <p className="text-xs font-mono text-muted-foreground">Your city or country (shown on leaderboard)</p>
      <Input
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
      <Input
        type="password"
        placeholder="Current password"
        value={form.current}
        onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
        className="bg-secondary border-border focus-visible:ring-primary/50"
      />
      <Input
        type="password"
        placeholder="New password"
        value={form.next}
        onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
        className="bg-secondary border-border focus-visible:ring-primary/50"
      />
      <Input
        type="password"
        placeholder="Confirm new password"
        value={form.confirm}
        onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
        className="bg-secondary border-border focus-visible:ring-primary/50"
      />
      <Button className="w-full font-mono text-xs" onClick={save} disabled={saving}>
        {saving ? 'Updating…' : 'Update Password'}
      </Button>
    </div>
  );
}

// ─── Delete Account ─────────────────────────────────────────────────────────
function DeleteAccountPanel() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const canConfirm = confirmText.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!canConfirm || deleting) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke('delete-account');
    if (error || data?.error) {
      toast.error('Failed to delete account: ' + (data?.error || error?.message || 'Unknown error'));
      setDeleting(false);
      return;
    }
    await signOut();
    navigate('/login');
    toast.success('Your account has been deleted.');
  };

  return (
    <div className="space-y-4 px-5 pt-4">
      <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2">
        <p className="text-xs font-mono text-destructive leading-relaxed font-semibold">
          This permanently deletes your account. This cannot be undone.
        </p>
        <p className="text-xs font-mono text-muted-foreground leading-relaxed">
          Removed: your collection, crates, trades, trade templates, rarity votes,
          follows, notifications, and leaderboard score. Community cans you
          contributed to stay in the shared database, but your individual votes
          and favourites are removed from their counts.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-mono text-muted-foreground">
          Type <span className="text-destructive font-semibold">DELETE</span> to confirm
        </p>
        <Input
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder="DELETE"
          className="bg-secondary border-destructive/30 font-mono"
          autoComplete="off"
        />
      </div>

      <Button
        variant="destructive"
        className="w-full font-mono text-xs gap-2"
        disabled={!canConfirm || deleting}
        onClick={handleDelete}
      >
        <Trash2 className="w-4 h-4" />
        {deleting ? 'Deleting…' : 'Permanently Delete My Account'}
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
            'px-3 py-1 rounded-full text-xs font-mono border transition-colors',
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [panel, setPanel] = useState(null); // 'name' | 'region' | 'password' | 'delete'
  const [prefs, setPrefs] = useState(loadPrefs);

  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const refetchProfile = () => queryClient.invalidateQueries({ queryKey: ['my-profile', user?.id] });

  const updatePref = (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    savePrefs(next);
  };

  const toggleNotifyRareFollows = async () => {
    const next = !profile?.notify_rare_follows;
    const { error } = await supabase.from('profiles').update({ notify_rare_follows: next }).eq('id', user.id);
    if (error) { toast.error('Failed to update'); return; }
    refetchProfile();
    toast.success(next ? 'Rare pull alerts enabled' : 'Rare pull alerts disabled');
  };

  const togglePrivate = async () => {
    const next = !profile?.is_private;
    const { error } = await supabase.from('profiles').update({ is_private: next }).eq('id', user.id);
    if (error) { toast.error('Failed to update'); return; }
    refetchProfile();
    toast.success(next ? 'Account set to private' : 'Account set to public');
  };

  const defaultStatus = prefs.defaultStatus || 'collected';
  const defaultRarity = prefs.defaultRarity || 'Common';

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
            <div className="px-4 pt-3.5 pb-1">
              <p className="text-sm font-medium text-foreground">Default Rarity Vote</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">Pre-selected when voting</p>
            </div>
            <ChipToggle
              options={RARITIES}
              value={defaultRarity}
              onChange={v => updatePref('defaultRarity', v)}
            />
          </div>
        </div>

        <SectionHeader title="Notifications" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Rare Pull Alerts</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">Notify me when someone I follow adds an Ultra Rare or Legendary can</p>
            </div>
            <button
              onClick={toggleNotifyRareFollows}
              role="switch"
              aria-checked={!!profile?.notify_rare_follows}
              aria-label="Rare Pull Alerts"
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                profile?.notify_rare_follows ? 'bg-primary' : 'bg-secondary border border-border'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                profile?.notify_rare_follows ? 'left-5' : 'left-0.5'
              )} />
            </button>
          </div>
        </div>

        <SectionHeader title="Privacy" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Private Account</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">Only approved followers can see your collection</p>
            </div>
            <button
              onClick={togglePrivate}
              role="switch"
              aria-checked={!!profile?.is_private}
              aria-label="Private Account"
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                profile?.is_private ? 'bg-primary' : 'bg-secondary border border-border'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                profile?.is_private ? 'left-5' : 'left-0.5'
              )} />
            </button>
          </div>
        </div>

        <SectionHeader title="Danger Zone" />
        <div className="bg-card border border-destructive/20 rounded-2xl overflow-hidden divide-y divide-border">
          <SettingsRow
            label="Delete Account"
            sub="Permanently remove all your data"
            danger
            onClick={() => setPanel(panel === 'delete' ? null : 'delete')}
          />
          {panel === 'delete' && (
            <div className="bg-destructive/5">
              <DeleteAccountPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
