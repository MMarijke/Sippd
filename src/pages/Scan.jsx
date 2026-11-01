import { useCallback, useEffect, useState, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { searchSharedCans } from '@/lib/sharedCans';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import RarityBadge from '@/components/shared/RarityBadge';
import { getConfidence, getDisplayRarity } from '@/lib/rarityConsensus';
import AddCanForm from '@/components/scan/AddCanForm';
import BarcodeScanner from '@/components/scan/BarcodeScanner';
import { toast } from 'sonner';
import { useLiveQuery } from 'dexie-react-hooks';
import { useOffline } from '@/lib/offline/OfflineProvider';
import { useOnline } from '@/hooks/useOnline';

// Heuristic only, not authoritative -- this just pre-selects
// AddCanForm.jsx's beverage type toggle, which stays fully editable either
// way (a user always confirms or corrects it before submitting). Tag
// strings match OFF's own `categories_tags` values (e.g. "en:sodas"),
// hence the substring check rather than an exact match.
const SOFT_DRINK_OFF_TAGS = ['sodas', 'colas', 'sparkling-waters', 'lemonades', 'carbonated-drinks', 'iced-teas'];
const ENERGY_DRINK_OFF_TAGS = ['energy-drinks'];

function guessBeverageType(categoriesTags = []) {
  if (categoriesTags.some(t => ENERGY_DRINK_OFF_TAGS.some(tag => t.includes(tag)))) return 'energy_drink';
  if (categoriesTags.some(t => SOFT_DRINK_OFF_TAGS.some(tag => t.includes(tag)))) return 'soft_drink';
  return null;
}

async function lookupOpenFoodFacts(barcode, signal) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, { signal });
  if (!res.ok) throw new Error(`Open Food Facts lookup failed (${res.status})`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  return {
    name:      p.product_name || '',
    brand:     p.brands       || '',
    image_url: p.image_front_url || '',
    barcode,
    beverage_type: guessBeverageType(p.categories_tags),
    _offSource: true,
  };
}

