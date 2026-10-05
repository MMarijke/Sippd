import { describe, it, expect } from 'vitest';
import { fetchSharedCansByIds, searchSharedCans, sanitizeSearchTerm, uniqueIds, ID_CHUNK } from './sharedCans';

// A stand-in for the supabase client's query builder: records every call
// and resolves with whatever `respond` returns for it.
function fakeClient(respond) {
  const calls = [];
  const client = {
    from(table) {
      const call = { table, ops: [] };
      calls.push(call);
      const builder = {
        then(resolve, reject) { return Promise.resolve(respond(call)).then(resolve, reject); },
      };
      for (const op of ['select', 'in', 'or', 'order', 'limit']) {
        builder[op] = (...args) => { call.ops.push([op, ...args]); return builder; };
      }
      return builder;
    },
  };
  return { client, calls };
}

const idsOf = call => call.ops.find(([op]) => op === 'in')[2];

describe('uniqueIds', () => {
  it('drops empties and duplicates', () => {
    expect(uniqueIds(['b', null, 'a', 'b', undefined, ''])).toEqual(['a', 'b']);
  });
});

describe('fetchSharedCansByIds', () => {
  it('asks for nothing when there are no ids', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    expect(await fetchSharedCansByIds(client, [null])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('asks for exactly the given cans, deduplicated', async () => {
    const { client, calls } = fakeClient(call => ({ data: idsOf(call).map(id => ({ id })) }));
    const rows = await fetchSharedCansByIds(client, ['c2', 'c1', 'c2']);
    expect(calls).toHaveLength(1);
    expect(idsOf(calls[0])).toEqual(['c1', 'c2']);
    expect(rows.map(r => r.id)).toEqual(['c1', 'c2']);
  });

  it('splits large id sets so the URL stays short, and merges the rows', async () => {
    const ids = Array.from({ length: ID_CHUNK * 2 + 5 }, (_, i) => `id-${String(i).padStart(4, '0')}`);
    const { client, calls } = fakeClient(call => ({ data: idsOf(call).map(id => ({ id })) }));
    const rows = await fetchSharedCansByIds(client, ids);
    expect(calls.map(c => idsOf(c).length)).toEqual([ID_CHUNK, ID_CHUNK, 5]);
    expect(rows).toHaveLength(ids.length);
  });

  it('throws when any chunk fails rather than returning a partial catalog', async () => {
    const { client } = fakeClient(() => ({ data: null, error: new Error('boom') }));
    await expect(fetchSharedCansByIds(client, ['a'])).rejects.toThrow('boom');
  });
});

describe('sanitizeSearchTerm', () => {
  it('drops filter syntax and wildcards', () => {
    expect(sanitizeSearchTerm(' Monster, (Ultra) 100%_*\\ "x":y ')).toBe('Monster Ultra 100 x y');
  });
});

describe('searchSharedCans', () => {
  it('does not query for terms under two characters', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    expect(await searchSharedCans(client, ' ( ')).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('matches name, brand or barcode on the server, capped', async () => {
    const { client, calls } = fakeClient(() => ({ data: [{ id: 'x' }] }));
    expect(await searchSharedCans(client, 'red bull')).toEqual([{ id: 'x' }]);
    const ops = Object.fromEntries(calls[0].ops.map(([op, ...a]) => [op, a]));
    expect(ops.or[0]).toBe('name.ilike.%red bull%,brand.ilike.%red bull%,barcode.ilike.%red bull%');
    expect(ops.limit[0]).toBe(10);
  });
});
