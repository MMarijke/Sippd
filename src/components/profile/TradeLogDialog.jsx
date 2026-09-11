import { useState, useMemo } from 'react';
import { DEFAULT_CAN_BG } from '@/lib/canBgColors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { X, ArrowRightLeft, User, BookmarkCheck, BookmarkPlus } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import TradeTemplatesSheet from './TradeTemplatesSheet';

export default function TradeLogDialog({ collection, onClose }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tradedAwayId, setTradedAwayId] = useState('');
  const [receivedId, setReceivedId] = useState('');
  const [tradedWith, setTradedWith] = useState('');
  const [tradedWithId, setTradedWithId] = useState('');
  const [notes, setNotes] = useState('');
  const [tradeDate, setTradeDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchAway, setSearchAway] = useState('');
  const [searchReceived, setSearchReceived] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const collected = useMemo(
    () => collection.filter(c => c.status === 'collected'),
    [collection]
  );

  // RLS already scopes this to rows the current user participates in
  // (follower or followee) — no explicit filter needed.
  const { data: follows = [] } = useQuery({
    queryKey: ['follows-for-trade'],
    queryFn: async () => {
      const { data, error } = await supabase.from('follows').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-for-trade'],
    queryFn: async () => {
      const { data, error } = await supabase.from('public_profiles').select('*');
      if (error) throw error;
      return data;
    },
    enabled: follows.length > 0,
  });

  const connectedUserIds = useMemo(
    () => new Set([
      ...follows.map(f => f.follower_id),
      ...follows.map(f => f.following_id),
    ]),
    [follows]
  );
  const connectedUsers = useMemo(
    () => allUsers.filter(u => connectedUserIds.has(u.id)),
    [allUsers, connectedUserIds]
  );
  // public_profiles has no email column, so this can only match on display name now
  const filteredUsers = useMemo(
    () => userSearch
      ? connectedUsers.filter(u => u.full_name?.toLowerCase().includes(userSearch.toLowerCase()))
      : connectedUsers.slice(0, 8),
    [connectedUsers, userSearch]
  );

  const filteredAway = useMemo(
    () => collected.filter(c =>
      !searchAway || c.can_name?.toLowerCase().includes(searchAway.toLowerCase()) || c.can_brand?.toLowerCase().includes(searchAway.toLowerCase())
    ),
    [collected, searchAway]
  );
  const filteredReceived = useMemo(
    () => collected.filter(c =>
      !searchReceived || c.can_name?.toLowerCase().includes(searchReceived.toLowerCase()) || c.can_brand?.toLowerCase().includes(searchReceived.toLowerCase())
    ),
    [collected, searchReceived]
  );

  const selectedAway = collected.find(c => c.id === tradedAwayId);
  const selectedReceived = collected.find(c => c.id === receivedId);

  const saveTemplate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('trade_templates').insert({
        owner_id: user.id,
        name: templateName.trim(),
        traded_away_id: tradedAwayId,
        traded_away_name: selectedAway?.can_name || '',
        traded_away_brand: selectedAway?.can_brand || '',
        traded_away_image_url: selectedAway?.can_image_url || '',
        traded_away_rarity: selectedAway?.can_rarity || '',
        received_id: receivedId,
        received_name: selectedReceived?.can_name || '',
        received_brand: selectedReceived?.can_brand || '',
        received_image_url: selectedReceived?.can_image_url || '',
        received_rarity: selectedReceived?.can_rarity || '',
        notes: notes.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-templates'] });
      toast.success('Template saved!');
      setTemplateName('');
      setShowSaveTemplate(false);
    },
    onError: (error) => {
      toast.error('Failed to save template: ' + (error.message || 'Unknown error'));
    },
  });

  const applyTemplate = (tpl) => {
    setTradedAwayId(tpl.traded_away_id || '');
    setReceivedId(tpl.received_id || '');
    setNotes(tpl.notes || '');
  };

  const logTrade = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('trades').insert({
        owner_id: user.id,
        traded_away_id: tradedAwayId,
        traded_away_name: selectedAway?.can_name || '',
        traded_away_brand: selectedAway?.can_brand || '',
        traded_away_image_url: selectedAway?.can_image_url || '',
        traded_away_rarity: selectedAway?.can_rarity || '',
        received_id: receivedId,
        received_name: selectedReceived?.can_name || '',
        received_brand: selectedReceived?.can_brand || '',
        received_image_url: selectedReceived?.can_image_url || '',
        received_rarity: selectedReceived?.can_rarity || '',
        traded_with: tradedWith.trim(),
        traded_with_id: tradedWithId || null,
        notes: notes.trim(),
        trade_date: tradeDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      toast.success('Trade logged!');
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to log trade: ' + (error.message || 'Unknown error'));
    },
  });

  const canSubmit = tradedAwayId && receivedId;

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="bottom"
        hideClose
        className="max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl flex flex-col p-0"
        style={{ maxHeight: '90vh' }}
      >
        <SheetDescription className="sr-only">Log a trade with another collector.</SheetDescription>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            <SheetTitle asChild>
              <h2 className="text-base font-display font-bold text-foreground">Log a Trade</h2>
            </SheetTitle>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="h-10 flex items-center gap-1.5 px-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-mono hover:bg-primary/20 transition-colors"
            >
              <BookmarkCheck className="w-3.5 h-3.5" /> Templates
            </button>
            <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
          <CanPicker
            label="Can I Gave Away"
            items={filteredAway}
            selected={selectedAway}
            search={searchAway}
            onSearch={setSearchAway}
            onSelect={id => { setTradedAwayId(id); setSearchAway(''); }}
            onClear={() => setTradedAwayId('')}
          />

          <div className="flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
          </div>

          <CanPicker
            label="Can I Received"
            items={filteredReceived}
            selected={selectedReceived}
            search={searchReceived}
            onSearch={setSearchReceived}
            onSelect={id => { setReceivedId(id); setSearchReceived(''); }}
            onClear={() => setReceivedId('')}
          />

          <div className="space-y-3">
            <div>
              <label htmlFor="trade-partner-search" className="text-xs font-mono text-muted-foreground mb-1 block">Traded With (optional)</label>
              {tradedWithId ? (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                  <User className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-body text-foreground flex-1 truncate">{tradedWith}</span>
                  <button
                    onClick={() => { setTradedWith(''); setTradedWithId(''); setUserSearch(''); }}
                    aria-label="Clear selected trade partner"
                    className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    id="trade-partner-search"
                    value={userSearch || tradedWith}
                    onChange={e => {
                      const val = e.target.value;
                      setUserSearch(val);
                      setTradedWith(val);
                      setShowUserList(true);
                    }}
                    onFocus={() => setShowUserList(true)}
                    onBlur={() => setTimeout(() => setShowUserList(false), 150)}
                    placeholder="Search Sippd users or enter a name…"
                    className="bg-secondary border-border font-body text-sm"
                  />
                  {showUserList && filteredUsers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-10 max-h-40 overflow-y-auto shadow-lg">
                      {filteredUsers.map(u => (
                        <button
                          key={u.id}
                          onMouseDown={() => {
                            setTradedWith(u.full_name || 'Collector');
                            setTradedWithId(u.id);
                            setUserSearch('');
                            setShowUserList(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left"
                        >
                          <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-display text-primary">{(u.full_name || 'C')?.[0]?.toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-body text-foreground truncate">{u.full_name || 'Collector'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="tradelog-date" className="text-xs font-mono text-muted-foreground mb-1 block">Date</label>
              <Input
                id="tradelog-date"
                type="date"
                value={tradeDate}
                onChange={e => setTradeDate(e.target.value)}
                className="bg-secondary border-border font-body text-sm"
              />
            </div>
            <div>
              <label htmlFor="tradelog-notes" className="text-xs font-mono text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input
                id="tradelog-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any details about the trade..."
                className="bg-secondary border-border font-body text-sm"
              />
            </div>
          </div>

          {canSubmit && (
            <div>
              {showSaveTemplate ? (
                <div className="flex gap-2">
                  <Input
                    aria-label="Template name"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="Template name…"
                    className="bg-secondary border-border font-body text-sm flex-1"
                    onKeyDown={e => { if (e.key === 'Enter' && templateName.trim()) saveTemplate.mutate(); }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 font-mono text-xs border-primary/20 text-primary hover:bg-primary/10 flex-shrink-0"
                    disabled={!templateName.trim() || saveTemplate.isPending}
                    onClick={() => saveTemplate.mutate()}
                  >
                    {saveTemplate.isPending ? '…' : 'Save'}
                  </Button>
                  <button onClick={() => setShowSaveTemplate(false)} aria-label="Cancel save template" className="p-[14px] -m-[14px] text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveTemplate(true)}
                  className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" /> Save as template
                </button>
              )}
            </div>
          )}

          <Button
            className="h-11 w-full font-mono text-sm"
            disabled={!canSubmit || logTrade.isPending}
            onClick={() => logTrade.mutate()}
          >
            {logTrade.isPending ? 'Saving…' : 'Log Trade'}
          </Button>

          {showTemplates && (
            <TradeTemplatesSheet
              onClose={() => setShowTemplates(false)}
              onUseTemplate={applyTemplate}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CanPicker({ label, items, selected, search, onSearch, onSelect, onClear }) {
  const showList = !selected && (search.length > 0 || items.length <= 8);
  const inputId = `can-picker-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div>
      <label htmlFor={inputId} className="text-xs font-mono text-muted-foreground mb-1.5 block">{label}</label>
      {selected ? (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
          <div
            className="w-9 h-9 rounded-lg overflow-hidden border border-border flex-shrink-0"
            style={{ background: selected.can_bg_color || DEFAULT_CAN_BG }}
          >
            {selected.can_image_url && (
              <img src={selected.can_image_url} alt={selected.can_name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-medium text-foreground truncate">{selected.can_name}</p>
            <p className="text-[11px] font-mono text-muted-foreground">{selected.can_brand}</p>
          </div>
          <button onClick={onClear} aria-label="Clear selection" className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            id={inputId}
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search your collection…"
            className="bg-secondary border-border font-body text-sm"
          />
          {showList && (
            <div className="bg-secondary border border-border rounded-xl overflow-hidden max-h-44 overflow-y-auto">
              {items.slice(0, 20).map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                >
                  <div
                    className="w-7 h-7 rounded-md overflow-hidden border border-border flex-shrink-0"
                    style={{ background: item.can_bg_color || DEFAULT_CAN_BG }}
                  >
                    {item.can_image_url && (
                      <img src={item.can_image_url} alt={item.can_name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-body font-medium text-foreground truncate">{item.can_name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{item.can_brand}</p>
                  </div>
                </button>
              ))}
              {items.length === 0 && (
                <p className="text-xs font-mono text-muted-foreground text-center py-4">No cans found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
