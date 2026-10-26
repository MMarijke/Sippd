import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Ratelimit } from 'npm:@upstash/ratelimit@2.0.8'
import { Redis } from 'npm:@upstash/redis@1.38.3'

// Anonymous by design: called from a plain <img src> tag as part of
// html2canvas's CORS-safe capture path (see ShareCardModal.jsx), which
// cannot attach an Authorization header — verify_jwt is off for this
// function in supabase/config.toml. That removes the auth boundary
// Supabase would otherwise enforce, so the hostname allowlist, private-IP
// block, and per-IP rate limit below ARE the security controls for this
// function, not defense-in-depth on top of one — treat edits to any of
// them as a security change, not routine maintenance.
//
// Upstash imports use Deno's native npm: specifier, not an esm.sh/Skypack
// CDN proxy — matches Supabase's own official example for this exact
// use case.

// Can photos only: no SVG (it can carry script), no other image types.
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const MAX_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 3

const ALLOWED_HOSTS = new Set([
  'world.openfoodfacts.org',
  'images.openfoodfacts.org',
  'static.openfoodfacts.org',
  'aejgztuwixlqexmkbznz.supabase.co',
])

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
})
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 h'),
  analytics: false,
})

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
  // Rate limit first, before any other work — this is what actually
  // bounds the denial-of-wallet exposure from an unauthenticated function.
  const forwardedFor = req.headers.get('x-forwarded-for')
  const ip = (forwardedFor ? forwardedFor.split(',')[0].trim() : null)
    || req.headers.get('x-real-ip')
    || 'unknown'

  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 })
  }

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

  // CONTROLS 1 + 2, run on the requested URL and again on every redirect
  // hop (CONTROL 3): an allowed host that redirects elsewhere must not be a
  // way around the allowlist or the private-IP block.
  const rejected = await checkTarget(target)
  if (rejected) return rejected

  try {
    let response: Response | null = null
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(target.toString(), { redirect: 'manual' })
      if (response.status < 300 || response.status >= 400) break
      const location = response.headers.get('location')
      if (!location || hop === MAX_REDIRECTS) {
        return new Response('Too many redirects', { status: 502 })
      }
      try {
        target = new URL(location, target)
      } catch {
        return new Response('Invalid redirect', { status: 502 })
      }
      const hopRejected = await checkTarget(target)
      if (hopRejected) return hopRejected
    }

    if (!response || !response.ok) {
      return new Response('Failed to fetch image', { status: response?.status ?? 502 })
    }

    // CONTROL 4 — raster images only. "image/*" would also pass SVG, which
    // can carry script; can images are photos.
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!ALLOWED_TYPES.has(contentType)) {
      return new Response('Not an image', { status: 400 })
    }

    // CONTROL 5 — size cap, checked against the declared length and again
    // while reading (the header can be missing or wrong).
    const declared = Number(response.headers.get('content-length') || 0)
    if (declared > MAX_BYTES) {
      return new Response('Image too large', { status: 413 })
    }
    const body = await readCapped(response, MAX_BYTES)
    if (!body) {
      return new Response('Image too large', { status: 413 })
    }

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e) {
    return new Response('Error fetching image', { status: 500 })
  }
})

// http/https + allowlisted host + not resolving to a private address.
// Returns the error response to send, or null when the URL may be fetched.
async function checkTarget(target: URL): Promise<Response | null> {
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
  try {
    if (await hasBlockedIp(target.hostname)) {
      return new Response('URL not allowed', { status: 403 })
    }
  } catch {
    return new Response('DNS resolution failed', { status: 502 })
  }
  return null
}

// Reads the body, giving up (null) once it passes maxBytes.
async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength }
  return out
}
  }
})
