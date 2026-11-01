import { describe, expect, it } from 'vitest';
import { DISMISS_DAYS, dismissedRecently, installPromptKind, isIosSafari } from './installPrompt';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

const base = { isStandalone: false, isNative: false, hasDeferredPrompt: false, userAgent: ANDROID_CHROME, maxTouchPoints: 5, dismissedAt: null, now: 1_000_000_000_000 };

describe('isIosSafari', () => {
  it('detects iPhone Safari', () => expect(isIosSafari(IPHONE_SAFARI)).toBe(true));
  it('excludes Chrome on iOS, which cannot add to home screen the same way', () => expect(isIosSafari(IPHONE_CHROME)).toBe(false));
  it('detects iPadOS Safari reporting a Mac user agent', () => expect(isIosSafari(IPAD_DESKTOP_MODE, 5)).toBe(true));
  it('does not mistake a real Mac for an iPad', () => expect(isIosSafari(IPAD_DESKTOP_MODE, 0)).toBe(false));
  it('is false on Android', () => expect(isIosSafari(ANDROID_CHROME)).toBe(false));
});

describe('installPromptKind', () => {
  it("offers the browser's own install dialog when it fired beforeinstallprompt", () => {
    expect(installPromptKind({ ...base, hasDeferredPrompt: true })).toBe('native');
  });

  it('explains Add to Home Screen on iOS Safari', () => {
    expect(installPromptKind({ ...base, userAgent: IPHONE_SAFARI })).toBe('ios');
  });

  it('shows nothing once installed, inside the Capacitor app, or where install is impossible', () => {
    expect(installPromptKind({ ...base, hasDeferredPrompt: true, isStandalone: true })).toBeNull();
    expect(installPromptKind({ ...base, hasDeferredPrompt: true, isNative: true })).toBeNull();
    expect(installPromptKind(base)).toBeNull();
  });

  it(`stays quiet for ${DISMISS_DAYS} days after a dismissal, then asks again`, () => {
    const day = 24 * 60 * 60 * 1000;
    expect(installPromptKind({ ...base, hasDeferredPrompt: true, dismissedAt: base.now - day })).toBeNull();
    expect(installPromptKind({ ...base, hasDeferredPrompt: true, dismissedAt: base.now - (DISMISS_DAYS + 1) * day })).toBe('native');
  });

  it('ignores a corrupt dismissal value', () => {
    expect(dismissedRecently('not-a-number', base.now)).toBe(false);
  });
});
