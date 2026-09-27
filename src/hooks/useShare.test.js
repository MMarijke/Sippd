import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useShare } from './useShare';

// useShare() doesn't actually call any React hooks internally (no
// useState/useEffect/useContext) despite the `use` naming convention — it's
// just a plain object of async functions, so it's callable directly here
// with no rendering and no jsdom, matching this project's existing
// node-environment /lib test convention (vite.config.js).
//
// The environment is `node` (vite.config.js), so navigator/document don't
// exist by default — each test stubs only the specific methods the branch
// under test actually touches, then restores globals afterward so one
// test's stubs can't leak into the next.

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';

describe('useShare', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('copyLink', () => {
    it('uses navigator.clipboard when available and toasts the success message', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });

      const { copyLink } = useShare();
      await copyLink('https://sippd.app/u/123', 'Link copied!');

      expect(writeText).toHaveBeenCalledWith('https://sippd.app/u/123');
      expect(toast.success).toHaveBeenCalledWith('Link copied!');
    });

    it('defaults the success message when none is given', async () => {
      vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

      const { copyLink } = useShare();
      await copyLink('https://sippd.app/u/123');

      expect(toast.success).toHaveBeenCalledWith('Copied to clipboard!');
    });

    it('falls back to a hidden textarea + execCommand when the clipboard API rejects', async () => {
      vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) } });

      const textarea = { value: '', style: {}, focus: vi.fn(), select: vi.fn() };
      const createElement = vi.fn().mockReturnValue(textarea);
      const appendChild = vi.fn();
      const removeChild = vi.fn();
      const execCommand = vi.fn().mockReturnValue(true);
      vi.stubGlobal('document', { createElement, body: { appendChild, removeChild }, execCommand });

      const { copyLink } = useShare();
      await copyLink('fallback text', 'Copied via fallback');

      expect(createElement).toHaveBeenCalledWith('textarea');
      expect(textarea.value).toBe('fallback text');
      expect(appendChild).toHaveBeenCalledWith(textarea);
      expect(textarea.focus).toHaveBeenCalled();
      expect(textarea.select).toHaveBeenCalled();
      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(removeChild).toHaveBeenCalledWith(textarea);
      expect(toast.success).toHaveBeenCalledWith('Copied via fallback');
    });

    it('toasts an error with the raw text when both the clipboard API and the fallback fail', async () => {
      vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) } });
      vi.stubGlobal('document', {
        createElement: vi.fn().mockImplementation(() => { throw new Error('no DOM'); }),
      });

      const { copyLink } = useShare();
      await copyLink('the-link-text');

      expect(toast.error).toHaveBeenCalledWith('Could not copy link — copy it manually: the-link-text');
    });
  });

  describe('shareFile', () => {
    it('reports unsupported when the Web Share API is missing entirely', async () => {
      vi.stubGlobal('navigator', {});
      const { shareFile } = useShare();
      const result = await shareFile({ blob: new Blob(['x']), filename: 'a.png', title: 't' });
      expect(result).toEqual({ supported: false });
    });

    it('reports unsupported when canShare rejects this specific file', async () => {
      const share = vi.fn();
      vi.stubGlobal('navigator', { canShare: vi.fn().mockReturnValue(false), share });
      const { shareFile } = useShare();
      const result = await shareFile({ blob: new Blob(['x']), filename: 'a.png', title: 't' });
      expect(result).toEqual({ supported: false });
      expect(share).not.toHaveBeenCalled();
    });

    it('reports shared: true after a successful share', async () => {
      vi.stubGlobal('navigator', { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockResolvedValue(undefined) });
      const { shareFile } = useShare();
      const result = await shareFile({ blob: new Blob(['x']), filename: 'a.png', title: 't' });
      expect(result).toEqual({ supported: true, shared: true });
    });

    it('reports aborted: true when the user cancels the native share sheet', async () => {
      const abortError = new Error('cancelled');
      abortError.name = 'AbortError';
      vi.stubGlobal('navigator', { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockRejectedValue(abortError) });
      const { shareFile } = useShare();
      const result = await shareFile({ blob: new Blob(['x']), filename: 'a.png', title: 't' });
      expect(result).toEqual({ supported: true, shared: false, aborted: true });
    });

    it('reports the underlying error for a real (non-abort) share failure', async () => {
      const shareError = new Error('share failed');
      vi.stubGlobal('navigator', { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockRejectedValue(shareError) });
      const { shareFile } = useShare();
      const result = await shareFile({ blob: new Blob(['x']), filename: 'a.png', title: 't' });
      expect(result).toEqual({ supported: true, shared: false, error: shareError });
    });
  });

  describe('shareLink', () => {
    it('reports unsupported when the Web Share API is missing entirely', async () => {
      vi.stubGlobal('navigator', {});
      const { shareLink } = useShare();
      const result = await shareLink({ url: 'https://sippd.app/u/123', title: 't' });
      expect(result).toEqual({ supported: false });
    });

    it('reports unsupported when canShare rejects this url', async () => {
      vi.stubGlobal('navigator', { canShare: vi.fn().mockReturnValue(false), share: vi.fn() });
      const { shareLink } = useShare();
      const result = await shareLink({ url: 'https://sippd.app/u/123', title: 't' });
      expect(result).toEqual({ supported: false });
    });

    it('reports shared: true after a successful share', async () => {
      vi.stubGlobal('navigator', { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockResolvedValue(undefined) });
      const { shareLink } = useShare();
      const result = await shareLink({ url: 'https://sippd.app/u/123', title: 't' });
      expect(result).toEqual({ supported: true, shared: true });
    });

    it('reports aborted: true when the user cancels the native share sheet', async () => {
      const abortError = new Error('cancelled');
      abortError.name = 'AbortError';
      vi.stubGlobal('navigator', { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockRejectedValue(abortError) });
      const { shareLink } = useShare();
      const result = await shareLink({ url: 'https://sippd.app/u/123', title: 't' });
      expect(result).toEqual({ supported: true, shared: false, aborted: true });
    });
  });
});
