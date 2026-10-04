import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { motion } from 'framer-motion';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import { ScanLine, X, CameraOff, Check, Loader2, Camera } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { CAMERA_ERRORS, cameraErrorKind, cameraSupported } from '@/lib/cameraErrors';
import { getNativeDetector, detectNative, downscaleToCanvas } from '@/lib/barcodeDecode';

const HINTS = new Map();
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
]);
// Tested on a real webcam frame of a can (barcode 6009907414877): without
// TRY_HARDER the reader gave up on it; with it, it decoded. Cans are curved
// and a held-close can is slightly soft, which is exactly where the default
// pass is too strict.
HINTS.set(DecodeHintType.TRY_HARDER, true);

// A sharper picture than the browser default (often 640x480): ideal sizes
// and continuous focus are requests, not requirements, so a camera that
// can't do them still opens.
const VIDEO_CONSTRAINTS = {
  facingMode: 'environment',
  width: { ideal: 1280 },
  height: { ideal: 720 },
  advanced: [{ focusMode: 'continuous' }],
};

// Exponential ease-out: the "found it" motion lands fast and settles.
const EASE_OUT = [0.16, 1, 0.3, 1];

const CORNERS = [
  'top-0 left-0 border-t-2 border-l-2',
  'top-0 right-0 border-t-2 border-r-2',
  'bottom-0 left-0 border-b-2 border-l-2',
  'bottom-0 right-0 border-b-2 border-r-2',
];

const LOOKUP_TEXT = {
  catalog: 'Checking the Sippd catalog…',
  off: 'Checking Open Food Facts…',
  'off-slow': 'Still checking Open Food Facts…',
};

