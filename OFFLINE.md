# OFFLINE.md — Sippd offline support

Sippd works offline as an installable PWA with a local-first data layer.
Your own collection, wishlist and profile are fully readable and writable
offline. Anything involving other people needs a connection.

Code: `src/lib/offline/` (logic and tests), `src/hooks/useUserCollection.js`,
`useMyProfile.js`, `useOnline.js`, `src/components/offline/`, `src/sw.js`.

## What works offline

| Offline (read + write) | Online only (shows "You're offline. … needs a connection.") |
|---|---|
| Collection, can detail, stats pages built from your collection | Trades: send, accept, decline, live status, trade log |
| Add a can (with photo), edit, remove | Feed, notifications, other users' profiles and collections |
| Favourite, pin, wishlist add / move / remove | Leaderboard, crates, compare |
| Profile: name, region, privacy, follow notifications | Theme change (Pro-guarded server-side), barcode edits |
| Catalog data you have already loaded | Checkout / Pro purchase (Paddle, untouched) |

Trade actions are **never queued**. Online-only screens are wrapped in
`<OnlineOnly>` (see `App.jsx`) and say so instead of failing.

## Architecture

```
 UI ── useUserCollection / useMyProfile (Dexie live queries)
  │
  └─ write(fn) ──► outbox.js ──► Dexie (row marked _pending + outbox entry)
                                     │
            autoSync.js triggers ──► sync.js ── push ──► remote.js ──► Supabase
                                     │       ◄─ pull ──┘   (anon key + user JWT, RLS)
                                     ▼
                                 Dexie rows
```

### 1. App shell: Serwist (`src/sw.js`, `@serwist/vite`)

- Precaches the whole build (every lazy route chunk), so every route opens
  offline after the first visit. Navigations fall back to `/index.html`;
  if even that isn't cached yet, `/offline.html`.
- A new version waits until the user taps **Reload** on the update toast,
  so an open session never mixes old and new chunks.
- Runtime caches: `can-images` (Supabase public storage, CacheFirst,
  CORS mode to avoid ~7 MB opaque-response padding, LRU 200 entries /
  60 days, purged first on quota errors) and Google Fonts.
- Supabase REST / auth / RPC never go through the service worker.
- **Capacitor app:** registers `/sw.js?mode=images`, i.e. image caching
  only, no precache and no navigation takeover (the shell ships in the APK
  and an old precache could outlive an app update). Never auto-reloads.
- Not registered in development.

### 2. Local store: Dexie (`db.js`)

One IndexedDB database **per user**: `sippd-offline-<userId>`.

| Table | Holds |
|---|---|
| `collection` | Mirror of the user's `user_collection` rows + local flags `_pending`, `_deleted`, `_blobId` |
| `profile` | The user's `profiles` row |
| `catalog` | `shared_cans` rows the user has loaded (their own cans + anything browsed) |
| `outbox` | Queued writes |
| `blobs` | Compressed photos not yet uploaded |
| `meta` | Pull cursor, last sync time |

Rows use client-generated UUIDs, so an offline add has its final id from
the start. Sign-out closes and deletes the database (`registry.js`) and
clears the Pro cache; the Log Out dialog warns first when changes haven't
synced.

### 3. Outbox (`outbox.js`)

Entry: `{ id, key, table, op, payload, createdAt, attempts, lastError, status }`.

- Every write updates the local row immediately (UI is instant) and
  appends an outbox entry. Repeated edits to the same row coalesce.
- Photos: compressed in the browser (WebP, JPEG fallback, max 1600 px,
  q 0.82, `images.js`), stored as a Blob, and queued as a `blob.upload`
  entry **before** the row that references it. Path:
  `can-images/<userId>/<rowId>.webp`.
- Adding a can is a composite job: upload photo → `vote_on_can` (catalog
  match; returned `canId` is saved into the payload so a retry never votes
  twice) → upsert the row.
- Favourites store the *target* value; the push reads the server value and
  only toggles if it differs (the server toggle RPC is not idempotent).
- Deleting a row that never synced just drops it and its pending entries.

### 4. Sync engine (`sync.js`, `autoSync.js`)

- **One run at a time:** guarded by the Web Locks API (`navigator.locks`)
  plus an in-process flag, so two tabs never push concurrently.
