import { useState } from 'react';
import { ScanLine, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BarcodeScanner() {
  const [showWebFallback, setShowWebFallback] = useState(false);

  const callbackUrl = `${window.location.origin}/scan?barcode={CODE}`;
  const scanAppUrl = `https://scanapp.org/?callback=${encodeURIComponent(callbackUrl)}`;

  const handleScan = () => {
    window.location = 'googlechrome://navigate?url=https://lens.google.com/scan';
    setTimeout(() => {
      window.location = 'bixbyvision://barcode';
      setTimeout(() => setShowWebFallback(true), 1200);
    }, 1200);
  };

  return (
    <div className="px-5 space-y-3">
      <button
        onClick={handleScan}
        className="w-full bg-card border border-primary/20 rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.98]"
      >
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-xl bg-primary/10 flex items-center justify-center">
            <ScanLine className="w-11 h-11 text-primary" />
          </div>
          {[
            'top-0 left-0 border-t-2 border-l-2',
            'top-0 right-0 border-t-2 border-r-2',
            'bottom-0 left-0 border-b-2 border-l-2',
            'bottom-0 right-0 border-b-2 border-r-2',
          ].map((cls, i) => (
            <div key={i} className={`absolute w-5 h-5 border-primary/60 ${cls}`} style={{ borderRadius: 1 }} />
          ))}
        </div>

        <div className="text-center">
          <p className="text-base font-display font-bold text-foreground tracking-wide">Tap to Scan</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">Opens Google Lens or Bixby Vision</p>
        </div>

        <div className="px-5 py-2 rounded-full bg-primary/10 border border-primary/20">
          <span className="text-sm font-mono text-primary font-semibold">Start Scanning</span>
        </div>

        <p className="text-[10px] font-mono text-muted-foreground/60 text-center leading-relaxed">
          After scanning, copy the barcode number and tap "Paste Barcode" below
        </p>
      </button>

      {showWebFallback && (
        <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3">
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            <span className="text-foreground font-semibold">Built-in scanner not available.</span>{' '}
            Open the web scanner — it will return you here automatically after scanning.
          </p>
          <a
            href={scanAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-xs font-mono text-primary font-semibold hover:bg-primary/20 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Web Barcode Scanner
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="w-full font-mono text-xs text-muted-foreground"
            onClick={() => setShowWebFallback(false)}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}