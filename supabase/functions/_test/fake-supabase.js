// In-memory stand-in for supabase-js, just enough for the edge functions'
// own queries: insert / update / select with .eq() filters, .select() after
// a write, .single(), and auth.getUser(). Tests seed and inspect
// `fakeDb` (see harness.js); it is not a Postgres emulation: RLS, triggers
// and constraints other than paddle_events.event_id are not modelled.

// On globalThis: the function under test may load its own copy of this
// module (see harness.js), and both copies must share one database.
export const fakeDb = (globalThis.__fakeSupabaseDb ??= {
  tables: { profiles: [], paddle_events: [] },
  users: {}, // access token -> user
  failures: [], // [{ table, op, error }], consumed once each
  calls: [], // { table, op, patch?, row?, filters, key }
  deletedUsers: [],
});

export function resetFakeDb() {
  fakeDb.tables = { profiles: [], paddle_events: [] };
  fakeDb.users = {};
  fakeDb.failures = [];
  fakeDb.calls = [];
  fakeDb.deletedUsers = [];
}

class Query {
  constructor(table, key) {
    this.table = table;
    this.key = key;
    this.op = 'select';
    this.filters = [];
    this.returning = false;
    this.isSingle = false;
  }
  select() { if (this.op === 'select') this.op = 'select'; else this.returning = true; return this; }
  insert(row) { this.op = 'insert'; this.row = row; return this; }
  update(patch) { this.op = 'update'; this.patch = patch; return this; }
  eq(column, value) { this.filters.push([column, value]); return this; }
  single() { this.isSingle = true; return this; }
  then(resolve, reject) { return Promise.resolve().then(() => this.exec()).then(resolve, reject); }

  exec() {
    const { table, op } = this;
    fakeDb.calls.push({ table, op, patch: this.patch, row: this.row, filters: this.filters, key: this.key });
    const i = fakeDb.failures.findIndex((f) => f.table === table && f.op === op);
    if (i >= 0) return { data: null, error: fakeDb.failures.splice(i, 1)[0].error };

    const rows = (fakeDb.tables[table] ??= []);
    const matches = (r) => this.filters.every(([c, v]) => r[c] === v);

    if (op === 'insert') {
      if (table === 'paddle_events' && rows.some((r) => r.event_id === this.row.event_id)) {
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
      }
      rows.push({ processed: false, ...this.row });
      return { data: null, error: null };
    }
    if (op === 'update') {
      const hit = rows.filter(matches);
      for (const r of hit) Object.assign(r, this.patch);
      return { data: this.returning ? hit.map((r) => ({ id: r.id })) : null, error: null };
    }
    const hit = rows.filter(matches);
    if (this.isSingle) {
      return hit.length === 1
        ? { data: { ...hit[0] }, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
    }
    return { data: hit.map((r) => ({ ...r })), error: null };
  }
}

export function createClient(url, key, options = {}) {
  const auth = options.global?.headers?.Authorization ?? null;
  return {
    from: (table) => new Query(table, key),
    auth: {
      async getUser() {
        const token = auth?.replace(/^Bearer\s+/i, '');
        const user = token ? fakeDb.users[token] : undefined;
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid JWT' } };
      },
      admin: {
        async deleteUser(id) {
          fakeDb.calls.push({ table: 'auth.users', op: 'deleteUser', id, key });
          const i = fakeDb.failures.findIndex((f) => f.table === 'auth.users' && f.op === 'deleteUser');
          if (i >= 0) return { data: null, error: fakeDb.failures.splice(i, 1)[0].error };
          fakeDb.deletedUsers.push(id);
          return { data: {}, error: null };
        },
      },
    },
  };
}
