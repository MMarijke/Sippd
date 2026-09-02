const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Supabase Storage URLs already have CORS — don't proxy them. Everything
// else needs to go through image-proxy so html2canvas (useCORS/allowTaint:
// false) can actually capture it instead of tainting the canvas.
export function proxyImageUrl(url) {
  if (!url) return null;
  if (url.includes(SUPABASE_URL) || url.includes('supabase.co')) return url;
  return `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
}
