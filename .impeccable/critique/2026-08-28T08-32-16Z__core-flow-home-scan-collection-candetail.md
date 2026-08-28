---
target: "core flow: Home, Scan, Collection, CanDetail"
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-28T08-32-16Z
slug: core-flow-home-scan-collection-candetail
---
Method: dual-agent (A: design-review sub-agent · B: detector sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | Barcode scan gives zero feedback for ~2.4s while it silently chains OS deep-link attempts |
| 2 | Match Between System / Real World | 3/4 | Strong hobbyist vocabulary ("pull," "vault"), undercut by stiff "Cast Your Vote" copy |
| 3 | User Control and Freedom | 3/4 | Cancel/delete-confirm present throughout; no undo once a rarity vote is submitted |
| 4 | Consistency and Standards | 2/4 | The app calls itself "CANVOLT" and "Sippd" in different screens |
| 5 | Error Prevention | 3/4 | Required-field validation, digit-only barcode input, delete confirmation all present |
| 6 | Recognition Rather Than Recall | 2/4 | FAB's long-press menu has no visual affordance; readOnly fields signaled only by opacity |
| 7 | Flexibility and Efficiency of Use | 1/4 | No bulk actions, no "log another" quick-repeat path, no keyboard shortcuts |
| 8 | Aesthetic and Minimalist Design | 3/4 | Strong dark neon-vault system, undercut by typo'd Tailwind classes and a duplicated stat |
| 9 | Error Recovery | 3/4 | Toasts present on mutations; image-upload failure gives no reason or retry path |
| 10 | Help and Documentation | 1/4 | Zero explanation anywhere of the central rarity-consensus mechanic |
| **Total** | | **23/40** | **Acceptable — significant improvements needed before users are happy** |

## Design Specificity Verdict

**LLM assessment**: Mixed. The vocabulary ("Vault," "Haul," "Pull"), the crowd-sourced rarity-consensus mechanic with confidence tiers (`src/lib/rarityConsensus.js`), and the tier-gated `RarityReveal.jsx` payoff animation are genuinely product-specific — they'd read wrong if relabeled for a sneaker or vinyl tracker. But the structural scaffolding underneath — `EmptyState.jsx` (generic icon+title+description+CTA), `StatBox.jsx` (generic icon+number+label tile), the Monthly Report CTA card (generic icon-circle+title+chevron) — is interchangeable dashboard-template boilerplate any list-based tracker could reuse unchanged. The product differentiates itself more through mechanics and copy than through visual composition.

**Deterministic scan**: Clean. `detect.mjs` ran against all 10 target paths (`src/pages/{Home,Scan,Collection,CanDetail}.jsx` plus their component directories) and returned zero findings, verified against a false "clean" reading by re-running in isolation against a known-populated target. This doesn't contradict the LLM's genericness finding above — the detector catches mechanical slop patterns (banned scaffolds, overused fonts, etc.), not compositional interchangeability, and it correctly found none of those here.

**Visual overlays**: Not available. No browser automation tool was exposed in this session, so no live render, screenshot, or in-page overlay was possible. Both assessments worked from source code only (JSX structure + Tailwind classes) — treat layout/spacing conclusions as inferred, not observed.

## Overall Impression

The product has a real, distinctive mechanic (crowd-consensus rarity voting) and a coherent dark neon-vault visual identity — this isn't a generic wrapper. But the flow that's supposed to be the app's entire reason to exist, in-the-moment barcode scanning, is functionally broken for most phones, and the app's name is inconsistent with itself on the single screen every user sees every session. Those two issues alone would explain real user drop-off independent of anything else in this report. The biggest opportunity: fix the two P0s first — they're isolated, mechanical fixes, not design-taste decisions — then use the freed-up trust to address the deeper issue that the app's most distinctive mechanic (rarity consensus) is never explained to the people using it.

## What's Working

- **`src/lib/rarityConsensus.js`** — weighted-mean crowd consensus with `unrated/low/confirmed` confidence tiers, surfaced consistently in `AddCanForm.jsx` ("Community says…"), `CanDetail.jsx` (vote breakdown bars), and `CanCard.jsx` ("Low Conf."/"Unrated" badges). A real, non-generic mechanic that reinforces the social/competitive positioning PRODUCT.md claims.
- **`src/components/scan/RarityReveal.jsx`** — a dedicated celebratory animation triggered only for Rare+ pulls, correctly reserving the payoff moment for outcomes that deserve it rather than celebrating every add identically.
- **`AddCanForm.jsx`'s readOnly field locking** — when editing against an existing `shared_cans` record, name/brand/flavour/edition lock while still allowing a vote, protecting the shared canonical dataset from per-user drift. A data-integrity-aware choice appropriate to a crowd-sourced database.

## Priority Issues

**[P0] Barcode scan — the app's flagship "point of acquisition" action — is broken for most users and references a nonexistent control**
- **Why it matters**: PRODUCT.md frames Scan as the core, in-the-moment action. `BarcodeScanner.jsx` fires `googlechrome://navigate?...` then `bixbyvision://barcode` deep links sequentially (verified: lines 11-16, ~2.4s total dead air across both `setTimeout` calls) before falling back to a web scanner link — a path that only ever half-works on Chrome/Samsung Android and silently fails elsewhere (most iOS users). Worse, the button's own caption says "copy the barcode number and tap 'Paste Barcode' below" (line 49) — verified via full-repo search: no "Paste Barcode" control exists anywhere in the codebase. The instruction points at nothing.
- **Fix**: Replace with a real in-page camera-based barcode reader (e.g. a JS barcode-detection library), or at minimum remove the dead "Paste Barcode" instruction and route it to the existing manual-search field that already exists on `Scan.jsx`.
- **Suggested command**: `/impeccable harden`

**[P0] Incomplete rebrand — "CANVOLT" still visible on the most-seen screen in the app and in outbound share text**
- **Why it matters**: Verified directly: `Home.jsx:97` has `title="CANVOLT"` — the dashboard header shown every single session. `MonthlyReport.jsx:124-126` puts "Canvolt" into the native `navigator.share` title and body text. `achievements.js:33` has an achievement description reading "Join Canvolt in its first year." PRODUCT.md states this rename was already fixed — it wasn't, in the highest-visibility spot in the product. This is a social/competitive app whose value depends on shareable, credible profile and report screenshots; a second brand name leaking into an outbound share sheet actively undermines that. (Two more instances — `canvolt_unlocked_achievements` and `canvolt_prefs` localStorage keys — are internal-only, not user-visible, and lower priority to fix.)
- **Fix**: Replace `title="CANVOLT"` in `Home.jsx:97` with `"Sippd"`, and fix the two "Canvolt" strings in `MonthlyReport.jsx` and one in `achievements.js`.
- **Suggested command**: `/impeccable harden`

**[P1] No in-app explanation of the app's central mechanic**
- **Why it matters**: The rarity-consensus system (5-vote threshold, `unrated → low → confirmed` confidence tiers, locked votes) is the single most distinctive thing about this product per the specificity verdict above — and also the most confusing without context. `AddCanForm.jsx` and `CanDetail.jsx` both surface "Community says," vote counts, and confidence badges with no info icon, tooltip, or first-use explainer anywhere. A new user has no way to learn why they can't change a submitted vote or what "confirmed" means.
- **Fix**: Add one info-icon/bottom-sheet on the "Community Rarity" card explaining the mechanic once; consider surfacing it contextually the first time a user encounters an "unrated" or "low confidence" can.
- **Suggested command**: `/impeccable onboard`

**[P1] Redundant navigation to the same destination in the same thumb zone, with an invisible gesture**
- **Why it matters**: On Home, `QuickAccessFAB.jsx`'s single-tap action navigates to `/scan` (line 42) — the exact destination `BottomNav`'s "Scan" tab already provides. *(Correction to the sub-agent's spatial claim: I checked `BottomNav.jsx` directly — its "Scan" tab is the 2nd of 6 evenly-spaced items, left-of-center, not directly under the FAB's `bottom-24 right-4` position, so the two controls are not visually stacked. The redundancy is functional, not spatial.)* The FAB's only additional value is a long-press menu (Trade Requests / Scanner — and "Scanner" *again* duplicates the same `/scan` destination), triggered by a 400ms long-press with zero visual affordance (no dot, label, or hint) — a gesture most users will never discover.
- **Fix**: Either drop the FAB entirely on Home (BottomNav already covers Scan) and keep it only on other screens for the Trade Requests shortcut, or give the long-press affordance a visible cue.
- **Suggested command**: `/impeccable clarify`

**[P2] Duplicate Score display undermines Home's visual hierarchy**
- **Why it matters**: Verified directly: the same `score` value renders twice on one screen — once at `text-5xl` in the hero card (`Home.jsx:129-131`) and again seconds later as the 4th tile in `StatsRow` (`StatsRow.jsx:10`, `label="Score"`). Nothing distinguishes them as the same number; a glance-first mobile dashboard shouldn't make the user wonder if two visible numbers differ.
- **Fix**: Drop Score from `StatsRow` and use that slot for information not shown elsewhere (e.g. Wishlist count).
- **Suggested command**: `/impeccable layout`

**[P3] Typo'd Tailwind classes silently drop intended styling**
- **Why it matters**: Verified directly, all four in `Scan.jsx`: line 138 `front-mono` (should be `font-mono`) leaves the "Or search manually" divider in the wrong font; line 221 `muted-foregroumd/60` and line 233 `muted-forground/60` both misspell `muted-foreground`, rendering the "+ Add can manually" link and Open Food Facts attribution at full-strength text color instead of the intended subtle weight; line 173 `w-4 h4` (missing dash) leaves the fallback `Package` icon's height unconstrained next to a fixed 16px width, stretching it in "no image" search rows.
- **Fix**: Four one-character corrections.
- **Suggested command**: `/impeccable polish`

## Persona Red Flags

**Casey (Distracted Mobile User)**
- `BarcodeScanner.jsx` — the primary Scan CTA chains two OS-level custom-scheme redirects with zero loading feedback; on an iPhone this can surface a native "cannot open page" interruption before the 2.4s fallback even appears — a jarring first impression for a one-handed, in-the-moment user.
- Same file, line 49 — told to "tap 'Paste Barcode' below," a control that doesn't exist. Casey, can in one hand, phone in the other, hits a dead end holding a copied value with nowhere to paste it.
- `QuickAccessFAB.jsx`'s long-press menu (400ms hold) has no visual affordance at all — undiscoverable one-handed, on the move.

**Alex (Impatient Power User)**
- `Collection.jsx` has zero bulk-action affordances — no multi-select delete or bulk crate-move, despite "Duplicate" being a first-class status a serious collector will accumulate a lot of.
- On successful add, `Scan.jsx` navigates straight to `/collection` — no "log another" quick-repeat path, so logging five cans from one haul means five full round trips through scan → search/select → vote → submit → navigate away → back.
- The broken barcode path (see Casey) directly undermines the sub-60-second scan-and-log loop this persona needs most.

**Riley (Deliberate Stress Tester)**
- `Collection.jsx` queries the full `user_collection` table with no `.limit()`/pagination into an unwindowed grid — a real risk at 200+ items for the "serious collector" persona this product explicitly targets.
- Long can/brand names are handled defensively (`truncate` used consistently in `CanCard.jsx` and `CanListItem.jsx`) — no overflow bug found there.
- The empty state (`EmptyState.jsx`) works functionally but is the one generic, could-be-any-app component in an otherwise product-specific UI.

## Minor Observations

- ReadOnly-locked fields in `AddCanForm.jsx` are signaled only by 60% opacity — no lock icon or microcopy, so a user may tap in, try to type, and get silent non-feedback.
- `FilterBar.jsx` exposes 5 simultaneous controls (Status, Rarity, view toggle, Favourites, Sort) — mildly above the "≤4 per decision point" guidance, though each is fast to operate.
- `Login.jsx` correctly says "Sippd" — proof the rename was done in some places, which makes the leftover "Canvolt" instances read as an incomplete sweep rather than a deliberate choice.
- `RecentPulls.jsx` and `CanListItem.jsx` duplicate near-identical row markup (image box + name/brand + badge) — a shared row component would reduce future drift.

## Questions to Consider

1. If the flagship "Scan" action can't reliably scan anything in-page, is Scan actually the core loop, or is manual search quietly the real primary path — and should the UI be built around that truth instead?
2. A Common pull (the statistically most frequent outcome) gets a bare toast while Rare+ gets a full-screen celebration — is that intentional pacing, or does the 90% case need to feel less flat?
3. Given the whole pitch is social/competitive credibility (leaderboards, shareable reports, public profiles), how did "CANVOLT" survive on the one screen every user sees every session?
