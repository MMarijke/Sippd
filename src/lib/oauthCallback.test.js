import { describe, expect, it } from 'vitest';
import { NATIVE_REDIRECT, parseAuthCallback } from './oauthCallback';

describe('parseAuthCallback', () => {
  it('ignores URLs that are not the sign-in callback', () => {
    expect(parseAuthCallback('https://sippd.example/login#access_token=a&refresh_token=b')).toBeNull();
    expect(parseAuthCallback('com.seedstackstudio.sippd://somewhere-else')).toBeNull();
    expect(parseAuthCallback(undefined)).toBeNull();
  });

  it('reads the session tokens from the fragment (implicit flow)', () => {
    const url = `${NATIVE_REDIRECT}#access_token=AT.1&expires_in=3600&refresh_token=RT-2&token_type=bearer&provider_token=g`;
    expect(parseAuthCallback(url)).toEqual({ tokens: { access_token: 'AT.1', refresh_token: 'RT-2' } });
  });

  it('reports an error from the query or the fragment', () => {
    const q = parseAuthCallback(`${NATIVE_REDIRECT}?error=access_denied&error_code=access_denied&error_description=User+cancelled`);
    expect(q).toEqual({ error: { code: 'access_denied', message: 'User cancelled' } });
    const h = parseAuthCallback(`${NATIVE_REDIRECT}#error=server_error&error_description=Unable%20to%20exchange`);
    expect(h).toEqual({ error: { code: 'server_error', message: 'Unable to exchange' } });
  });

  it('treats a callback with no tokens as an error, not a silent no-op', () => {
    expect(parseAuthCallback(NATIVE_REDIRECT).error.code).toBe('missing_tokens');
    expect(parseAuthCallback(`${NATIVE_REDIRECT}#access_token=only`).error.code).toBe('missing_tokens');
  });
});
