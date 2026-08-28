# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Migrated off the original Base44 implementation (React + Vite + `@base44/sdk`) to a production-grade stack matching the sibling project Strk:

- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- Backend: Supabase (Postgres + RLS + Auth + Realtime + Edge Functions)
- Payments: Paddle (Merchant of Record)
- Hosting: Vercel
- Error monitoring: Sentry (PII-scrubbed)
- Rate limiting: Upstash Redis
- Dev workflow: Claude Code, feature-branch + PR, Vercel preview deployments

## Users

Serious collectors/traders of energy drink cans — people for whom collecting is a primary hobby, not incidental. They actively hunt rare or hard-to-find cans, trade with other collectors, and are motivated by competing (leaderboards) as much as by cataloging.

## Product Purpose

Sippd is a mobile-first energy drink can collection tracker. It lets collectors log, catalog, and showcase their collections, and turns collecting into a social, competitive activity rather than a private list.

## Positioning

The differentiator versus a spreadsheet or generic collection-tracker app is the social + competitive layer: leaderboard, activity feed, and achievements make collecting a shared, competitive hobby. Discovery/cataloging features (scan-to-log, Most Wanted, Crates) and cross-collector comparison (Compare Collection, Wishlist) support that same competitive/social mechanism rather than standing alone.

## Operating Context

Mobile-first, in-the-moment usage — the Scan flow implies logging a can at the point of acquisition. Current route set (evidence from `src/pages`, carried into the migration unless product decisions change it):

- **Home** — dashboard
- **Scan** — add a can to the collection
- **Collection** — browse own cans
- **CanDetail** — single can detail view
- **Leaderboard** — competitive ranking (cross-user)
- **Profile** / **PublicProfile** — own and others' profiles (cross-user)
- **Achievements** — gamification
- **Settings**
- **MonthlyReport** — periodic recap
- **MostWanted** — discovery of rare/sought cans
- **Feed** — social activity (cross-user)
- **Notifications**
- **Crates** — organizing subsets of a collection
- **CompareCollection** — compare against another collector's collection (cross-user)
- **Wishlist** — cans wanted

## Capabilities and Constraints

- Migration off Base44 to the Supabase/Paddle/Vercel/Sentry/Upstash stack above is complete — no `@base44/*` packages, SDK calls, or build-time dependency remain in the codebase.
- Non-negotiable architectural constraints carried over from Strk (not product facts, but bind every feature built going forward):
  - RLS is the real security boundary; test with a genuinely different non-owner session.
  - Paid-feature/role-gating columns need `BEFORE UPDATE` triggers, `SECURITY INVOKER`, rejecting client writes to those columns.
  - `SECURITY DEFINER` is reserved for RPCs that must bypass RLS, owned by a dedicated `NOLOGIN` role; column-lockdown triggers stay `SECURITY INVOKER`.
  - Cross-user features (Leaderboard, Feed, PublicProfile, CompareCollection) need real server-side sync, not client-side stubs.
  - Every mutation needs real `onError` handling with user-visible feedback.
  - Account deletion is server-side via the Auth Admin API with full cascade + array sweeps.
  - Edge function deploys require an explicit `supabase functions deploy <name>` — they do not deploy on `git push`.
  - Feature-branch workflow for every change, no exceptions.
- Monetization: core tracking (scan/log/collect) stays free; a paid tier unlocks extras. Which specific features sit behind the paid tier is not yet decided — do not invent specifics.

## Brand Commitments

Product name is **Sippd**. The stale pre-rename "Canvolt" title and Base44-hosted favicon in `index.html` have been fixed — the title now reads "Sippd — Energy Drink Collection Tracker" with a self-contained inline favicon.

## Evidence on Hand

Codebase at the project root with working routes/components for every feature listed under Operating Context (`src/pages/*`, `src/components/{achievements,candetail,collection,crates,dashboard,feed,layout,leaderboard,profile,scan,shared,social,wishlist,ui}`), now running fully on Supabase. No `public/` directory or `manifest.json` currently exists in the repo despite being referenced by `index.html` — do not fabricate logo/icon/PWA assets; treat them as missing.

## Product Principles

1. Collecting is competitive and social by default — core features reinforce the leaderboard/feed/achievement loop, not just personal cataloging.
2. Security boundaries are real, not decorative — RLS plus column-level triggers protect collection data and paid-tier state from client tampering, matching Strk's proven pattern.
3. Cross-user features must be server-synced — leaderboards, feeds, and collection comparisons reflect true shared state, never client-only stubs.
4. Free core, paid extras — scanning, logging, and collecting stay free; monetization sits on top via clearly separated premium features (specifics still open).
5. The migration preserved product behavior — moving Base44 → Supabase/Paddle/Vercel changed infrastructure, not the feature set or workflows already shipped.
