---
target: "core flow: Home, Scan, Collection, CanDetail"
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-28T09-18-44Z
slug: core-flow-home-scan-collection-candetail
---
Method: dual-agent (A: design-review sub-agent · B: detector sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Good loading/scanning states; image upload gives only a spinner-text swap |
| 2 | Match Between System / Real World | 4/4 | Collector jargon matches the target audience's mental model precisely |
| 3 | User Control and Freedom | 3/4 | Cancel/back paths exist everywhere, but a rarity vote locks permanently with zero confirmation step |
| 4 | Consistency and Standards | 3/4 | A typo (`cosensus_rarity`) silently breaks the rarity badge in search results |
| 5 | Error Prevention | 3/4 | Strong field validation and read-only locking; no confirmation before an irreversible vote |
| 6 | Recognition Rather Than Recall | 3/4 | Confidence-tier thresholds are explained only in a popover that must be reopened each time |
| 7 | Flexibility and Efficiency of Use | 2/4 | No batch-logging path forces a full navigate-away per can for a power-user audience |
| 8 | Aesthetic and Minimalist Design | 4/4 | Cohesive dark neon-vault system, clean hierarchy, restrained |
| 9 | Error Recovery | 3/4 | Camera errors are handled exemplarily; a raw Supabase error message leaks into a toast elsewhere |
| 10 | Help and Documentation | 2/4 | Only the two rarity popovers exist; nothing explains status types, achievements, or scoring |
| **Total** | | **30/40** | **Good — solid foundation, address weak areas** |

**Up from 23/40 on the first run** (see trend below).

## Design Specificity Verdict

**LLM assessment**: Mostly grounded, not templated. `RarityReveal.jsx`'s tier-specific particle-burst reveal, the community rarity-voting mechanic with confidence tiers, and the "Vault/Haul/Pulls/Crates" vocabulary couldn't be dropped into a generic tracker unchanged. That said, `StatsRow.jsx`, `EmptyState.jsx`, and `FilterBar.jsx` remain stock template chrome wearing the theme as a skin — the product-specific work concentrates in the scan/reveal moment; browse/filter chrome is still interchangeable with any tracker app.

**Deterministic scan**: Clean — zero findings across all 10 targets, same as the first run. This run's Assessment B added an important caveat worth recording: several detector rules (including `dark-glow`, which would be the most relevant one for this product's neon-glow aesthetic) only execute against `.html/.astro/.vue/.svelte` files, not `.jsx` — and some regexes key off kebab-case CSS (`border-radius`, `font-family:`) rather than the camelCase inline-style/CSS-in-JS idioms this codebase mostly uses. The clean scan reflects real absence of the patterns it *can* check on `.jsx` targets, not full coverage.

**Visual overlays**: Still not available — no browser automation tool exposed this session; both assessments worked from source code only.

## Overall Impression

Every P0/P1/P2 issue from the first critique is gone, and the score moved from Acceptable (23/40) to Good (30/40) — a real, verifiable improvement, not just polish. What's left is a different tier of problem: not "this is broken," but "this asks a serious collector to do something high-stakes (lock a rarity vote) with the same visual and interaction weight as a low-stakes one (pick a background color)," and "the core loop still can't be repeated without a full navigation round-trip." Both are judgment calls about interaction weight, not bugs — a good place to be.

## What's Working
- **`RarityReveal.jsx`** — tier-differentiated color/icon/particle system turns logging a can into a genuine collector-specific payoff moment, not a generic success toast
- **`BarcodeScanner.jsx`'s `describeCameraError()`** — maps every real `getUserMedia` rejection to specific, actionable copy; the standard the rest of the app's error handling should be held to
- **Community rarity voting UX** — the confidence-tier system with vote-count breakdown bars and a locked-vote receipt is a well-thought-through trust mechanic

## Priority Issues

