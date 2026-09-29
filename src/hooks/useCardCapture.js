import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useShare } from '@/hooks/useShare';

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Used by RecapShareModal (MonthlyReport's own share flow — see that
// component's doc comment for why this pipeline is scoped to Monthly
// Report only, not shared with Profile): html2canvas capture of
// `cardRef`, regenerated whenever `signature` changes, plus download and
// OS-share-sheet handoff for the generated image. Generic on purpose —
// nothing here assumes a recap card's shape, just a ref and a change
// signal — so it stays in shared hooks rather than moving into
// components/monthly-report alongside the card itself.
export function useCardCapture(cardRef, signature) {
  const [generating, setGenerating] = useState(false);
  const [cardDataUrl, setCardDataUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const { shareFile } = useShare();

  const generateCard = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    setCardDataUrl(null);
    try {
      // The capture needs an explicit fallback fill for any transparent
      // area (html2canvas can't just "use the page background" the way a
      // browser paint would) — reading the live --background token keeps
      // that fill matching the viewer's actual active theme instead of
      // always rendering the default theme's near-black behind the card.
      const bgHsl = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
      // Loaded on first capture, not at module scope -- only this share
      // flow uses it, and it's too heavy to ride along in MonthlyReport's
      // chunk for everyone who opens the report but never shares.
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: bgHsl ? `hsl(${bgHsl})` : '#080C14',
        logging: false,
      });
      setCardDataUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      toast.error('Failed to generate card');
    }
    setGenerating(false);
  };

  useEffect(() => {
    const t = setTimeout(generateCard, 300);
    return () => clearTimeout(t);
  }, [signature]);

  const handleSave = async (filename) => {
    if (!cardDataUrl) return;
    setSaving(true);
    try {
      const blob = dataUrlToBlob(cardDataUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Saved!');
    } catch (e) {
      toast.error('Failed to save');
    }
    setSaving(false);
  };

  const handleShareImage = async (filename, title) => {
    if (!cardDataUrl) return;
    setSaving(true);
    try {
      const blob = dataUrlToBlob(cardDataUrl);
      const result = await shareFile({ blob, filename, title });
      if (result.supported) {
        if (result.error) toast.error('Could not share image');
        setSaving(false);
        return;
      }

      // No share sheet available (typically desktop) — just download it.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image saved! Share it wherever you'd like.", { duration: 4000 });
    } catch (e) {
      toast.error('Could not share image');
    }
    setSaving(false);
  };

  return { generating, cardDataUrl, saving, generateCard, handleSave, handleShareImage };
}