export default function Scan() {
  const navigate = useNavigate();
  const online = useOnline();
  const { db } = useOffline();
  const [mode, setMode] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCan, setSelectedCan] = useState(null);
  // Where a barcode lookup is: 'catalog' (our shared_cans), 'off' (Open
  // Food Facts), 'off-slow' (OFF taking a while: escalated copy plus a way
  // out, since a stalled fetch used to trap people in a spinner), or null.
  // A camera read shows this inside the camera frame; a typed barcode shows
  // it under the search box.
  const [lookup, setLookup] = useState(null);
  const [lookupFromCamera, setLookupFromCamera] = useState(false);
  const offLookup = lookup === 'off' || lookup === 'off-slow';
  const offLookupSlow = lookup === 'off-slow';
  const offLookupControllerRef = useRef(null);
  // True once the add form has been shown and closed, so returning to the
  // scanner moves focus to its title instead of dropping it on <body>.
  const [returning, setReturning] = useState(false);
  // "Scan Next" means scan the next can: the camera starts by itself
  // instead of making you tap "Tap to Scan" again for every can.
  const [autoStartCamera, setAutoStartCamera] = useState(false);

  // One polite live region for the whole flow, so a screen reader hears
  // what the camera and lookup are doing (a barcode read, the lookup, how
  // many results a search found). Cleared first so the same message twice
  // in a row is still announced.
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((text) => {
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(text));
  }, []);

  const openAddForm = (can) => {
    setSelectedCan(can);
    setMode('add');
  };
  const returnToScanner = ({ scanNext = false } = {}) => {
    setMode('search');
    setSelectedCan(null);
    setSearchQuery('');
    setReturning(true);
    setAutoStartCamera(scanNext);
  };

  // Search asks the server (src/lib/sharedCans.js) rather than filtering a
  // newest-500 copy of the catalog, which hid every older can from search.
  // Debounced so typing a name is one query, not one per keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const {
    data: searchResults = [],
    isFetching: isSearchFetching,
    isError: isSharedCansError,
    refetch: refetchSharedCans,
  } = useQuery({
    queryKey: ['shared-cans', 'search', debouncedQuery],
    queryFn: () => searchSharedCans(supabase, debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    placeholderData: keepPreviousData,
  });

  // Offline the server search is paused (no results, not fetching), which
  // would read as "No cans found" and invite adding a duplicate of a can
  // that exists. Search the cans saved on this device instead, and say so.
  const localResults = useLiveQuery(async () => {
    if (online || !db || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase();
    return db.catalog
      .filter((c) => [c.name, c.brand, c.flavour, c.barcode].some((v) => v && String(v).toLowerCase().includes(q)))
      .limit(10)
      .toArray();
  }, [online, db, debouncedQuery]) ?? [];

  useEffect(() => {
    if (isSharedCansError) toast.error('Could not load the can database');
  }, [isSharedCansError]);

  const handleBarcodeLookup = async (barcode, { fromCamera = false } = {}) => {
    announce(`Barcode ${barcode} read. Looking it up.`);
    setLookupFromCamera(fromCamera);
    setLookup('catalog');
    // Asked of the server, not the client list above: that list is only the
    // newest 500 catalog cans, so an older can's barcode used to look like a
    // miss and get routed to Open Food Facts as a brand-new can, and the
    // collector never saw its community rarity.
    const { data: match, error: matchError } = await supabase
      .from('shared_cans')
      .select('*')
      .eq('barcode', barcode)
      .limit(1)
      .maybeSingle();
    if (matchError) {
      // Treating a failed check as a miss would add an existing can to the
      // catalog a second time, so stop here instead.
      toast.error("Can't verify that barcode against the database right now — try again in a moment.");
      announce("Couldn't check that barcode. Try again in a moment.");
      setLookup(null);
      return;
    }
    if (match) {
      setLookup(null);
      openAddForm(match);
      return;
    }
    setLookup('off');
    const controller = new AbortController();
    controller.barcode = barcode; // stashed so a mid-flight cancel can still prefill the manual form
    offLookupControllerRef.current = controller;
    const slowTimer = setTimeout(() => setLookup('off-slow'), 5000);
    // Client-side ceiling in case the fetch itself never settles (the
    // browser's own connect/read timeouts can be far longer than a user
    // would ever wait) -- aborts with a distinguishable reason so the catch
    // block below can tell "timed out" apart from a user-initiated cancel.
    const hardTimeout = setTimeout(() => controller.abort('timeout'), 12000);
    try {
      const result = await lookupOpenFoodFacts(barcode, controller.signal);
      openAddForm(result || { barcode, _offMiss: true });
    } catch {
      if (controller.signal.aborted && controller.signal.reason === 'timeout') {
        toast.error("Open Food Facts didn't respond in time — try again or add the can manually.");
        announce("Open Food Facts didn't respond in time.");
      } else if (controller.signal.aborted) {
        // User tapped cancel — routes to manual entry below, nothing to report.
      } else {
        toast.error("Couldn't look up that barcode — check your connection and try again.");
        announce("Couldn't look up that barcode.");
      }
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(hardTimeout);
      offLookupControllerRef.current = null;
      setLookup(null);
    }
  };

  const cancelOffLookup = () => {
    const pendingBarcode = offLookupControllerRef.current?.barcode ?? null;
    offLookupControllerRef.current?.abort('user-cancelled');
    openAddForm({ barcode: pendingBarcode, _offMiss: true });
  };

  const filtered = debouncedQuery.length < 2 ? [] : online ? searchResults : localResults;
  // Results belong to what's in the box: typing has paused and the server
  // has answered. Until then "No cans found" would be a lie, and Enter
  // could open a can from the previous search.
  const searchSettled = debouncedQuery === searchQuery.trim() && (!online || !isSearchFetching);

  // Say how many results a search found once typing pauses, instead of on
  // every keystroke.
  const resultCount = filtered.length;
  useEffect(() => {
    if (searchQuery.length < 2 || isSharedCansError || !searchSettled) return;
    const timer = setTimeout(() => {
      announce(resultCount === 0 ? 'No cans found.' : `${Math.min(resultCount, 10)} ${resultCount === 1 ? 'can' : 'cans'} found.`);
    }, 700);
    return () => clearTimeout(timer);
  }, [searchQuery, resultCount, isSharedCansError, searchSettled, announce]);

  const handleSearchKeyDown = async (e) => {
    if (e.key !== 'Enter') return;
    const q = searchQuery.trim();
    if (!q) return;

    if (/^\d{6,}$/.test(q)) {
      await handleBarcodeLookup(q);
      return;
    }

    if (searchSettled && filtered.length === 1) openAddForm(filtered[0]);
  };

  const liveRegion = (
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  );

  if (mode === 'add') {
    return (
      <div>
        {liveRegion}
        {/* Focus moves to this title when the form opens, so keyboard and
            screen-reader users land at the top of the form instead of on
            <body> after the scanner or search results disappear. */}
        <PageHeader
          key="add-header"
          title={selectedCan?.id ? 'Confirm Pull' : 'New Can'}
          subtitle={selectedCan?.id ? 'Add to your vault' : 'Add a new can to the database'}
          focusTitle
        />
        <AddCanForm
          prefillData={selectedCan?.id ? selectedCan : (selectedCan?.barcode ? { barcode: selectedCan.barcode, ...selectedCan } : null)}
          onSuccess={(addedCan) => {
            setMode('search');
            setSelectedCan(null);
            setSearchQuery('');
            navigate('/collection', addedCan ? { state: { addedCan } } : undefined);
          }}
          // Stays on Scan instead of the usual navigate to /collection, and
          // starts the camera straight away: the common flow for anyone
          // logging several cans in one sitting.
          onScanNext={() => returnToScanner({ scanNext: true })}
          onCancel={() => returnToScanner()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {liveRegion}
      <PageHeader
        key="scan-header"
        title="Scan / Search"
        subtitle="Find a can or add a new one"
        focusTitle={returning}
        action={
          <Button
            size="sm"
            variant="outline"
            className="h-11 rounded-control font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => openAddForm(null)}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add
          </Button>
        }
      />

      <div className="px-5 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search cans by name, brand or barcode"
            placeholder="Name, brand, or barcode..."
            className="h-11 pl-9 bg-secondary border-border font-body"
          />
        </div>

        {offLookup && !lookupFromCamera && (
          // Not gated behind searchQuery.length — a camera-triggered scan
          // (the primary intended path) leaves the search box empty, and
          // this lookup still needs to show it's working either way.
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground font-mono text-center">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              {offLookupSlow ? 'Still checking Open Food Facts…' : 'Checking Open Food Facts...'}
            </div>
            {offLookupSlow && (
              <button
                type="button"
                onClick={cancelOffLookup}
                className="h-11 px-4 text-xs text-primary underline underline-offset-2"
              >
                Cancel and add manually instead
              </button>
            )}
          </div>
        )}

        {!offLookup && searchQuery.length >= 2 && (
          <div className="space-y-2">
            {!online && (
              <p className="text-xs font-mono text-muted-foreground">
                You're offline, so only cans saved on this device are searched.
              </p>
            )}
            {online && isSharedCansError ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground font-mono">Couldn't load the can database</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => refetchSharedCans()}
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Retry
                </Button>
              </div>
            ) : filtered.length > 0 ? (
              filtered.slice(0, 10).map(can => (
                <button
                  key={can.id}
                  onClick={() => openAddForm(can)}
                  className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/30 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {can.image_url ? (
                      <img src={can.image_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground/30" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {can.name}
                      {can.verified && (
                        <>
                          <span className="text-primary text-xs font-mono ml-1" aria-hidden="true">✓</span>
                          <span className="sr-only">, verified</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground truncate">{can.brand}</p>
                  </div>
                  {/* Was can.cosensus_rarity (a typo), so results never showed
                      the community rarity. Same rule as CanCard: unrated
                      cans read "? ? ?". */}
                  <RarityBadge rarity={getConfidence(can.total_votes) === 'unrated' ? '???' : getDisplayRarity(can)} />
                </button>
              ))
            ) : !searchSettled ? (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Searching…
              </p>
            ) : (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground font-mono">
                  {online ? `No cans found for "${searchQuery}"` : `No saved cans match "${searchQuery}". It may still be in the catalog: search again once you're online before adding it.`}
                </p>
                {/^\d{6,}$/.test(searchQuery) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => handleBarcodeLookup(searchQuery)}
                  >
                    <Search className="w-3.5 h-3.5" aria-hidden="true" /> Look up on Open Food Facts
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => openAddForm({ name: searchQuery })}
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
        <BarcodeScanner
          onDetected={code => handleBarcodeLookup(code, { fromCamera: true })}
          autoStart={autoStartCamera}
          onAnnounce={announce}
          lookup={lookupFromCamera ? lookup : null}
          onCancelLookup={cancelOffLookup}
        />
      </div>

      <div className="flex items-center gap-3 px-5 mt-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-2xs font-mono text-muted-foreground uppercase tracking-widest">OR</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="px-5 mt-4">
        <Button
          variant="outline"
          className="h-11 w-full font-mono text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => openAddForm(null)}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add Manually
        </Button>
      </div>
    </div>
  );
}