// The last video frame as an image, so the "found it" state can hold the
// can in view after the camera stops (a stopped stream goes black).
function captureFrame(video) {
  try {
    if (!video?.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

// autoStart: start the camera on mount (Scan passes it after "Scan Next").
// The camera also starts by itself whenever this site already has camera
// permission, so only a first-ever visit needs "Tap to Scan". Browsers that
// can't report the permission (Firefox) fall back to the tap.
// onAnnounce: tells the page's live region what the camera is doing.
// lookup: what the page is doing with a detected barcode ('catalog', 'off',
// 'off-slow' or null), shown inside the frame; onCancelLookup: the way out
// of a slow Open Food Facts lookup.
export default function BarcodeScanner({ onDetected, autoStart = false, onAnnounce, lookup = null, onCancelLookup }) {
  // idle | starting | scanning | found | error
  const [status, setStatus] = useState(() => (cameraSupported() ? 'idle' : 'error'));
  const [errorKind, setErrorKind] = useState(() => (cameraSupported() ? null : 'unsupported'));
  const [slowStart, setSlowStart] = useState(false);
  const [found, setFound] = useState(null); // { code, frame }
  const [photoError, setPhotoError] = useState(false);
  const photoInputRef = useRef(null);
  const photoButtonRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const detectedRef = useRef(false);
  const mountedRef = useRef(true);
  const tapRef = useRef(null);
  const foundRef = useRef(null);

  // decodeFromConstraints has no built-in timeout — on some Android/WebView
  // permission-prompt edge cases getUserMedia never settles. This only
  // changes what the waiting screen says; the X stays the way out.
  useEffect(() => {
    if (status !== 'starting') {
      setSlowStart(false);
      return;
    }
    const timer = setTimeout(() => setSlowStart(true), 8000);
    return () => clearTimeout(timer);
  }, [status]);

  const stopScanning = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanning();
    };
  }, []);

  const fail = (err) => {
    setStatus('error');
    setErrorKind(cameraErrorKind(err));
  };

  // The "found it" moment, shared by the device's reader, zxing and photos:
  // hold the frame, a short buzz, then the lookup plays out in the same
  // place the can was scanned. It used to snap straight back to "Tap to
  // Scan" with the progress shown up in the search area.
  const handleDetected = (code, frame) => {
    if (detectedRef.current) return;
    detectedRef.current = true;
    setFound({ code, frame: frame ?? captureFrame(videoRef.current) });
    navigator.vibrate?.(40);
    stopScanning();
    setStatus('found');
    onDetected(code);
  };

  // Live scanning with the device's own reader: poll the visible video a
  // few times a second. Returns zxing-style controls so stopScanning works
  // the same for both.
  const startNative = async (detector) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoplay attribute covers it */ }
    }
    let stopped = false;
    let timer = null;
    const tick = async () => {
      if (stopped) return;
      const code = video ? await detectNative(detector, video) : null;
      if (stopped) return;
      if (code) {
        handleDetected(code);
        return;
      }
      timer = setTimeout(tick, 150);
    };
    tick();
    return {
      stop() {
        stopped = true;
        clearTimeout(timer);
        stream.getTracks().forEach(t => t.stop());
      },
    };
  };

  const startScanning = async () => {
    if (!cameraSupported()) {
      setStatus('error');
      setErrorKind('unsupported');
      return;
    }

    // flushSync so the <video> below is in the DOM before the reader is
    // given videoRef.current. Without it the ref was still null here (the
    // idle card has no video), and zxing then decodes into a detached video
    // it creates itself, so the on-screen preview never got the stream and
    // the "found" state had no frame to hold.
    flushSync(() => {
      setStatus('starting');
      setErrorKind(null);
      setFound(null);
    });
    detectedRef.current = false;
    setPhotoError(false);

    try {
      // The device's own reader where the browser has one (Android Chrome,
      // Samsung Internet, macOS/ChromeOS Chrome); zxing everywhere else.
      const detector = await getNativeDetector();
      let controls;
      if (detector) {
        controls = await startNative(detector);
      } else {
        readerRef.current ??= new BrowserMultiFormatReader(HINTS);
        controls = await readerRef.current.decodeFromConstraints(
          { video: VIDEO_CONSTRAINTS },
          videoRef.current,
          (result, err) => {
            if (!mountedRef.current) return;
            if (result) {
              handleDetected(result.getText());
              return;
            }
            // NotFoundException fires on every frame with no barcode in view —
            // that's the normal, silent case while the camera is live.
            if (err && !(err instanceof NotFoundException)) fail(err);
          }
        );
      }

      // The component may have unmounted while the permission prompt/stream
      // setup above was pending — don't leave the camera running behind it.
      if (!mountedRef.current) {
        controls.stop();
        return;
      }
      // A read can land before the controls are stored here, when
      // handleDetected's stopScanning had nothing to stop yet.
      if (detectedRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setStatus('scanning');
    } catch (err) {
      if (!mountedRef.current) return;
      fail(err);
    }
  };

  // Once per mount. startScanning is recreated every render and only needs
  // to run the first time, so it is read through a ref.
  const startRef = useRef(startScanning);
  startRef.current = startScanning;
  useEffect(() => {
    let cancelled = false;
    const begin = () => { if (!cancelled && mountedRef.current) startRef.current(); };
    if (!cameraSupported()) return;
    if (autoStart) {
      // A tick later, outside the effect, so startScanning's flushSync can
      // render the video element.
      const timer = setTimeout(begin, 0);
      return () => { cancelled = true; clearTimeout(timer); };
    } else {
      navigator.permissions?.query({ name: 'camera' })
        .then(result => { if (result.state === 'granted') begin(); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [autoStart]);

  // Spoken camera states. Errors also render as role="alert" below.
  useEffect(() => {
    if (status === 'starting') onAnnounce?.('Starting camera.');
    if (status === 'scanning') onAnnounce?.('Camera on. Point it at the barcode.');
    if (status === 'photo') onAnnounce?.('Reading the photo.');
  }, [status, onAnnounce]);

  // The found state holds until the page moves on. If the lookup ends and
  // we're still here (it failed, or found nothing to open), go back to the
  // tap card, with focus on it. A lookup that never starts can't strand it.
  const sawLookupRef = useRef(false);
  useEffect(() => {
    if (status !== 'found') {
      sawLookupRef.current = false;
      return;
    }
    foundRef.current?.focus();
    if (lookup) {
      sawLookupRef.current = true;
      return;
    }
    const reset = () => {
      // A photo read on a camera-less device goes back to its notice, not
      // to a Tap to Scan card that can't work there.
      setStatus(cameraSupported() ? 'idle' : 'error');
      setFound(null);
      requestAnimationFrame(() => (tapRef.current ?? photoButtonRef.current)?.focus());
    };
    if (sawLookupRef.current) {
      reset();
      return;
    }
    const timer = setTimeout(reset, 4000);
    return () => clearTimeout(timer);
  }, [status, lookup]);

  // "Take a photo instead": the phone's own camera app (real autofocus,
  // flash, zoom; no live-camera permission needed), then read the barcode
  // from the photo. The device's reader first where there is one, zxing
  // (which also tries the photo rotated) otherwise.
  const openPhotoPicker = () => photoInputRef.current?.click();
  const readPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // so the same photo can be picked again
    if (!file) return;
    stopScanning();
    setPhotoError(false);
    setStatus('photo');
    detectedRef.current = false;
    let code = null;
    let frame = null;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = downscaleToCanvas(bitmap);
      bitmap.close?.();
      frame = canvas.toDataURL('image/jpeg', 0.7);
      const detector = await getNativeDetector();
      if (detector) code = await detectNative(detector, canvas);
      if (!code) {
        readerRef.current ??= new BrowserMultiFormatReader(HINTS);
        try { code = readerRef.current.decodeFromCanvas(canvas).getText(); } catch { /* none found */ }
      }
    } catch {
      code = null; // unreadable file
    }
    if (!mountedRef.current) return;
    if (code) {
      handleDetected(code, frame);
      return;
    }
    setStatus(cameraSupported() ? 'idle' : 'error');
    setPhotoError(true);
    requestAnimationFrame(() => photoButtonRef.current?.focus());
  };

  // The X that had focus disappears with the camera view, so hand focus to
  // the Tap to Scan button that replaces it.
  const cancelScanning = () => {
    stopScanning();
    setStatus('idle');
    requestAnimationFrame(() => tapRef.current?.focus());
  };

  // capture="environment" opens the phone's rear camera app; desktops ignore
  // it and show a file picker, which still reads a saved photo.
  const photoInput = (
    <input
      ref={photoInputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={readPhoto}
    />
  );
  const photoOption = (label = 'Take a photo instead') => (
    <>
      {photoInput}
      <button
        ref={photoButtonRef}
        type="button"
        onClick={openPhotoPicker}
        className="w-full h-11 rounded-xl border border-border bg-transparent text-xs font-mono text-foreground flex items-center justify-center gap-2 hover:border-primary/40 transition-colors"
      >
        <Camera className="w-4 h-4" aria-hidden="true" /> {label}
      </button>
      {photoError && (
        <p role="alert" className="text-xs font-mono text-foreground/80 leading-relaxed text-center">
          No barcode found in that photo. Try again with the barcode flat, in focus and filling more of the picture.
        </p>
      )}
    </>
  );

  if (status === 'photo') {
    return (
      <div className="px-5">
        <div className="w-full bg-card border border-primary/20 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-sm font-display font-bold text-foreground tracking-wide">Reading the photo…</p>
        </div>
      </div>
    );
  }

  if (status === 'found') {
    return (
      <div className="px-5">
        <div
          ref={foundRef}
          tabIndex={-1}
          aria-label={`Barcode ${found?.code ?? ''} found`}
          className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black border border-primary/40 focus:outline-none"
        >
          {found?.frame && <img src={found.frame} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/60" />

          {/* The brackets close in on the barcode: the one moment of motion. */}
          <motion.div
            className="absolute inset-8 pointer-events-none"
            initial={reducedMotion ? false : { scale: 1 }}
            animate={{ scale: 0.84 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.45, ease: EASE_OUT }}
          >
            {CORNERS.map((cls, i) => (
              <div key={i} className={`absolute w-6 h-6 border-primary ${cls}`} style={{ borderRadius: 1 }} />
            ))}
          </motion.div>

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <motion.div
              className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-[0_6px_24px_-6px_hsl(var(--primary)/0.7)]"
              initial={reducedMotion ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: EASE_OUT, delay: 0.08 }}
            >
              <Check className="w-7 h-7 text-primary-foreground" strokeWidth={3} aria-hidden="true" />
            </motion.div>
            <div>
              <p className="text-sm font-display font-bold text-white tracking-wide">Got it</p>
              <p className="text-xs font-mono text-white/80 tabular-nums mt-0.5">{found?.code}</p>
            </div>
            {lookup && (
              <div className="flex flex-col items-center gap-1">
                <p className="flex items-center gap-1.5 text-xs font-mono text-white/85">
                  <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  {LOOKUP_TEXT[lookup]}
                </p>
                {lookup === 'off-slow' && onCancelLookup && (
                  <button
                    type="button"
                    onClick={onCancelLookup}
                    className="h-11 px-4 text-xs font-mono text-white underline underline-offset-2"
                  >
                    Add it manually instead
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'scanning' || status === 'starting') {
    return (
      <div className="px-5">
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black border border-primary/20">
          <video ref={videoRef} muted playsInline autoPlay className="w-full h-full object-cover" />

          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-8">
              {/* White, not text-muted-foreground: this overlay is always black, and
                  the muted token is dark grey on light themes. */}
              <p className="text-xs font-mono text-white/85 text-center leading-relaxed">
                {slowStart
                  ? 'Still waiting on your camera — tap the X to cancel and search above instead.'
                  : 'Starting camera…'}
              </p>
            </div>
          )}

          {status === 'scanning' && (
            <>
              <div className="absolute inset-8 pointer-events-none">
                {CORNERS.map((cls, i) => (
                  <div key={i} className={`absolute w-6 h-6 border-primary ${cls}`} style={{ borderRadius: 1 }} />
                ))}
                <div className="absolute left-0 right-0 h-0.5 bg-primary neon-glow animate-shimmer" style={{ top: '50%' }} />
              </div>
              <p className="absolute bottom-3 left-0 right-0 text-center text-xs font-mono text-white/85">
                Point the camera at the barcode
              </p>
            </>
          )}

          <button
            type="button"
            onClick={cancelScanning}
            aria-label="Cancel scanning"
            className="absolute top-3 right-3 w-11 h-11 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {/* For when the live view won't read: a webcam that can't focus
            close, glare on the can, or a slow phone. */}
        <div className="mt-3 space-y-2">{photoOption('Not reading? Take a photo instead')}</div>
      </div>
    );
  }

  const error = status === 'error' ? CAMERA_ERRORS[errorKind] ?? CAMERA_ERRORS.other : null;

  // No camera, or a browser that can't use one: a big "Try Again" card
  // would only fail again, so say so plainly. A photo still works here (the
  // phone's camera app, or a saved picture), so it leads.
  if (error && !error.canRetry) {
    return (
      <div className="px-5 space-y-3">
        <div role="alert" className="bg-card border border-border rounded-2xl p-5 flex items-start gap-3">
          <CameraOff className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-display font-bold text-foreground">{error.title}</p>
            <p className="text-xs font-mono text-muted-foreground leading-relaxed mt-1">{error.message}</p>
          </div>
        </div>
        {photoOption('Take a photo of the barcode')}
      </div>
    );
  }

  return (
    <div className="px-5 space-y-3">
      <button
        ref={tapRef}
        type="button"
        onClick={startScanning}
        className="w-full bg-card border border-primary/20 rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.98]"
      >
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-xl bg-primary/10 flex items-center justify-center">
            {error ? (
              <CameraOff className="w-11 h-11 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ScanLine className="w-11 h-11 text-primary" aria-hidden="true" />
            )}
          </div>
          {CORNERS.map((cls, i) => (
            <div key={i} className={`absolute w-5 h-5 border-primary/60 ${cls}`} style={{ borderRadius: 1 }} />
          ))}
        </div>

        <div className="text-center">
          <p className="text-base font-display font-bold text-foreground tracking-wide">
            {error ? 'Try again' : 'Tap to Scan'}
          </p>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {error ? error.title : 'Uses your camera to read the barcode'}
          </p>
        </div>

        <div className="px-5 py-2 rounded-full bg-primary/10 border border-primary/20">
          <span className="text-sm font-mono text-primary font-semibold">{error ? 'Retry camera' : 'Start Scanning'}</span>
        </div>
      </button>

      {photoOption()}

      {error && (
        <div role="alert" className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-2.5">
          <CameraOff className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-xs font-mono font-semibold text-foreground">{error.title}</p>
            <p className="text-xs font-mono text-foreground/80 leading-relaxed mt-0.5">{error.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
