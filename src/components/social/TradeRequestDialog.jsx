import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, ArrowRightLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function TradeRequestDialog({ targetUser, currentUser, onClose }) {
  const [offerCanId, setOfferCanId] = useState('');
  const [wantCanName, setWantCanName] = useState('');
  const [message, setMessage] = useState('');
  const [offerSearch, setOfferSearch] = useState('');

  const { data: myCollection = [] } = useQuery({
    queryKey: ['user-collection', currentUser?.id],
    queryFn: () => base44.entities.UserCollection.list('-created_date'),
    enabled: !!currentUser?.id,
  });

  const myCollected = myCollection.filter(c => c.status === 'collected');
  const filteredOffer = myCollected.filter(c =>
    !offerSearch ||
    c.can_name?.toLowerCase().includes(offerSearch.toLowerCase()) ||
    c.can_brand?.toLowerCase().includes(offerSearch.toLowerCase())
  );

  const selectedOffer = myCollected.find(c => c.id === offerCanId);

  const sendRequest = useMutation({
    mutationFn: () => base44.entities.Notification.create({
      recipient_id: targetUser.id,
      recipient_email: targetUser.email,
      type: 'trade_request',
      actor_id: currentUser.id,
      actor_name: currentUser.full_name || currentUser.email,
      trade_offer_can_name: selectedOffer?.can_name || '',
      trade_offer_can_brand: selectedOffer?.can_brand || '',
      trade_offer_can_rarity: selectedOffer?.can_rarity || '',
      trade_want_can_name: wantCanName.trim(),
      trade_message: message.trim(),
      trade_status: 'pending',
      is_read: false,
    }),
    onSuccess: () => {
      toast.success('Trade request sent!');
      onClose();
    },
  });

  const canSubmit = offerCanId && wantCanName.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card border-t border-border rounded-t-3xl flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-base font-display font-bold text-foreground">Propose a Trade</h2>
              <p className="text-[11px] font-mono text-muted-foreground">with {targetUser?.full_name || 'this collector'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
          {/* Offer: can I'm giving */}
          <div>
            <label className="text-xs font-mono text-muted-foreground mb-1.5 block">I'm offering…</label>
            {selectedOffer ? (
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
                <div
                  className="w-9 h-9 rounded-lg overflow-hidden border border-border flex-shrink-0"
                  style={{ background: selectedOffer.can_bg_color || '#0D2B2B' }}
                >
                  {selectedOffer.can_image_url && (
                    <img src={selectedOffer.can_image_url} alt={selectedOffer.can_name} className="w-full h-full object-contain" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-foreground truncate">{selectedOffer.can_name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{selectedOffer.can_brand}</p>
                </div>
                <button onClick={() => { setOfferCanId(''); setOfferSearch(''); }} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Input
                  value={offerSearch}
                  onChange={e => setOfferSearch(e.target.value)}
                  placeholder="Search your collection…"
                  className="bg-secondary border-border font-body text-sm"
                />
                <div className="bg-secondary border border-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {filteredOffer.slice(0, 20).map(item => (
                    <button
                      key={item.id}
                      onClick={() => { setOfferCanId(item.id); setOfferSearch(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div
                        className="w-7 h-7 rounded-md overflow-hidden border border-border flex-shrink-0"
                        style={{ background: item.can_bg_color || '#0D2B2B' }}
                      >
                        {item.can_image_url && <img src={item.can_image_url} alt={item.can_name} className="w-full h-full object-contain" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-body font-medium text-foreground truncate">{item.can_name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{item.can_brand}</p>
                      </div>
                    </button>
                  ))}
                  {filteredOffer.length === 0 && (
                    <p className="text-xs font-mono text-muted-foreground text-center py-4">No cans found.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Want: can they're giving */}
          <div>
            <label className="text-xs font-mono text-muted-foreground mb-1.5 block">I want… (describe the can)</label>
            <Input
              value={wantCanName}
              onChange={e => setWantCanName(e.target.value)}
              placeholder="e.g. Monster Ultra Gold"
              className="bg-secondary border-border font-body text-sm"
            />
          </div>

          {/* Optional message */}
          <div>
            <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Message (optional)</label>
            <Input
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Any note for the other collector…"
              className="bg-secondary border-border font-body text-sm"
            />
          </div>

          <Button
            className="w-full font-mono text-sm gap-2"
            disabled={!canSubmit || sendRequest.isPending}
            onClick={() => sendRequest.mutate()}
          >
            <Send className="w-4 h-4" />
            {sendRequest.isPending ? 'Sending…' : 'Send Trade Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}