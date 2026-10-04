// What went wrong with the camera, from getUserMedia's rejection name, and
// what the scanner should offer for it. "Try again" only appears where
// retrying can work: after allowing access, or once another app lets go of
// the camera. With no camera, or a browser that can't use one, a retry
// button would only fail again, so those point at a photo (the phone's own
// camera app) and search instead.
export const CAMERA_ERRORS = {
  denied: {
    title: 'Camera blocked',
    message: 'Allow camera access for this site in your browser settings, then try again. Or take a photo of the barcode, or search for the can above.',
    canRetry: true,
  },
  busy: {
    title: 'Camera in use',
    message: 'Another app is using the camera. Close it, then try again. Or take a photo of the barcode, or search for the can above.',
    canRetry: true,
  },
  nocamera: {
    title: 'No camera found',
    message: "The app can't use a camera on this device. Take a photo of the barcode with your camera app, search for the can above, or add it manually below.",
    canRetry: false,
  },
  unsupported: {
    title: "This browser can't scan",
    message: "This browser can't open the camera for live scanning. Take a photo of the barcode instead, search for the can above, or add it manually below.",
    canRetry: false,
  },
  other: {
    title: "Couldn't start the camera",
    message: 'Something stopped the camera from starting. Try again, take a photo of the barcode, or search for the can above.',
    canRetry: true,
  },
};

export function cameraErrorKind(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'nocamera';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy';
    default:
      return 'other';
  }
}

export function cameraSupported(nav = globalThis.navigator) {
  return !!nav?.mediaDevices?.getUserMedia;
}
