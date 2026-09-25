// Vercel Edge Middleware — runs before vercel.json's SPA rewrite, so it
// gets first look at every request. Sippd is a client-rendered Vite SPA
// with no server-side rendering: a crawler that requests /u/:userId gets
// the same static index.html every route gets, with no per-profile
// content in it (React hasn't run yet, and crawlers don't run JS) — so a
// link pasted into iMessage/Discord/Twitter/Slack unfurled as Sippd's
// generic favicon and no description, regardless of whose profile it
// pointed to. This intercepts ONLY requests whose User-Agent identifies
// them as a known link-unfurling bot and serves a minimal, real HTML
// document with that profile's actual og:/twitter: meta tags instead —
// real browsers (and everything else) fall through to the normal SPA
// untouched.
//
// og:image points at /api/og/[userId] (a Vercel Edge Function using
// @vercel/og) rather than embedding an image here — generating a PNG is
// its own concern, kept in its own file.
export const config = {
  matcher: '/u/:userId',
};

// Coverage, not exhaustiveness: the major platforms this is meant to
// unfurl on (iMessage, Discord, Slack, Twitter/X, Facebook, WhatsApp,
// Telegram, LinkedIn) plus a generic `bot` catch-all for the long tail.
// A false negative here just means that one crawler sees the plain SPA
// shell instead of a rich preview — never a broken page for anyone.
const BOT_UA_PATTERN =
  /bot|facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|pinterest|redditbot|skypeuripreview|vkshare|w3c_validator|embedly|quora link preview|outbrain|nuzzel|flipboard|tumblr|bitlybot|iframely|applebot/i;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  if (!BOT_UA_PATTERN.test(userAgent)) return; // real visitors: untouched pass-through to the SPA

  const url = new URL(request.url);
  const userId = url.pathname.replace(/^\/u\//, '').split('/')[0];

  let displayName = 'A Sippd Collector';
  let isPrivate = false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/public_profiles?id=eq.${encodeURIComponent(userId)}&select=full_name,is_private`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    const [profile] = await res.json();
    if (profile) {
      displayName = profile.full_name || displayName;
      isPrivate = !!profile.is_private;
    }
  } catch {
    // Falls through to the generic name above — same principle as the
    // image endpoint: a plain-branded preview beats a broken response.
  }

  const title = `${displayName}’s Sippd Collection`;
  const description = isPrivate
    ? `${displayName} keeps a private can collection on Sippd.`
    : `Check out ${displayName}’s can collection on Sippd.`;
  const imageUrl = `${url.origin}/api/og/${encodeURIComponent(userId)}`;
  const pageUrl = `${url.origin}/u/${encodeURIComponent(userId)}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="Sippd">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${imageUrl}">
</head>
<body>
<a href="${pageUrl}">${escapeHtml(title)}</a>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
