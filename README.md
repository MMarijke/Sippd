# Sippd

Mobile-first energy drink can collection tracker — log, catalog, and show off
your collection, with a social/competitive layer (leaderboards, feed,
achievements) on top.

## Stack

- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- Backend: Supabase (Postgres + RLS + Auth + Realtime + Storage + Edge Functions)
- Payments: Paddle (Merchant of Record)
- Hosting: Vercel
- Error monitoring: Sentry (PII-scrubbed)
- Rate limiting: Upstash Redis

## Getting started

1. Clone the repo and install dependencies:

   ```
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values (Supabase
   project URL/anon key at minimum — Paddle/Sentry/Upstash vars are only
   needed once those integrations are wired up):

   ```
   cp .env.example .env.local
   ```

3. Run the app locally:

   ```
   npm run dev
   ```

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build locally
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run typecheck` — TypeScript checking via `jsconfig.json`

## Database

Schema and RLS policies live in `supabase/migrations/`. See
`supabase/migrations/` for the migration history and `CLAUDE.md` for the
project's RLS/security conventions.