- **Push**, in order. Entries for the same row stay in order; a failing entry
  only holds back its own row.
  - Errors are classified (`errors.js`):
    - *retry*: network, 408, 429 or 5xx, with exponential backoff
      `2^n · 1 s`, capped at 5 min, with jitter.
    - *limit*: the daily scan limit or the rate limit. Marked failed at
      once with a friendly message; tap Retry once the limit resets.
    - *fatal*: marked failed immediately.
  - After `MAX_ATTEMPTS` (5), the entry is **failed**. It shows in the sync
    indicator with Retry, never silently dropped.
  - Every handler is idempotent:
    - Uploads treat "already exists" as success.
    - Deletes treat "not found" as success.
    - Upserts are keyed on the client UUID.
- **Pull**:
  - Pages of 500 by the per-table `server_updated_at` cursor, applied with
    last-write-wins on `updated_at`. A locally pending row is kept when its
    edit is newer, and a queued local delete always wins.
  - Then an id reconciliation removes rows deleted on another device.
  - Then the profile and catalog are refreshed.
  - Before the proposed migration is applied, the client falls back to a
    full pull each time. It's correct, just heavier.
- **Triggers:** app open, `online`, `visibilitychange` (to visible), 1.5 s
  after a write (debounced), and every 60 s while visible. There's no
  Background Sync: it's Chromium-only and unreliable on mobile.
- **Status** (`SyncStatus` in every page header): Synced / N to sync /
  Syncing / Offline / Couldn't sync (with Retry).

### 5. Auth offline (`session.js`, `useAuth.js`)

- Supabase drops the session in memory when a token refresh fails, but it
  keeps the session in localStorage. When the refresh failed because of the
  network (`isNetworkAuthError`), the app keeps using the stored session, so
  the user is not logged out for being offline. Real auth errors still sign
  them out.
- Once back online, the next refresh renews the token, and sync resumes with
  a valid JWT.

### 6. Pro status (`proCache.js`, `useSubscription.js`)

- `get-subscription-status` results are cached in localStorage for **7
  days**, and used as initial data. A Pro user keeps Pro features offline
  for up to a week.
- The cache is cleared on sign-out. Checkout and webhooks are unchanged.

### 7. Storage

- `navigator.storage.persist()` is requested once signed in
  (`storage.js`).
- Quota errors on a write show a toast ("Your device is out of space…"),
  and the write is not lost silently. The image cache purges itself first.

## Security / RLS

- The client only ever uses the anon key plus the user's JWT. **No
  service-role key** anywhere in client code.
- Writes go through `sync_upsert_user_collection` / `sync_update_profile`
  (proposed, `SECURITY INVOKER`), or plain RLS-guarded table calls until
  then. RLS stays in force either way.
- Locked columns are never pushed (`fields.js`): `is_favourite` (toggle
  RPC), `can_rarity` on update, and the profile billing/streak/role columns.
  The existing `BEFORE UPDATE` lock triggers still guard them.
- Review result: the existing `user_collection` and `profiles` policies
  allow every write the sync makes. **Flagged, not changed:** the
  `can-images` storage bucket policies live only in the Dashboard. Confirm
  uploads are limited to the caller's own `<uid>/` folder (suggested
  policy in the proposed migration).

## Proposed migration (not applied)

`supabase/proposed/20261101000000_offline_sync.sql`. It sits outside
`supabase/migrations/`, so `db push` can't apply it by accident. It adds:

- `updated_at` (client edit time, for last-write-wins) and
  `server_updated_at` (set by trigger, for the pull cursor) on
  `user_collection` and `profiles`.
- `(owner_id, server_updated_at)` indexes.
- The two `SECURITY INVOKER` last-write-wins upsert RPCs.
- A commented-out soft-delete sketch, and the reasons it isn't recommended.
  Deletes stay hard, and are reconciled by id on pull.

To apply it:
1. Review it.
2. Move it into `supabase/migrations/` with a fresh timestamp.
3. Run `supabase db push`.

The client detects the new columns and RPCs and switches over automatically.

## Adding a new synced table

1. Add a store in `db.js` with a **new Dexie version** (`db.version(n+1)`).
   Never edit an existing version.
2. Add its writable fields to `fields.js`. Leave out any locked or billing
   column.
3. Add outbox helpers in `outbox.js`: update the local row, mark it
   `_pending`, append an entry with a stable `key`.
4. Add push handlers in `sync.js`. They must be idempotent: replaying them
   is safe. Add pull logic using a `server_updated_at` cursor.
5. Add the remote calls in `remote.js` (anon client, RLS), and the same
   behaviour in `fakeRemote.js`.
6. Add tests in `sync.test.js`: replay, idempotency, conflict, cursor.
7. Read it in the UI through a `useLiveQuery` hook, and write through
   `useOffline().write(...)`.
