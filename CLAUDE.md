# CLAUDE.md — Sippd

Project-specific notes for Claude Code. See the shared `../CLAUDE.md` for
Seedstack-wide conventions (stack, RLS patterns, compliance, etc.) — this
file only holds Sippd-specific operational state.

## Migration reconciliation needed

These migrations were applied via Dashboard SQL Editor (CLI crashed) and
are NOT recorded in the `supabase_migrations.schema_migrations` tracking
table:
- `20260819120000_grant_sippd_rpc_table_access.sql`
- `20260820000000_leaderboard_scores.sql`

When CLI is working again, run:

    supabase migration repair --status applied 20260819120000
    supabase migration repair --status applied 20260820000000
