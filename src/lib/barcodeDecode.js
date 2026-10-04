// The device's own barcode reader (the Shape Detection API's
// BarcodeDetector), used in preference to the bundled zxing reader where the
// browser has it: Chrome on Android, Samsung Internet, ChromeOS and macOS
// Chrome, which hand off to the OS's scanning engine and cope far better
// with curved, glossy cans. iPhone Safari, Firefox and Windows desktop
// browsers don't have it and keep zxing.
export const WANTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

// The formats to ask for, or null when the native reader can't do the one
// that matters (drink cans are EAN-13 / UPC-A).
export function pickNativeFormats(supported) {
  const use = WANTED_FORMATS.filter(f => supported.includes(f));
  return use.includes('ean_13') || use.includes('upc_a') ? use : null;
}

let detectorPromise = null;

// A shared BarcodeDetector, or null when the browser has none (or none that
// reads can barcodes). Asked once per page load.
export function getNativeDetector(scope = globalThis) {
  if (scope !== globalThis) return createDetector(scope); // tests
  detectorPromise ??= createDetector(scope);
  return detectorPromise;
}

async function createDetector(scope) {
  const Detector = scope.BarcodeDetector;
  if (typeof Detector !== 'function') return null;
  try {
    const formats = pickNativeFormats(await Detector.getSupportedFormats());
    return formats ? new Detector({ formats }) : null;
  } catch {
    return null;
  }
}

// First barcode value the detector finds in `source`, or null.
export async function detectNative(detector, source) {
  try {
    const found = await detector.detect(source);
    return found.find(b => b.rawValue)?.rawValue ?? null;
  } catch {
    // Throws while a video has no frame yet; treat as "nothing yet".
    return null;
  }
}

// Phone photos are 12MP+; decoding one full size is slow and no more
// accurate. Draws the image into a canvas no larger than `max` on its long
// side.
export function downscaleToCanvas(image, max = 1600, doc = document) {
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = doc.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
