// Photos taken or picked for a can are compressed on the device before
// anything stores or uploads them: a phone camera's 4-12 MB JPEG becomes a
// ~150-400 KB image, which matters twice over offline (IndexedDB quota, and
// the upload that happens later on a possibly weak connection).

export const MAX_EDGE = 1600;
export const QUALITY = 0.82;

// Scales (width, height) to fit within maxEdge on the long side, never up.
export function fitWithin(width, height, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function encode(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Returns a compressed Blob (WebP where the browser can encode it, else
// JPEG). Falls back to the original file if the browser can't decode it,
// rather than losing the user's photo.
export async function compressImage(file, { maxEdge = MAX_EDGE, quality = QUALITY } = {}) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    let blob = await encode(canvas, 'image/webp', quality);
    // Safari before 17 can't encode WebP and silently returns a PNG.
    if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', quality);
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