**[P1] A typo silently breaks the rarity badge in search results** — verified: [Scan.jsx:162](src/pages/Scan.jsx#L162) reads `can.cosensus_rarity` (missing an `n`) instead of `consensus_rarity`, so it always falls through to the `rarity`/`'Common'` fallback. Any can whose community-voted consensus differs from its originally-tagged rarity shows the wrong badge in the exact screen where a collector decides what to log — undermining the trust mechanic the rest of the app is built around. *Suggested: `/impeccable harden`*

**[P1] No confirmation before an irreversible rarity vote** — verified: [AddCanForm.jsx:347-363](src/components/scan/AddCanForm.jsx#L347-L363), tapping a rarity chip immediately sets the vote, and submitting locks it server-side permanently ("vote can't be changed once cast"). A high-stakes, one-shot decision currently has the same tap weight as any other form field. *Suggested: `/impeccable harden`*

**[P2] No batch-logging path for the core action** — `AddCanForm.jsx`'s `onSuccess` navigates straight to `/collection` after every add, so logging a multi-pack haul means a full Scan round-trip per can — cutting against the product's own "log at the point of acquisition" positioning. *Suggested: `/impeccable clarify`*

**[P2] Sub-44px touch targets on the highest-stakes controls** — verified: rarity vote chips ([AddCanForm.jsx:354](src/components/scan/AddCanForm.jsx#L354), `px-3 py-1.5` ≈ 28px tall) and status toggle buttons ([:376](src/components/scan/AddCanForm.jsx#L376), `py-2` ≈ 32px tall) sit well under the 44px floor, on exactly the controls a one-handed, in-the-moment user taps to make an irreversible decision. Distinct from the icon-button touch targets already fixed earlier — these are text-label chip/pill buttons that round never got covered. *Suggested: `/impeccable adapt`*

**[P2] Raw backend error text reaches users** — verified: [AddCanForm.jsx:141](src/components/scan/AddCanForm.jsx#L141) is `toast.error('Failed to add can: ' + (error.message || 'Unknown error'))` — a raw Supabase/Postgres error message, not a translated, actionable one. *Suggested: `/impeccable clarify`*

**[P3] No character limit on free-text fields** — `AddCanForm.jsx`'s `validate()` only checks non-empty; no `maxLength` on Name/Brand/Flavour/Edition/Notes, and `CanDetail.jsx`'s can-name heading has no `line-clamp`. A long entry can distort the detail page and pollute the shared `shared_cans` table other collectors see. *Suggested: `/impeccable harden`*

## Persona Red Flags

**Casey (mobile)**: sub-44px rarity/status buttons on an irreversible decision; 32×32px background-color swatches with tight spacing; all Scan/AddCanForm state lives in local `useState` with no draft persistence — a backgrounded tab (camera permission prompt, incoming call, phone lock) mid-entry loses everything typed, in what's explicitly framed as an interruption-prone flow.

**Alex (power user)**: no bulk-log path; once a can has an `id`, its core fields become permanently read-only with no "report an issue" affordance for a power user who spots bad shared data; a rarity vote has no history view or correction path even for an obvious misclick.

**Riley (stress test)**: `Collection.jsx` still loads the full collection with `.select('*')` and no pagination into an un-virtualized `framer-motion` grid — real risk at 200+ items on lower-end phones; zero length validation on free-text fields; Home's zero-state still renders "0 cans in your vault" rather than dedicated first-run messaging.

## Minor Observations
- Home's hero Collection Score uses `font-body` (Exo 2) rather than `font-mono`, a minor inconsistency with the app's own stats/data typography convention — debatable, since it's a hero display number rather than a tile stat
- `Scan.jsx` has two separate "add manually" entry points — mild redundancy for the same action
- `StatsRow.jsx` and `EmptyState.jsx` remain fully generic template components with no can-specific illustration or copy
- Status semantics (Duplicate vs Wishlist vs Collected) and achievement-unlock criteria are still never explained anywhere in the UI

## Questions to Consider
1. If the product thesis is "log a can at the point of acquisition," why does the happy path force navigation away from Scan after every single item instead of looping back?
2. RarityReveal is genuinely excellent but reserved for ~20-30% of pulls — what makes logging can #180, a plain Common, feel like more than data entry?
3. A vote locks permanently the instant it's cast — why does that decision carry the same visual weight as picking a background color?
