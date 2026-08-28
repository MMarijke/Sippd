---
target: "social flow: Profile, Leaderboard, Feed, Crates"
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-28T09-47-17Z
slug: social-flow-profile-leaderboard-feed-crates
---
Method: dual-agent (A: design-review sub-agent · B: detector sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | No loading/error state on crate mutations; a failed save just silently does nothing |
| 2 | Match Between System / Real World | 3/4 | Collector terminology lands well; "Score" and the two leaderboard tabs are never explained |
| 3 | User Control and Freedom | 1/4 | Crate delete and trade delete both fire immediately with zero confirmation |
| 4 | Consistency and Standards | 3/4 | Tab-toggle pattern reused well; two different implementations of the same visual tab, and Crates skips the shared PageHeader entirely |
| 5 | Error Prevention | 1/4 | No confirm step anywhere on irreversible actions in this flow |
| 6 | Recognition Rather Than Recall | 2/4 | Leaderboard shows only the top 50 with no persistent "your rank" indicator |
| 7 | Flexibility and Efficiency of Use | 1/4 | No bulk crate actions, no jump-to-my-rank, despite this being the power-user audience |
| 8 | Aesthetic and Minimalist Design | 3/4 | Clean density per screen; loses a point to template sameness, not clutter |
| 9 | Error Recovery | 1/4 | Most mutations in this flow have no `onError` — failures are silent, contradicting the project's own stated principle |
| 10 | Help and Documentation | 0/4 | Nothing anywhere explains how Score or rank is calculated |
| **Total** | | **17/40** | **Poor — major UX overhaul required; core experience broken** |

## Design Specificity Verdict

**LLM assessment**: Functionally complete but generic underneath the neon-vault color skin. Strip the palette and emoji and every screen is a stock template — `CollectorsLeaderboard.jsx` is a textbook ranked-row list, `ActivityCard.jsx` is a generic avatar+name+timestamp+reactions social card, `CrateCard.jsx` is a generic folder/playlist card. None of the four screens have a composition or interaction that says "energy-drink-can collecting" specifically. Rarity color coding (`RarityBadge`, `RARITY_HEX`) exists elsewhere in the app but is completely absent from the leaderboard and feed reaction rows — the one screen built entirely around competition doesn't use the game's own rarity visual language at all. Given PRODUCT.md names this flow the product's differentiator, it should be doing more work than a relabeled generic template.

**Deterministic scan**: Clean — zero findings, but Assessment B did real due diligence this run rather than taking that at face value: it built synthetic test files to confirm the detector engine works correctly on kebab-case CSS (fired correctly) but does *not* recognize this codebase's dominant camelCase inline-style idiom (`style={{ fontFamily: ... }}`) — confirmed with a direct side-by-side test. The clean result reflects a real coverage gap in the tooling on this codebase's syntax, not an absence of issues.

**Visual overlays**: Not available — no browser tool exposed this session.

## Overall Impression

This is a meaningfully worse result than the core flow (17/40 vs. 30/40) — and the reasons are concrete, not aesthetic taste. Two things stand out: destructive actions (deleting a crate, deleting a trade) fire with zero confirmation, and most mutations in this flow have no error handling at all, so a failed save just silently does nothing while the UI has already optimistically shown success. Both are real defects, not judgment calls — this is very likely a meaningful part of what's behind "I don't know if I like the UX/UI." Underneath that, the flow that's supposed to be the product's stated differentiator (social + competitive) currently reads as the most generic part of the app, and two of its four screens (Feed, Crates) aren't reachable from the bottom nav at all.

## What's Working
- **`PageHeader.jsx`'s notification bell** — correctly implemented, `aria-label` with exact unread count, capped at "9+", consistent everywhere it's actually used
- **`PublicProfile.jsx`'s privacy gate** — a locked private account gets a clear icon + explanation + implicit follow path, not a raw blank screen or error
- **`CollectorsLeaderboard.jsx`'s "you" row highlighting** — `bg-primary/5 border-l-2 border-primary` plus an explicit "(you)" label is a genuinely useful piece of self-orientation in an otherwise generic list

## Priority Issues

**[P0] Verified: destructive actions have no confirmation anywhere in this flow** — [Crates.jsx:120](src/pages/Crates.jsx#L120) wires a 24×24px trash icon ([CrateCard.jsx:25-30](src/components/crates/CrateCard.jsx#L25-L30)) directly to `deleteMutation.mutate(crate.id)` with zero "Are you sure?" step — one mis-tap permanently deletes a crate. [TradeHistory.jsx:135](src/components/profile/TradeHistory.jsx#L135) does the same for trade records. *Suggested: `/impeccable harden`*

**[P0] Verified: silent mutation failures contradict the project's own stated principle** — `CrateFormDialog.jsx`, [CrateDetailSheet.jsx:36-45](src/components/crates/CrateDetailSheet.jsx#L36-L45) (`updateCrate`), and `Crates.jsx`'s `deleteMutation` all have `onSuccess` but no `onError`. Worse: [CrateDetailSheet.jsx:49,56](src/components/crates/CrateDetailSheet.jsx#L49) mutate the `crate` prop object directly ("optimistic local update") *before* the network call resolves — on failure there's no rollback and no error toast, so the UI shows a can as added/removed that the server never persisted. PRODUCT.md itself states "every mutation needs real onError handling with user-visible feedback." *Suggested: `/impeccable harden`*

**[P1] Verified: no "your rank" outside the top 50, and unranked users vanish entirely** — [CollectorsLeaderboard.jsx:25](src/components/leaderboard/CollectorsLeaderboard.jsx#L25) hard-limits to 50 rows, and [line 33](src/components/leaderboard/CollectorsLeaderboard.jsx#L33) filters out anyone with `total_cans === 0`. On a screen built entirely around competition, most users — everyone outside the top 50, and every brand-new collector — never see themselves represented at all. *Suggested: `/impeccable harden`*

**[P1] No explanation of the scoring/ranking mechanic anywhere** — neither `Profile.jsx` (raw `Score: {score}`) nor the leaderboard explain what Score measures, how Rare Pulls differs from Total Cans, or why the two leaderboard tabs reorder the list differently. *Suggested: `/impeccable onboard`*

**[P2] Feed and Crates are undiscoverable** — `BottomNav.jsx` covers only Vault/Scan/Haul/Ranks/Profile; Feed and Crates have no nav entry. Feed's own empty-state CTA even routes to `/leaderboard`, not back into Feed. A distracted mobile user is unlikely to find either screen organically. *Suggested: `/impeccable clarify`*

**[P3] Rarity color language is absent from the one screen built around competition** — `RarityBadge`/`RARITY_HEX` color-codes rarity in the Feed and elsewhere, but `CollectorsLeaderboard.jsx` shows plain numbers with no rarity-tier color despite "Rare Pulls" being a sort mode. *Suggested: `/impeccable colorize`*

## Persona Red Flags

**Casey (mobile)**: the 24×24px crate edit/delete icons sit directly adjacent to each other, both under any reasonable touch-target floor, one tap from irreversible loss — and notably, `TradeLogDialog`/`ShareCardModal`/`Profile.jsx`'s own edit controls correctly use 44px elsewhere, so this is an outlier, not the norm. Feed and Crates also have no fast path from the bottom nav for a one-handed, in-the-moment user.

**Alex (power user)**: cannot see their own rank if outside the top 50 — the single most power-user-relevant piece of information is unavailable to most of the actual audience. No bulk crate management (add-one-at-a-time only), despite a rarity sort already existing in the same component that a bulk "add all Rare cans" action could reuse.

**Jordan (first-timer)**: lands on an empty profile (all stats show 0) with no context, then a populated leaderboard of 50 strangers with zero explanation of the mechanic — comparison anxiety with no onboarding cushion. By contrast, the empty-crates state (`Crates.jsx`) is genuinely well done — clear icon, concrete examples, a CTA — worth using as the template for the other three screens.

## Minor Observations
- Every profile avatar is just a single initial letter — no photo path, so every collector looks identical except color/letter
- Feed's reaction buttons show a raw count with no indication of who reacted
- `Crates.jsx` builds its own header from scratch instead of the shared `PageHeader` — it's the one screen in this flow missing the notification bell
- `PublicProfile.jsx` has a dangling `TODO` about global rank being unavailable — an acknowledged but unresolved version of the P1 above

## Questions to Consider
1. If the stated differentiator is "social + competitive," why are Feed and Crates — the two screens carrying that half of the claim — the two missing from primary navigation?
2. What does a collector ranked #312 actually see today when they open Ranks? Has this app been tested as a low-rank account, or only ever as a top-3 seed account?
3. `RarityBadge`/`RARITY_HEX` already exist and are used elsewhere — why doesn't the leaderboard, the one screen built entirely around competition, use the game's own rarity visual language at all?
