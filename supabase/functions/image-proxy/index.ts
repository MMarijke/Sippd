import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const imageUrl = url.searchParams.get('url')

  if (!imageUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }

  // Only allow http/https URLs
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return new Response('Invalid URL', { status: 400 })
  }

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      return new Response('Failed to fetch image', { status: response.status })
    }

    const contentType = response.headers.get('content-type') || ''
    // Reject non-image responses — without this, the function is a general-
    // purpose authenticated relay for arbitrary URLs, not just an image proxy.
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
