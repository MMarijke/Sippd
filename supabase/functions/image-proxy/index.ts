import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Anonymous by design: called from a plain <img src> tag as part of
// html2canvas's CORS-safe capture path (see ShareCardModal.jsx), which
// cannot attach an Authorization header — verify_jwt is off for this
// function in supabase/config.toml. That removes the auth boundary
// Supabase would otherwise enforce, so the hostname allowlist and
// private-IP block below ARE the security controls for this function,
// not defense-in-depth on top of one — treat edits to either as a
// security change, not routine maintenance.

const ALLOWED_HOSTS = new Set([
  'world.openfoodfacts.org',
  'images.openfoodfacts.org',
  'static.openfoodfacts.org',
  'aejgztuwixlqexmkbznz.supabase.co',
])

function isBlockedIp(ip: string): boolean {
  const v4 = ip.split('.').map(Number)
  if (v4.length === 4 && v4.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = v4
    if (a === 127) return true               // loopback
    if (a === 10) return true                 // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true  // RFC1918
    if (a === 192 && b === 168) return true   // RFC1918
    if (a === 169 && b === 254) return true   // link-local (incl. AWS/GCP metadata: 169.254.169.254)
    if (a === 0) return true                  // "this network"
    return false
  }

  // IPv6
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true    // loopback / unspecified
  if (lower.startsWith('fe80:')) return true             // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true       // unique local (fc00::/7)

  return true // unrecognized format — fail closed
}

async function hasBlockedIp(hostname: string): Promise<boolean> {
  const results = await Promise.allSettled([
    Deno.resolveDns(hostname, 'A'),
    Deno.resolveDns(hostname, 'AAAA'),
  ])

  const ips = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))

  if (ips.length === 0) {
    // Neither record type resolved — treat as a lookup failure, not "safe".
    throw new Error('DNS resolution failed')
  }

  return ips.some(isBlockedIp)
}

serve(async (req) => {
  const url = new URL(req.url)
  const imageUrl = url.searchParams.get('url')

  if (!imageUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }

  let target: URL
  try {
    target = new URL(imageUrl)
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }

  // Only allow http/https URLs
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return new Response('Invalid URL', { status: 400 })
  }

  // CONTROL 1 — hostname allowlist. This function is unauthenticated (see
  // note above), so this is the primary gate against it being used as an
  // open proxy for arbitrary URLs.
  if (!ALLOWED_HOSTS.has(target.hostname.toLowerCase())) {
    return new Response('URL not allowed', { status: 403 })
  }

  // CONTROL 2 — block requests that resolve to a private/internal IP,
  // even for an allowed hostname (defense in depth against DNS pointing an
  // otherwise-legitimate domain at an internal address).
  let blocked: boolean
  try {
    blocked = await hasBlockedIp(target.hostname)
  } catch {
    return new Response('DNS resolution failed', { status: 502 })
  }
  if (blocked) {
    return new Response('URL not allowed', { status: 403 })
  }

  try {
    const response = await fetch(target.toString())
    if (!response.ok) {
      return new Response('Failed to fetch image', { status: response.status })
    }

    const contentType = response.headers.get('content-type') || ''
    // Reject non-image responses — without this, the function is a general-
    // purpose relay for arbitrary URLs, not just an image proxy.
    if (!contentType.startsWith('image/')) {
      return new Response('Not an image', { status: 400 })
    }

    const buffer = await response.arrayBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e) {
    return new Response('Error fetching image', { status: 500 })
  }
})
