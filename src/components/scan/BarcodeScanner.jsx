import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import { ScanLine, X, CameraOff, Check, Loader2 } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { CAMERA_ERRORS, cameraErrorKind, cameraSupported } from '@/lib/cameraErrors';

const HINTS = new Map();
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
]);

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

  const startScanning = async () => {
    if (!cameraSupported()) {
      setStatus('error');
      setErrorKind('unsupported');
      return;
    }

    setStatus('starting');
    setErrorKind(null);
    setFound(null);
    detectedRef.current = false;
    readerRef.current ??= new BrowserMultiFormatReader(HINTS);

    try {
      const controls = await readerRef.current.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result, err) => {
          if (!mountedRef.current) return;
          if (result && !detectedRef.current) {
            detectedRef.current = true;
            const code = result.getText();
            // The "found it" moment: hold the frame, a short buzz, then the
            // lookup plays out in the same place the can was scanned. It used
            // to snap straight back to "Tap to Scan" with the progress shown
            // up in the search area.
            setFound({ code, frame: captureFrame(videoRef.current) });
            navigator.vibrate?.(40);
            stopScanning();
            setStatus('found');
            onDetected(code);
            return;
          }
          // NotFoundException fires on every frame with no barcode in view —
          // that's the normal, silent case while the camera is live.
          if (err && !(err instanceof NotFoundException)) fail(err);
        }
      );

      // The component may have unmounted while the permission prompt/stream
      // setup above was pending — don't leave the camera running behind it.
      if (!mountedRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      if (!detectedRef.current) setStatus('scanning');
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
      begin();
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
      setStatus('idle');
      setFound(null);
      requestAnimationFrame(() => tapRef.current?.focus());
    };
    if (sawLookupRef.current) {
      reset();
      return;
    }
    const timer = setTimeout(reset, 4000);
    return () => clearTimeout(timer);
  }, [status, lookup]);

  // The X that had focus disappears with the camera view, so hand focus to
  // the Tap to Scan button that replaces it.
  const cancelScanning = () => {
    stopScanning();
    setStatus('idle');
    requestAnimationFrame(() => tapRef.current?.focus());
  };

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
      </div>
    );
  }

  const error = status === 'error' ? CAMERA_ERRORS[errorKind] ?? CAMERA_ERRORS.other : null;

  // No camera, or a browser that can't use one: a big "Try Again" card
  // would only fail again, so say so plainly and point at search instead.
  if (error && !error.canRetry) {
    return (
      <div className="px-5">
        <div role="alert" className="bg-card border border-border rounded-2xl p-5 flex items-start gap-3">
          <CameraOff className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-display font-bold text-foreground">{error.title}</p>
            <p className="text-xs font-mono text-muted-foreground leading-relaxed mt-1">{error.message}</p>
          </div>
        </div>
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
