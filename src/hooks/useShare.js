import { toast } from 'sonner';

/**
 * Shared sharing logic for Sippd's share surfaces (Profile's link copy,
 * ShareCardModal's image share).
 */
export function useShare() {
  /**
   * Always copy to the clipboard and confirm it — for actions where a
   * predictable "copied" outcome matters more than routing through
   * whatever the OS share sheet happens to offer (which varies by
   * platform and doesn't always even have a copy option, so the user
   * can't tell whether anything happened).
   */
  const copyLink = async (text, successMessage = 'Copied to clipboard!') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      // Fallback for browsers that block clipboard API
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success(successMessage);
      } catch {
        toast.error('Could not copy link — copy it manually: ' + text);
      }
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

  return { copyLink, shareFile };
}
