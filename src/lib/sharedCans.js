// Reads of the shared catalog (shared_cans) that scale with the catalog.
//
// Pages used to load "the newest 500 shared_cans" and join collections to
// that list on the client. Fine at 79 cans; once the catalog passes 500
// (catalog seeding, or just growth) every collector's older cans fell out
// of the window and lost their community rarity. Pages now ask for exactly
// the cans they show, and search asks the server.

// PostgREST puts .in() filters in the URL; 100 uuids is ~3.7 KB, well
// under any proxy's URL limit.
export const ID_CHUNK = 100;
export const SEARCH_LIMIT = 10;

export function uniqueIds(ids = []) {
  return [...new Set(ids.filter(Boolean))].sort();
}

export async function fetchSharedCansByIds(client, ids) {
  const unique = uniqueIds(ids);
  if (!unique.length) return [];
  const chunks = [];
  for (let i = 0; i < unique.length; i += ID_CHUNK) chunks.push(unique.slice(i, i + ID_CHUNK));
  const results = await Promise.all(chunks.map(async chunk => {
    const { data, error } = await client.from('shared_cans').select('*').in('id', chunk);
    if (error) throw error;
    return data ?? [];
  }));
  return results.flat();
}

// The search term goes inside a PostgREST or=(...) filter, where , ( ) are
// syntax and % _ * \ are ilike wildcards/escapes; quotes and colons can break
// the filter string. None of them matter for finding a can by name, brand or
// barcode, so they're dropped rather than escaped.
export function sanitizeSearchTerm(term = '') {
  return term.replace(/[%_*\\,()"':]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function searchSharedCans(client, term, limit = SEARCH_LIMIT) {
  const q = sanitizeSearchTerm(term);
  if (q.length < 2) return [];
  const { data, error } = await client
    .from('shared_cans')
    .select('*')
    .or(`name.ilike.%${q}%,brand.ilike.%${q}%,barcode.ilike.%${q}%`)
    .order('total_votes', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
