import { describe, expect, it } from 'vitest';
import { CAMERA_ERRORS, cameraErrorKind, cameraSupported } from './cameraErrors';

const err = name => Object.assign(new Error(name), { name });

describe('cameraErrorKind', () => {
  it('maps the errors phones actually throw', () => {
    expect(cameraErrorKind(err('NotAllowedError'))).toBe('denied');
    expect(cameraErrorKind(err('PermissionDeniedError'))).toBe('denied');
    expect(cameraErrorKind(err('NotFoundError'))).toBe('nocamera');
    expect(cameraErrorKind(err('NotReadableError'))).toBe('busy');
    expect(cameraErrorKind(err('Weird'))).toBe('other');
    expect(cameraErrorKind(undefined)).toBe('other');
  });
});

describe('CAMERA_ERRORS', () => {
  it('only offers a retry where retrying can work', () => {
    expect(CAMERA_ERRORS.denied.canRetry).toBe(true);
    expect(CAMERA_ERRORS.busy.canRetry).toBe(true);
    expect(CAMERA_ERRORS.nocamera.canRetry).toBe(false);
    expect(CAMERA_ERRORS.unsupported.canRetry).toBe(false);
  });

  it('points at search above, never below', () => {
    for (const { message } of Object.values(CAMERA_ERRORS)) {
      expect(message).toMatch(/above/);
      // "search ... below" within one clause; "add it manually below" is
      // right, the Add Manually button is below the scanner.
      expect(message).not.toMatch(/search[^,.]*below/i);
    }
  });
});

describe('cameraSupported', () => {
  it('needs getUserMedia', () => {
    expect(cameraSupported({ mediaDevices: { getUserMedia() {} } })).toBe(true);
    expect(cameraSupported({ mediaDevices: {} })).toBe(false);
    expect(cameraSupported({})).toBe(false);
    expect(cameraSupported(undefined)).toBe(false);
  });
});
