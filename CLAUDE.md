# CLAUDE.md — Sippd

Project-specific notes for Claude Code. See the shared `../CLAUDE.md` for
Seedstack-wide conventions (stack, RLS patterns, compliance, etc.) — this
file only holds Sippd-specific operational state.

## Migration state

CLI is linked and working (`supabase migration list --linked` confirmed
2026-08-28) — the earlier "CLI crashed, apply via Dashboard" reconciliation
issue is resolved. All migrations through `20260820000003_fix_rpc_caller_id.sql`
are recorded as applied on both local and remote. `supabase db push` /
`supabase migration list --linked` work normally now; no manual
`migration repair` step is outstanding.

`supabase functions deploy` does not accept `--linked` in the installed CLI
version — use `--project-ref aejgztuwixlqexmkbznz --use-api` instead.

## Edge function deploy checklist

Edge function deploys are manual — they do NOT happen on `git push`. After
merging code that adds or changes a function, deploy it explicitly:
`supabase functions deploy <name> --project-ref aejgztuwixlqexmkbznz --use-api`

Deployed functions:
  - image-proxy
  - delete-account
  - paddle-webhook
  - get-subscription-status

## Offline / local-first conventions (see `OFFLINE.md`)

- Own-data reads (collection, profile) come from Dexie via
  `useUserCollection` / `useMyProfile` — never add a new
  `['user-collection', …]` / `['my-profile']` React Query for them.
- Own-data writes go through `useOffline().write(fn)` with a helper from
  `src/lib/offline/outbox.js` — never call `supabase.from('user_collection')`
  or `profiles` directly from UI code. New synced table → follow
  "Adding a new synced table" in OFFLINE.md (new Dexie version, fields,
  outbox helper, idempotent push handler, tests).
- Anything involving other users or money (trades, messaging, feed,
  leaderboard, checkout) stays online-only: wrap the route in
  `<OnlineOnly>` or disable the action with the offline message. Never
  queue trade actions.
- Locked/billing columns are never in `fields.js` writable lists.
- Dexie schema changes add a new `db.version(n)` — never edit an
  existing version (same rule as merged migrations).
- Service worker only registers on production builds; test offline with
  `npm run build && npm run preview`, not `npm run dev`.
- `supabase/proposed/` holds reviewed-but-unapplied SQL; `db push` ignores
  it. `20261101000000_offline_sync.sql` is awaiting review/apply.
