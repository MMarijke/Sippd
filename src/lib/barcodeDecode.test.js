import { describe, expect, it } from 'vitest';
import { pickNativeFormats, getNativeDetector, detectNative, downscaleToCanvas } from './barcodeDecode';

describe('pickNativeFormats', () => {
  it('asks only for supported can formats', () => {
    expect(pickNativeFormats(['qr_code', 'ean_13', 'upc_a', 'code_128'])).toEqual(['ean_13', 'upc_a', 'code_128']);
  });

  it('declines a reader that cannot read can barcodes', () => {
    expect(pickNativeFormats(['qr_code', 'code_128'])).toBeNull();
    expect(pickNativeFormats([])).toBeNull();
  });
});

describe('getNativeDetector', () => {
  it('is null without a BarcodeDetector', async () => {
    expect(await getNativeDetector({})).toBeNull();
  });

  it('builds one with the usable formats', async () => {
    class FakeDetector {
      static async getSupportedFormats() { return ['ean_13', 'qr_code']; }
      constructor(opts) { this.opts = opts; }
    }
    const d = await getNativeDetector({ BarcodeDetector: FakeDetector });
    expect(d.opts).toEqual({ formats: ['ean_13'] });
  });

  it('is null when the format query fails', async () => {
    class Broken { static async getSupportedFormats() { throw new Error('nope'); } }
    expect(await getNativeDetector({ BarcodeDetector: Broken })).toBeNull();
  });
});

describe('detectNative', () => {
  it('returns the first value, or null on nothing or an error', async () => {
    expect(await detectNative({ detect: async () => [{ rawValue: '' }, { rawValue: '123' }] }, {})).toBe('123');
    expect(await detectNative({ detect: async () => [] }, {})).toBeNull();
    expect(await detectNative({ detect: async () => { throw new Error('no frame'); } }, {})).toBeNull();
  });
});

describe('downscaleToCanvas', () => {
  const doc = { createElement: () => ({ getContext: () => ({ drawImage() {} }) }) };
  it('caps the long side and keeps the aspect ratio', () => {
    const c = downscaleToCanvas({ width: 4000, height: 3000 }, 1600, doc);
    expect([c.width, c.height]).toEqual([1600, 1200]);
  });
  it('never upscales', () => {
    const c = downscaleToCanvas({ width: 800, height: 600 }, 1600, doc);
    expect([c.width, c.height]).toEqual([800, 600]);
  });
});
