import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import { ScanLine, X, CameraOff } from 'lucide-react';

const HINTS = new Map();
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
]);

// Maps getUserMedia rejection names to plain-language copy — these are the
// errors real phones actually throw, not a generic "camera failed."
function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return "Camera access was denied. Enable it in your browser's site settings to scan, or search manually above.";
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera found on this device. Search manually above instead.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera is already in use by another app. Close it and try again, or search manually above.';
    default:
      return "Couldn't start the camera. Search manually above instead.";
  }
}

// autoStart: start the camera on mount (Scan passes it after "Scan Next").
// The camera also starts by itself whenever this site already has camera
// permission, so only a first-ever visit needs "Tap to Scan". Browsers that
// can't report the permission (Firefox) fall back to the tap.
// onAnnounce: tells the page's live region what the camera is doing.
export default function BarcodeScanner({ onDetected, autoStart = false, onAnnounce }) {
  const [status, setStatus] = useState('idle'); // idle | starting | scanning | error
  const [errorMessage, setErrorMessage] = useState('');
  const [slowStart, setSlowStart] = useState(false);
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const detectedRef = useRef(false);
  const mountedRef = useRef(true);

  // decodeFromConstraints below has no built-in timeout — on some Android/
  // WebView permission-prompt edge cases the underlying getUserMedia
  // promise can simply never settle, leaving "Starting camera…" showing
  // forever with no acknowledgment anything's off (the X button already
  // works as an escape hatch either way; this only changes what the
  // waiting screen says, it doesn't forcibly cancel a prompt still
  // pending on the user's own response).
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

  const startScanning = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorMessage("This browser can't access the camera. Search manually above instead.");
      return;
    }

    setStatus('starting');
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
            stopScanning();
            setStatus('idle');
            onDetected(result.getText());
            return;
          }
          // NotFoundException fires on every frame with no barcode in view —
          // that's the normal, silent case while the camera is live.
          if (err && !(err instanceof NotFoundException)) {
            setStatus('error');
            setErrorMessage(describeCameraError(err));
          }
        }
      );

      // The component may have unmounted while the permission prompt/stream
      // setup above was pending — don't leave the camera running behind it.
      if (!mountedRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setStatus('scanning');
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('error');
      setErrorMessage(describeCameraError(err));
    }
  };

  // Once per mount. startScanning is recreated every render and only needs
  // to run the first time, so it is read through a ref.
  const startRef = useRef(startScanning);
  startRef.current = startScanning;
  useEffect(() => {
    let cancelled = false;
    const begin = () => { if (!cancelled && mountedRef.current) startRef.current(); };
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

  // The X that had focus disappears with the camera view, so hand focus to
  // the Tap to Scan button that replaces it.
  const tapRef = useRef(null);
  const cancelScanning = () => {
    stopScanning();
    setStatus('idle');
    requestAnimationFrame(() => tapRef.current?.focus());
  };

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
                  ? 'Still waiting on your camera — tap the X to cancel and search manually instead.'
                  : 'Starting camera…'}
              </p>
            </div>
          )}

          {status === 'scanning' && (
            <>
              <div className="absolute inset-8 pointer-events-none">
                {[
                  'top-0 left-0 border-t-2 border-l-2',
                  'top-0 right-0 border-t-2 border-r-2',
                  'bottom-0 left-0 border-b-2 border-l-2',
                  'bottom-0 right-0 border-b-2 border-r-2',
                ].map((cls, i) => (
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
            {status === 'error' ? (
              <CameraOff className="w-11 h-11 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ScanLine className="w-11 h-11 text-primary" aria-hidden="true" />
            )}
          </div>
          {[
            'top-0 left-0 border-t-2 border-l-2',
            'top-0 right-0 border-t-2 border-r-2',
            'bottom-0 left-0 border-b-2 border-l-2',
            'bottom-0 right-0 border-b-2 border-r-2',
          ].map((cls, i) => (
            <div key={i} className={`absolute w-5 h-5 border-primary/60 ${cls}`} style={{ borderRadius: 1 }} />
          ))}
        </div>

        <div className="text-center">
          <p className="text-base font-display font-bold text-foreground tracking-wide">
            {status === 'error' ? 'Try Again' : 'Tap to Scan'}
          </p>
          <p className="text-xs font-mono text-muted-foreground mt-1">Uses your camera to read the barcode</p>
        </div>

        <div className="px-5 py-2 rounded-full bg-primary/10 border border-primary/20">
          <span className="text-sm font-mono text-primary font-semibold">Start Scanning</span>
        </div>
      </button>

      {status === 'error' && (
        <div role="alert" className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
          <p className="text-xs font-mono text-foreground leading-relaxed">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
