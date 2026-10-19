// The Android app's way back from Google sign-in. Google refuses to sign in
// inside an app's embedded web view, so the app opens Google in the phone's
// browser (Custom Tab) and Supabase sends the browser to this address at
// the end; the intent filter in AndroidManifest.xml hands it to the app.
// android/ is gitignored, so if it's ever regenerated (`npx cap add
// android`), put this back inside MainActivity's <activity> (singleTask):
//   <intent-filter>
//     <action android:name="android.intent.action.VIEW" />
//     <category android:name="android.intent.category.DEFAULT" />
//     <category android:name="android.intent.category.BROWSABLE" />
//     <data android:scheme="com.seedstackstudio.sippd" android:host="login-callback" />
//   </intent-filter>
// It must also be listed under Supabase → Authentication → URL
// Configuration → Redirect URLs, or Supabase falls back to the Site URL.
export const NATIVE_REDIRECT = 'com.seedstackstudio.sippd://login-callback';

// What an opened URL means for sign-in:
//   null                         not our callback (some other deep link)
//   { tokens: { access_token, refresh_token } }   signed in (implicit flow:
//                                tokens arrive in the #fragment)
//   { error: { code, message } } Google/Supabase reported a failure, or the
//                                callback came back without tokens
export function parseAuthCallback(url) {
  if (typeof url !== 'string' || !url.startsWith(NATIVE_REDIRECT)) return null;

  const params = new URLSearchParams();
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] || '';
  for (const part of [query, hash]) {
    for (const [k, v] of new URLSearchParams(part)) params.set(k, v);
  }

  const error = params.get('error');
  if (error) {
    return {
      error: {
        code: params.get('error_code') || error,
        message: params.get('error_description') || error,
      },
    };
  }

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) return { tokens: { access_token, refresh_token } };

  return { error: { code: 'missing_tokens', message: 'Sign-in came back without a session.' } };
}
