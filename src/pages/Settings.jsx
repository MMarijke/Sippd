import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
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
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3.5 text-left',
        danger ? 'text-destructive' : 'text-foreground',
        'hover:bg-secondary/50 transition-colors'
      )}
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs font-mono text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {right !== undefined ? right : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
    </button>
  );
}

// ─── Edit Display Name ────────────────────────────────────────────────────────
function EditNamePanel({ user, onDone }) {
  const [value, setValue] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    await base44.auth.updateMe({ full_name: value.trim() });
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

// ─── Change Password ──────────────────────────────────────────────────────────
function ChangePasswordPanel() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (form.next.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (form.next !== form.confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      await base44.auth.changePassword({ current_password: form.current, new_password: form.next });
      toast.success('Password changed');
      setForm({ current: '', next: '', confirm: '' });
    } catch {
      toast.error('Current password is incorrect');
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

// ─── Delete Account ───────────────────────────────────────────────────────────
function DeleteAccountPanel() {
  const [input, setInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    if (input !== 'DELETE') return;
    setDeleting(true);
    try {
      const user = await base44.auth.me();
      const items = await base44.entities.UserCollection.list('-created_date', 2000);
      const mine = items.filter(i => i.created_by === user.email);
      await Promise.all(mine.map(i => base44.entities.UserCollection.delete(i.id)));
      await base44.auth.logout();
    } catch {
      toast.error('Something went wrong. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 px-5 pt-4">
      <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
        <p className="text-xs font-mono text-destructive leading-relaxed">
          This will permanently delete your collection data and log you out. This cannot be undone.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-mono text-muted-foreground">Type <span className="text-foreground font-semibold">DELETE</span> to confirm:</p>
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="DELETE"
          className="bg-secondary border-destructive/30 focus-visible:ring-destructive/50 font-mono"
        />
      </div>
      <Button
        variant="destructive"
        className="w-full font-mono text-xs gap-2"
        disabled={input !== 'DELETE' || deleting}
        onClick={confirm}
      >
        <Trash2 className="w-4 h-4" />
        {deleting ? 'Deleting…' : 'Delete My Account'}
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
  const [user, setUser] = useState(null);
  const [panel, setPanel] = useState(null); // 'name' | 'password' | 'delete'
  const [prefs, setPrefs] = useState(loadPrefs);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const updatePref = (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    savePrefs(next);
  };

  const defaultStatus = prefs.defaultStatus || 'collected';
  const defaultRarity = prefs.defaultRarity || 'Common';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center border border-border"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-base font-display font-bold text-foreground tracking-wide">Settings</h1>
      </div>

      <div className="px-5 pt-4 pb-24">

        {/* ACCOUNT */}
        <SectionHeader title="Account" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          <SettingsRow
            label="Display Name"
            sub={user?.full_name || '—'}
            onClick={() => setPanel(panel === 'name' ? null : 'name')}
          />
          {panel === 'name' && (
            <div className="bg-secondary/30 border-t border-border">
              <EditNamePanel user={user} onDone={() => { setPanel(null); base44.auth.me().then(setUser); }} />
            </div>
          )}
          <SettingsRow
            label="Email"
            sub={user?.email || '—'}
            onClick={() => {}}
            right={<span className="text-[10px] font-mono text-muted-foreground">read-only</span>}
          />
          <SettingsRow
            label="Change Password"
            onClick={() => setPanel(panel === 'password' ? null : 'password')}
          />
          {panel === 'password' && (
            <div className="bg-secondary/30">
              <ChangePasswordPanel />
            </div>
          )}
        </div>

        {/* PREFERENCES */}
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

        {/* NOTIFICATIONS */}
        <SectionHeader title="Notifications" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Rare Pull Alerts</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">Notify me when someone I follow adds an Ultra Rare or Legendary can</p>
            </div>
            <button
              onClick={async () => {
                const next = !user?.notify_rare_follows;
                await base44.auth.updateMe({ notify_rare_follows: next });
                const updated = await base44.auth.me();
                setUser(updated);
                toast.success(next ? 'Rare pull alerts enabled' : 'Rare pull alerts disabled');
              }}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                user?.notify_rare_follows ? 'bg-primary' : 'bg-secondary border border-border'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                user?.notify_rare_follows ? 'left-5' : 'left-0.5'
              )} />
            </button>
          </div>
        </div>

        {/* PRIVACY */}
        <SectionHeader title="Privacy" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Private Account</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">Only approved followers can see your collection</p>
            </div>
            <button
              onClick={async () => {
                const next = !user?.is_private;
                await base44.auth.updateMe({ is_private: next });
                const updated = await base44.auth.me();
                setUser(updated);
                toast.success(next ? 'Account set to private' : 'Account set to public');
              }}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                user?.is_private ? 'bg-primary' : 'bg-secondary border border-border'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                user?.is_private ? 'left-5' : 'left-0.5'
              )} />
            </button>
          </div>
        </div>

        {/* DANGER ZONE */}
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