import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, Download, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCardCapture } from '@/hooks/useCardCapture';

// Generic full-screen share flow: owns the modal chrome, the capture
// lifecycle, and the resulting image preview + Save/Share/Regenerate
// actions. Knows nothing about what's being shared — the card itself is
// passed in as `children` and rendered hidden/off-screen purely as the
// html2canvas capture source, never shown to the user directly. This is
// what makes it safe to reuse for any card shape (Profile's Top Pulls,
// MonthlyReport's recap, anything future) without repeating the modal
// chrome, and — more importantly — without repeating the bug class this
// replaces: a *visible* live card doubling as the capture source, where
// any of its own interactive icons could get baked into the exported
// image as a dead pixel.
export default function ShareCardModal({ title, onClose, cardSignature, filename, shareTitle, children }) {
  const cardRef = useRef(null);
  const { generating, cardDataUrl, saving, generateCard, handleSave, handleShareImage } = useCardCapture(cardRef, cardSignature);

  // Hardware back button (Android)
  useEffect(() => {
    window.history.pushState({ shareCard: true }, '');
    const handlePopState = (e) => {
      if (e.state?.shareCard) onClose();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Escape to close (keyboard-only users have two close buttons — Back and
  // X — both wired to the same onClose; this is the third, keyboard path).
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const content = (
    <div role="dialog" aria-modal="true" aria-labelledby="share-card-title" className="fixed inset-0 z-[100] flex flex-col bg-background overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
        <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-mono">Back</span>
        </Button>
        <h2 id="share-card-title" className="text-sm font-display font-bold text-foreground tracking-wide">{title}</h2>
        <Button size="icon" variant="ghost" className="w-11 h-11 text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Close">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 py-6 gap-5">
        {/* The capture source — permanently off-screen, never the thing the
            user looks at or interacts with. */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }} aria-hidden="true">
          <div ref={cardRef}>{children}</div>
        </div>

        {generating && (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs font-mono text-muted-foreground">Generating card…</p>
          </div>
        )}

        {cardDataUrl && !generating && (
          <div className="w-full max-w-[360px]">
            <img src={cardDataUrl} alt="Share card" className="w-full rounded-2xl border border-border" />
            {/* The Save button below is the primary path — it fails silently
                on iOS Safari, though, which doesn't reliably honor a
                synthetic <a download> click (see useCardCapture's
                handleSave). Long-press is the one save path that always
                works there, so it's called out as the iPhone-specific
                alternative rather than a second competing instruction. */}
            <p className="text-[10px] font-mono text-muted-foreground text-center mt-2">On iPhone, you can also long-press the image to save it</p>
          </div>
        )}

        <Button
          className="w-full max-w-[360px] font-mono text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => handleSave(filename)}
          disabled={!cardDataUrl || generating || saving}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>

        <Button
          variant="outline"
          className="w-full max-w-[360px] font-mono text-xs gap-2 border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => handleShareImage(filename, shareTitle)}
          disabled={!cardDataUrl || generating || saving}
        >
          <Share2 className="w-4 h-4" />
          Share Image
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-xs text-muted-foreground gap-2"
          onClick={generateCard}
          disabled={generating}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '↻'} Regenerate
        </Button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
