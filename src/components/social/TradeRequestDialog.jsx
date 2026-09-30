import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { X, ArrowRightLeft, Send } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { rarityTileBackground } from '@/lib/canBgColors';

export default function TradeRequestDialog({ targetUser, currentUser, onClose }) {
  const [offerCanId, setOfferCanId] = useState('');
  const [wantCanName, setWantCanName] = useState('');
  const [message, setMessage] = useState('');
  const [offerSearch, setOfferSearch] = useState('');

  const { data: myCollection = [] } = useQuery({
    queryKey: ['user-collection', currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const myCollected = useMemo(
    () => myCollection.filter(c => c.status === 'collected'),
    [myCollection]
  );

  const filteredOffer = useMemo(
    () => myCollected.filter(c =>
      !offerSearch ||
      c.can_name?.toLowerCase().includes(offerSearch.toLowerCase()) ||
      c.can_brand?.toLowerCase().includes(offerSearch.toLowerCase())
    ),
    [myCollected, offerSearch]
  );

  const selectedOffer = myCollected.find(c => c.id === offerCanId);

  const sendRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('send_trade_request', {
        p_caller_id: currentUser.id,
        p_target_id: targetUser.id,
        p_offer_can_name: selectedOffer?.can_name || null,
        p_offer_can_brand: selectedOffer?.can_brand || null,
        p_offer_can_rarity: selectedOffer?.can_rarity || null,
        p_want_can_name: wantCanName.trim(),
        p_message: message.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Trade request sent!');
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to send trade request: ' + (error.message || 'Unknown error'));
    },
  });

  const canSubmit = offerCanId && wantCanName.trim();

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="bottom"
        hideClose
        className="max-w-lg mx-auto bg-card border-t border-border rounded-t-3xl flex flex-col p-0"
        style={{ maxHeight: '88vh' }}
      >
        <SheetDescription className="sr-only">Propose a trade with {targetUser?.full_name || 'this collector'}.</SheetDescription>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            <div>
              <SheetTitle asChild>
                <h2 className="text-base font-display font-bold text-foreground">Propose a Trade</h2>
              </SheetTitle>
              <p className="text-2xs font-mono text-muted-foreground">with {targetUser?.full_name || 'this collector'}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
          <div>
            <label htmlFor="trade-offer-search" className="text-xs font-mono text-muted-foreground mb-1.5 block">I'm offering…</label>
            {selectedOffer ? (
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
                <div
                  className="w-9 h-9 rounded-lg overflow-hidden border border-border flex-shrink-0"
                  style={{ background: rarityTileBackground(selectedOffer.can_rarity) }}
                >
                  {selectedOffer.can_image_url && (
                    <img src={selectedOffer.can_image_url} alt={selectedOffer.can_name} className="w-full h-full object-contain" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-foreground truncate">{selectedOffer.can_name}</p>
                  <p className="text-2xs font-mono text-muted-foreground">{selectedOffer.can_brand}</p>
                </div>
                <button onClick={() => { setOfferCanId(''); setOfferSearch(''); }} aria-label="Clear selected offer" className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Input
                  id="trade-offer-search"
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
                        style={{ background: rarityTileBackground(item.can_rarity) }}
                      >
                        {item.can_image_url && <img src={item.can_image_url} alt={item.can_name} loading="lazy" decoding="async" className="w-full h-full object-contain" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-body font-medium text-foreground truncate">{item.can_name}</p>
                        <p className="text-2xs font-mono text-muted-foreground">{item.can_brand}</p>
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

          <div>
            <label htmlFor="trade-want-can" className="text-xs font-mono text-muted-foreground mb-1.5 block">I want… (describe the can)</label>
            <Input
              id="trade-want-can"
              value={wantCanName}
              onChange={e => setWantCanName(e.target.value)}
              placeholder="e.g. Monster Ultra Gold"
              className="bg-secondary border-border font-body text-sm"
            />
          </div>

          <div>
            <label htmlFor="trade-message" className="text-xs font-mono text-muted-foreground mb-1.5 block">Message (optional)</label>
            <Input
              id="trade-message"
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
      </SheetContent>
    </Sheet>
  );
}
