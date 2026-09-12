import { ImageResponse } from '@vercel/og';

// Vercel Edge Function generating the og:image for a public profile link
// (see /middleware.js, which points og:image at this route for crawler
// requests to /u/:userId). Deliberately separate from the app's own
// client bundle: runs server-side, before any React code executes, so a
// link pasted into iMessage/Discord/Twitter/Slack gets a real preview
// instead of Sippd's generic favicon — a client-rendered SPA has no HTML
// for a crawler to read until JS runs, which crawlers don't do.
//
// Reads through the same anon-accessible public_profiles view and
// get_public_collection RPC a real browser would (see the 2026-09-12
// public-profile migration) — nothing here has any access a logged-out
// visitor to the actual page couldn't already see themselves.
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(request) {
  const url = new URL(request.url);
  const userId = url.pathname.split('/').pop();

  let displayName = 'A Sippd Collector';
  let cansCount = null;
  let isPrivate = false;
  let profileFound = false;

  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/public_profiles?id=eq.${encodeURIComponent(userId)}&select=full_name,is_private`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    const [profile] = await profileRes.json();
    if (profile) {
      profileFound = true;
      displayName = profile.full_name || displayName;
      isPrivate = !!profile.is_private;
    }

    // profileFound, not just !isPrivate — a nonexistent/deleted userId
    // (a stale or mistyped link) would otherwise fall through to this
    // RPC too, which correctly returns zero rows for an unknown id, but
    // "0 cans collected" then reads as a real, empty collection rather
    // than "this profile doesn't exist" — the generic card below is the
    // honest answer for that case.
    if (profileFound && !isPrivate) {
      const collectionRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_collection`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_caller_id: null, p_profile_id: userId }),
      });
      const items = await collectionRes.json();
      if (Array.isArray(items)) {
        cansCount = items.filter(i => i.status === 'collected').length;
      }
    }
  } catch {
    // Falls through to the generic card below — a broken preview image
    // is worse than a plain-branded one, never worse than no image.
  }

  const statLine = isPrivate
    ? 'Private Collection'
    : cansCount === null
      ? 'Energy Drink Collector'
      : `${cansCount} can${cansCount === 1 ? '' : 's'} collected`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b0e10',
          backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(45,212,198,0.16) 0%, transparent 55%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'flex',
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: 'rgba(45,212,198,0.14)',
              border: '2px solid rgba(45,212,198,0.4)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 20,
              fontSize: 34,
              color: '#2dd4c6',
            }}
          >
            ⚡
          </div>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: 6, color: '#2dd4c6' }}>
            SIPPD
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 56,
            fontWeight: 700,
            color: '#e9edf0',
            marginBottom: 16,
            textAlign: 'center',
            maxWidth: 900,
          }}
        >
          {displayName}&rsquo;s Collection
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#8b95a0' }}>{statLine}</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
