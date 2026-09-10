import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import CanImageBox from '@/components/shared/CanImageBox';

// The common-case counterpart to RarityReveal — Rare+ pulls get the full
// celebratory takeover, but that leaves every ordinary Common/Uncommon add
// (the statistical majority of real usage) with no acknowledgment at all
// before the page navigates away. This is deliberately smaller/faster: real
// feedback for the habit-forming everyday case, without diluting what makes
// a rare pull feel special.
export default function AddedConfirmation({ canName, imageUrl, bgColor, onComplete }) {
  const autoDismissRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    autoDismissRef.current = setTimeout(onComplete, 1100);
    return () => clearTimeout(autoDismissRef.current);
  }, [onComplete]);

  const handleTap = () => {
    clearTimeout(autoDismissRef.current);
    onComplete();
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
        initial={reducedMotion ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="relative mb-4">
          <CanImageBox
            imageUrl={imageUrl}
            bgColor={bgColor}
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
      </motion.div>
    </motion.div>
  );
}