8. Server side: a migration with `updated_at` / `server_updated_at`, RLS
   own-rows policies, and a lock trigger for any gated column.

## Known limitations

- **iOS Safari** may evict IndexedDB and caches after about 7 days without
  use, unless the PWA is installed to the home screen. Unsynced changes
  could then be lost. Installing is prompted (`InstallPrompt`).
- **Catalog search offline** only searches cans saved on this device (your
  own and any you've opened), and says so; it never claims a can is missing
  from the catalog. Full search and discovery need a connection.
- **Server-only extras** on offline screens (your rarity-vote history on
  Home / Achievements / Profile, follower counts) aren't mirrored: after an
  offline reload they show as empty or zero until you reconnect. Crates
  say "You're offline. Crates need a connection." in the add-to-crate sheet.
- **Capacitor:** the images-only worker on `https://localhost` still needs
  checking on a real device.
- **Conflict resolution** is last-write-wins per row, not per field. If two
  devices edit the same can offline, the later edit wins whole. Without
  the migration, the server row has no `updated_at`, so the incoming edit
  always wins.
- **Daily scan limit:** an add that hits the limit offline waits in the
  outbox as **Couldn't sync** with the reason; tap Retry once the limit
  resets. The can stays in your local collection meanwhile.
- **Signing out** discards unsynced changes (with a warning).

## Automated test

`e2e/offline.spec.js` runs in CI's e2e job against the production build
(service worker active) with a faked backend. It covers:

- the shell reloading offline, still signed in;
- adding a can with a photo offline, with the outbox order
  `blob.upload` → `collection.add`;
- the online-only notice;
- on reconnect: upload → `vote_on_can` → upsert, with the uploaded URL on
  both;
- offline search of saved cans.

Unit tests: `src/lib/offline/*.test.js`.

## Manual test checklist

### Chrome DevTools (desktop)

Use `npm run build && npm run preview`. The service worker is not
registered under `npm run dev`.

1. Sign in, then open Collection, a can detail page, Wishlist and Profile.
2. In DevTools → **Application**:
   - The service worker is *activated*.
   - Cache Storage has a precache plus `can-images`.
   - IndexedDB has `sippd-offline-<uid>`.
3. In the **Network** tab, set **Offline**, then reload. The app opens on
   the same page, with collection photos visible.
4. **Add a can with a photo** (Scan → manual add → upload a photo → save).
   - It appears at once, with the photo.
   - The header indicator says **1 to sync**.
   - The IndexedDB `outbox` has `blob.upload` before `collection.add`.
5. Edit a can, favourite one, pin one, and remove one. Move a wishlist
   item to the collection. Change your name and region. All of these are
   instant.
6. Open Trades, Feed, Leaderboard, and another user's profile. Each shows
   "You're offline. … needs a connection." with a way back. Nothing
   spins forever, and no trade button is usable.
7. Reload while still offline. You're still signed in, and your edits are
   still there.
8. Set the Network tab back to **No throttling**.
   - The indicator goes Syncing → Synced within a few seconds.
   - In Supabase (Table editor or the app on another device), the new can
     row exists, `can_image_url` points at `<uid>/<id>.webp`, and the
     photo loads.
   - The edits, favourite, pin, removal and profile changes all match.
9. Edit the same can on two devices, then sync both. The later edit wins.
10. Go offline, make an edit, then click Log Out. The dialog warns that 1
    change hasn't synced. Cancel, go online, wait for **Synced**, then log
    out. IndexedDB `sippd-offline-<uid>` is gone.
11. **Failure path:** block `*.supabase.co/rest/*` in DevTools request
    blocking while online, then make an edit. After the retries, the
    indicator shows **Couldn't sync**. Unblock, tap **Retry**, and it goes
    to Synced.

### Phone, airplane mode

1. In Chrome on Android (or Safari on iOS), open the site and sign in.
   Install it to the home screen, then open it from the icon.
2. Browse your collection and a few can pages, so the photos get cached.
3. Turn on **airplane mode**, then close and reopen the app. It opens with
   your collection.
4. Add a can with a photo **taken with the camera**. It shows straight
   away, and the indicator says **1 to sync**.
5. Edit a can, and remove one. Trades and Feed show the offline notice.
6. Turn airplane mode off and bring the app to the foreground. Within a
   few seconds the indicator says **Synced**.
7. On another device or the web, confirm the new can and its photo are
   there, and the edit and removal match.
8. Capacitor APK: repeat steps 3–7. Shell offline is native there; check
   that photos you already viewed still load offline.
