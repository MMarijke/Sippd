import { motion } from 'framer-motion';
import { Check, ScanLine } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import CanImageBox from '@/components/shared/CanImageBox';

// The common-case counterpart to RarityReveal — Rare+ pulls get the full
// celebratory takeover, but that leaves every ordinary Common/Uncommon add
// (the statistical majority of real usage) with no acknowledgment at all
// before the page navigates away. This is deliberately smaller/faster: real
// feedback for the habit-forming everyday case, without diluting what makes
// a rare pull feel special.
export default function AddedConfirmation({ canName, imageUrl, rarity, onComplete, onScanNext }) {
  const reducedMotion = usePrefersReducedMotion();

  // Used to auto-dismiss (defaulting to "View Collection") after 1.1s with
  // no fade-in cushion on the action buttons at all — proportionally worse
  // than RarityReveal's own version of this problem. Removed for the same
  // reason: tap-anywhere-to-dismiss already exists, so a forced timer only
  // ever works against whichever choice the user hadn't made yet, most
  // often "Scan Next" on a page whose stated common case is logging
  // several cans back-to-back. (/impeccable critique)
  const handleTap = () => {
    onComplete();
  };

  const handleScanNext = (e) => {
    e.stopPropagation();
    onScanNext();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer select-none bg-background/95 backdrop-blur-sm px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      onClick={handleTap}
    >
      <motion.div
        className="flex flex-col items-center text-center"
        role="status"
        aria-live="polite"
        initial={reducedMotion ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="relative mb-4">
          <CanImageBox
            imageUrl={imageUrl}
            rarity={rarity}
            alt={canName}
            className="w-20 h-20 rounded-2xl border border-border"
            iconSize="w-8 h-8"
          />
          <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-background">
            <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground max-w-[220px] truncate">{canName}</p>
        <p className="text-xs font-mono uppercase tracking-widest text-primary/70 mt-1">Added to your vault</p>

        <div className="flex items-center gap-2 mt-5" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleScanNext}
            className="h-11 px-4 rounded-full border border-primary/30 text-primary text-xs font-mono font-semibold flex items-center gap-1.5 hover:bg-primary/10 transition-colors"
          >
            <ScanLine className="w-3.5 h-3.5" /> Scan Next
          </button>
          <button
            type="button"
            onClick={handleTap}
            className="h-11 px-4 rounded-full bg-primary text-primary-foreground text-xs font-mono font-semibold hover:bg-primary/90 transition-colors"
          >
            View Collection
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
