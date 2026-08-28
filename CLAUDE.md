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
