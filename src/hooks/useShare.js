import { toast } from 'sonner';

/**
 * Shared sharing logic for Sippd's share surfaces (Profile's link share,
 * MonthlyReport's recap share, ShareCardModal's image share) — previously
 * each hand-rolled its own Web Share/clipboard logic and had silently
 * drifted in error handling (e.g. one caught AbortError and the other
 * didn't, one confirmed the clipboard write before toasting and the
 * other didn't).
 */
export function useShare() {
  /**
   * Share a link or plain text via the Web Share API, falling back to
   * copying to the clipboard. Copies `url` when given (a link is more
   * useful on the clipboard than accompanying text), otherwise `text`.
   */
  const shareText = async ({ title, text, url, successMessage = 'Copied to clipboard!' }) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
        // any other share failure falls through to the clipboard fallback
      }
    }
    try {
      await navigator.clipboard.writeText(url || text);
      toast.success(successMessage);
    } catch {
      toast.error('Could not share');
    }
  };

  /**
   * Attempt to share a file via the Web Share API. Returns whether the
   * API was usable here at all — callers own their own fallback (e.g.
   * download + open a specific app) since that's surface-specific.
   */
  const shareFile = async ({ blob, filename, title }) => {
    if (!(navigator.canShare && navigator.share)) return { supported: false };
    const file = new File([blob], filename, { type: blob.type });
    if (!navigator.canShare({ files: [file] })) return { supported: false };
    try {
      await navigator.share({ files: [file], title });
      return { supported: true, shared: true };
    } catch (e) {
      if (e.name === 'AbortError') return { supported: true, shared: false, aborted: true };
      return { supported: true, shared: false, error: e };
    }
  };

  return { shareText, shareFile };
}
