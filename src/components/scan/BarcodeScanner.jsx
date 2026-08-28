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
      return "Camera access was denied. Enable it in your browser's site settings to scan, or search manually below.";
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera found on this device. Search manually below instead.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera is already in use by another app. Close it and try again, or search manually below.';
    default:
      return "Couldn't start the camera. Search manually below instead.";
  }
}

export default function BarcodeScanner({ onDetected }) {
  const [status, setStatus] = useState('idle'); // idle | starting | scanning | error
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const detectedRef = useRef(false);
  const mountedRef = useRef(true);

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
      setErrorMessage("This browser can't access the camera. Search manually below instead.");
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

  const cancelScanning = () => {
    stopScanning();
    setStatus('idle');
  };

  if (status === 'scanning' || status === 'starting') {
    return (
      <div className="px-5">
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black border border-primary/20">
          <video ref={videoRef} muted playsInline autoPlay className="w-full h-full object-cover" />

          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <p className="text-xs font-mono text-muted-foreground">Starting camera…</p>
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
              <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] font-mono text-white/80">
                Point the camera at the barcode
              </p>
            </>
          )}

          <button
            onClick={cancelScanning}
            aria-label="Cancel scanning"
            className="absolute top-3 right-3 w-11 h-11 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 space-y-3">
      <button
        onClick={startScanning}
        className="w-full bg-card border border-primary/20 rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.98]"
      >
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-xl bg-primary/10 flex items-center justify-center">
            {status === 'error' ? (
              <CameraOff className="w-11 h-11 text-muted-foreground" />
            ) : (
              <ScanLine className="w-11 h-11 text-primary" />
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
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
