import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import RarityBadge from '@/components/shared/RarityBadge';
import AddCanForm from '@/components/scan/AddCanForm';
import BarcodeScanner from '@/components/scan/BarcodeScanner';
import { toast } from 'sonner';

async function lookupOpenFoodFacts(barcode) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
  if (!res.ok) throw new Error(`Open Food Facts lookup failed (${res.status})`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  return {
    name:      p.product_name || '',
    brand:     p.brands       || '',
    image_url: p.image_front_url || '',
    barcode,
    _offSource: true,
  };
}

export default function Scan() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCan, setSelectedCan] = useState(null);
  const [offLookup, setOffLookup] = useState(false);

  const {
    data: sharedCans = [],
    isError: isSharedCansError,
    refetch: refetchSharedCans,
  } = useQuery({
    queryKey: ['shared-cans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_cans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isSharedCansError) toast.error('Could not load the can database');
  }, [isSharedCansError]);

  const handleBarcodeLookup = async (barcode) => {
    const match = sharedCans.find(c => c.barcode === barcode);
    if (match) {
      setSelectedCan(match);
      setMode('add');
      return;
    }
    setOffLookup(true);
    try {
      const result = await lookupOpenFoodFacts(barcode);
      setSelectedCan(result || { barcode, _offMiss: true });
      setMode('add');
    } catch {
      toast.error("Couldn't look up that barcode — check your connection and try again.");
    } finally {
      setOffLookup(false);
    }
  };

  const filtered = useMemo(
    () => searchQuery.length >= 2
      ? sharedCans.filter(c =>
          c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.barcode?.includes(searchQuery)
        )
      : [],
    [searchQuery, sharedCans]
  );

  const handleSearchKeyDown = async (e) => {
    if (e.key !== 'Enter') return;
    const q = searchQuery.trim();
    if (!q) return;

    if (/^\d{6,}$/.test(q)) {
      await handleBarcodeLookup(q);
      return;
    }

    if (filtered.length === 1) {
      setSelectedCan(filtered[0]);
      setMode('add');
    }
  };

  const handleSelectCan = (can) => {
    setSelectedCan(can);
    setMode('add');
  };

  if (mode === 'add') {
    return (
      <div>
        <PageHeader
          title={selectedCan?.id ? 'Confirm Pull' : 'New Can'}
          subtitle={selectedCan?.id ? 'Add to your vault' : 'Add a new can to the database'}
        />
        <AddCanForm
          prefillData={selectedCan?.id ? selectedCan : (selectedCan?.barcode ? { barcode: selectedCan.barcode, ...selectedCan } : null)}
          onSuccess={(addedCan) => {
            setMode('search');
            setSelectedCan(null);
            setSearchQuery('');
            navigate('/collection', addedCan ? { state: { addedCan } } : undefined);
          }}
          onCancel={() => { setMode('search'); setSelectedCan(null); }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <PageHeader
        title="Scan / Search"
        subtitle="Find a can or add a new one"
        action={
          <Button
            size="sm"
            variant="outline"
            className="font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => { setSelectedCan(null); setMode('add'); }}
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        }
      />

      <div className="px-5 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Name, brand, or barcode..."
            className="pl-9 bg-secondary border-border font-body"
          />
        </div>

        {offLookup && (
          // Not gated behind searchQuery.length — a camera-triggered scan
          // (the primary intended path) leaves the search box empty, and
          // this lookup still needs to show it's working either way.
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground font-mono">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking Open Food Facts...
          </div>
        )}

        {!offLookup && searchQuery.length >= 2 && (
          <div className="space-y-2">
            {isSharedCansError ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground font-mono">Couldn't load the can database</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => refetchSharedCans()}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
              </div>
            ) : filtered.length > 0 ? (
              filtered.slice(0, 10).map(can => (
                <button
                  key={can.id}
                  onClick={() => handleSelectCan(can)}
                  className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/30 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {can.image_url ? (
                      <img src={can.image_url} alt={can.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {can.name}
                      {can.verified && (
                        <span className="text-primary text-xs font-mono ml-1">✓</span>
                      )}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground">{can.brand}</p>
                  </div>
                  <RarityBadge rarity={can.cosensus_rarity || can.rarity || 'Common'} />
                </button>
              ))
            ) : (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground font-mono">No cans found for "{searchQuery}"</p>
                {/^\d{6,}$/.test(searchQuery) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => handleBarcodeLookup(searchQuery)}
                  >
                    <Search className="w-3.5 h-3.5" /> Look up on Open Food Facts
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => { setSelectedCan({ name: searchQuery }); setMode('add'); }}
                  >
                    + Add "{searchQuery}" as new can
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6">
        <BarcodeScanner onDetected={handleBarcodeLookup} />
      </div>

      <div className="flex items-center gap-3 px-5 mt-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">OR</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="px-5 mt-4">
        <Button
          variant="outline"
          className="w-full font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => { setSelectedCan(null); setMode('add'); }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Manually
        </Button>
      </div>
    </div>
  );
}
