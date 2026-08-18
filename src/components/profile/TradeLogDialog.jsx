import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, ArrowRightLeft, User, BookmarkCheck, BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import TradeTemplatesSheet from './TradeTemplatesSheet';

export default function TradeLogDialog({ collection, onClose }) {
  const queryClient = useQueryClient();
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

  const collected = collection.filter(c => c.status === 'collected');

  // Load connections (people the current user follows or is followed by)
  const { data: follows = [] } = useQuery({
    queryKey: ['follows-for-trade'],
    queryFn: () => base44.entities.Follow.list('-created_date', 100),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-for-trade'],
    queryFn: () => base44.entities.User.list(),
    enabled: follows.length > 0,
  });

  // Build a searchable list of known users from follow relationships
  const connectedUserIds = new Set([
    ...follows.map(f => f.follower_id),
    ...follows.map(f => f.following_id),
  ]);
  const connectedUsers = allUsers.filter(u => connectedUserIds.has(u.id));
  const filteredUsers = userSearch
    ? connectedUsers.filter(u =>
        u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
      )
    : connectedUsers.slice(0, 8);

  const filteredAway = collected.filter(c =>
    !searchAway || c.can_name?.toLowerCase().includes(searchAway.toLowerCase()) || c.can_brand?.toLowerCase().includes(searchAway.toLowerCase())
  );
  const filteredReceived = collected.filter(c =>
    !searchReceived || c.can_name?.toLowerCase().includes(searchReceived.toLowerCase()) || c.can_brand?.toLowerCase().includes(searchReceived.toLowerCase())
  );

  const selectedAway = collected.find(c => c.id === tradedAwayId);
  const selectedReceived = collected.find(c => c.id === receivedId);

  const saveTemplate = useMutation({
    mutationFn: () => base44.entities.TradeTemplate.create({
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
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-templates'] });
      toast.success('Template saved!');
      setTemplateName('');
      setShowSaveTemplate(false);
    },
  });

  const applyTemplate = (tpl) => {
    setTradedAwayId(tpl.traded_away_id || '');
    setReceivedId(tpl.received_id || '');
    setNotes(tpl.notes || '');
  };

  const logTrade = useMutation({
    mutationFn: () => base44.entities.Trade.create({
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
      traded_with_id: tradedWithId || undefined,
      notes: notes.trim(),
      trade_date: tradeDate,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      toast.success('Trade logged!');
      onClose();
    },
  });

  const canSubmit = tradedAwayId && receivedId;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card border-t border-border rounded-t-3xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-bold text-foreground">Log a Trade</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-mono hover:bg-primary/20 transition-colors"
            >
              <BookmarkCheck className="w-3.5 h-3.5" /> Templates
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
          {/* Can Given Away */}
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

          {/* Can Received */}
          <CanPicker
            label="Can I Received"
            items={filteredReceived}
            selected={selectedReceived}
            search={searchReceived}
            onSearch={setSearchReceived}
            onSelect={id => { setReceivedId(id); setSearchReceived(''); }}
            onClear={() => setReceivedId('')}
          />

          {/* Meta fields */}
          <div className="space-y-3">
            {/* Traded With — supports picking a Canvolt user */}
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Traded With (optional)</label>
              {tradedWithId ? (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                  <User className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-body text-foreground flex-1 truncate">{tradedWith}</span>
                  <button
                    onClick={() => { setTradedWith(''); setTradedWithId(''); setUserSearch(''); }}
                    className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={userSearch || tradedWith}
                    onChange={e => {
                      const val = e.target.value;
                      setUserSearch(val);
                      setTradedWith(val);
                      setShowUserList(true);
                    }}
                    onFocus={() => setShowUserList(true)}
                    onBlur={() => setTimeout(() => setShowUserList(false), 150)}
                    placeholder="Search Canvolt users or enter a name…"
                    className="bg-secondary border-border font-body text-sm"
                  />
                  {showUserList && filteredUsers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-10 max-h-40 overflow-y-auto shadow-lg">
                      {filteredUsers.map(u => (
                        <button
                          key={u.id}
                          onMouseDown={() => {
                            setTradedWith(u.full_name || u.email);
                            setTradedWithId(u.id);
                            setUserSearch('');
                            setShowUserList(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left"
                        >
                          <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-display text-primary">{(u.full_name || u.email)?.[0]?.toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-body text-foreground truncate">{u.full_name || u.email}</p>
                            {u.full_name && <p className="text-[10px] font-mono text-muted-foreground truncate">{u.email}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Date</label>
              <Input
                type="date"
                value={tradeDate}
                onChange={e => setTradeDate(e.target.value)}
                className="bg-secondary border-border font-body text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any details about the trade..."
                className="bg-secondary border-border font-body text-sm"
              />
            </div>
          </div>

          {/* Save as Template */}
          {canSubmit && (
            <div>
              {showSaveTemplate ? (
                <div className="flex gap-2">
                  <Input
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="Template name…"
                    className="bg-secondary border-border font-body text-sm flex-1"
                    onKeyDown={e => { if (e.key === 'Enter' && templateName.trim()) saveTemplate.mutate(); }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-mono text-xs border-primary/20 text-primary hover:bg-primary/10 flex-shrink-0"
                    disabled={!templateName.trim() || saveTemplate.isPending}
                    onClick={() => saveTemplate.mutate()}
                  >
                    {saveTemplate.isPending ? '…' : 'Save'}
                  </Button>
                  <button onClick={() => setShowSaveTemplate(false)} className="text-muted-foreground hover:text-foreground">
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
            className="w-full font-mono text-sm"
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
      </div>
    </div>
  );
}

function CanPicker({ label, items, selected, search, onSearch, onSelect, onClear }) {
  const showList = !selected && (search.length > 0 || items.length <= 8);

  return (
    <div>
      <label className="text-xs font-mono text-muted-foreground mb-1.5 block">{label}</label>
      {selected ? (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
          <div
            className="w-9 h-9 rounded-lg overflow-hidden border border-border flex-shrink-0"
            style={{ background: selected.can_bg_color || '#0D2B2B' }}
          >
            {selected.can_image_url && (
              <img src={selected.can_image_url} alt={selected.can_name} className="w-full h-full object-contain" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-medium text-foreground truncate">{selected.can_name}</p>
            <p className="text-[11px] font-mono text-muted-foreground">{selected.can_brand}</p>
          </div>
          <button onClick={onClear} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
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
                    style={{ background: item.can_bg_color || '#0D2B2B' }}
                  >
                    {item.can_image_url && (
                      <img src={item.can_image_url} alt={item.can_name} className="w-full h-full object-contain" />
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