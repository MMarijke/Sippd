---
target: "discovery flow: Wishlist, MostWanted, CompareCollection, MonthlyReport"
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-28T10-11-01Z
slug: ishlist-mostwanted-comparecollection-monthlyreport
---
Method: dual-agent (A: design-review sub-agent · B: detector sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | MostWanted has no page title or header at all |
| 2 | Match Between System / Real World | 2/4 | "Most Wanted" never states it's ranked by community favourites |
| 3 | User Control and Freedom | 1/4 | MostWanted has no back affordance; wishlist delete has no undo |
| 4 | Consistency and Standards | 1/4 | A shared `EmptyState` component exists but is used in exactly one place app-wide; these 4 screens each hand-roll their own |
| 5 | Error Prevention | 1/4 | No confirm on wishlist delete; CompareCollection has zero guard for a missing comparison target |
| 6 | Recognition Rather Than Recall | 3/4 | Shared can/rarity components keep visual language consistent |
| 7 | Flexibility and Efficiency of Use | 1/4 | No way to switch comparison target from within Compare Collection itself |
| 8 | Aesthetic and Minimalist Design | 3/4 | Clean, uncluttered layouts throughout |
| 9 | Error Recovery | 1/4 | No error state anywhere in this flow for a failed query — only mutations show toasts |
| 10 | Help and Documentation | 1/4 | Nothing explains what Most Wanted ranks by or what Compare Collection is for |
| **Total** | | **16/40** | **Poor — major UX overhaul required; core experience broken** |

## Design Specificity Verdict

**LLM assessment**: Split cleanly down the middle. `MostWanted.jsx`'s medal-colored ranked list is a genuine expression of the competitive identity. Everything else is a well-skinned but structurally generic template: `RecommendedCans.jsx` is a stock e-commerce carousel, `CompareCollection.jsx` is a generic two-set-diff UI that would work unchanged for comparing Steam libraries, and `MonthlyReport.jsx` is the textbook "Spotify Wrapped" recap pattern with can-collecting nouns dropped in. The neon-vault palette and rarity tokens buy visual coherence but not structural specificity.

**Deterministic scan**: Clean, with the now-established `.jsx` coverage caveat (Assessment B re-verified the detector engine itself works correctly via a fresh synthetic-file test, not just repeating the prior claim).

## Overall Impression

This is the lowest score of the three flows reviewed (16/40, vs. 30/40 core and 17/40 social) — and the top finding is genuinely striking: **MostWanted is a fully built, fully functional feature with zero entry points anywhere in the app.** I verified this directly: it's the only occurrence of `/most-wanted` in the entire `src/` tree outside its own route declaration, and the component itself renders no header, title, or back button — a user who somehow lands there (stale link, typed URL) has no way to know what screen they're on or how to leave except OS back. This isn't a design opinion; it's a shipped feature nobody can find.

## What's Working
- **`MostWanted.jsx`'s medal coloring** — gold/silver/bronze borders and numerals genuinely make this feel like a leaderboard, reinforcing the competitive positioning
- **`RecommendedCans.jsx` returns `null` when there's nothing to recommend** rather than showing an awkward empty state — the right call for a secondary feature
- **Shared `CanImageBox`/`RarityBadge` reuse across all 4 screens** produces real coherence for the specific job of showing a can and its rarity

## Priority Issues

**[P0] Verified: MostWanted has zero entry points anywhere in the app** — `App.jsx:49` routes `/most-wanted`, but that's the *only* occurrence of the string in `src/` — confirmed via repo-wide search. [MostWanted.jsx](src/pages/MostWanted.jsx) itself renders no `PageHeader`, no title, no back button — content starts immediately at the top of the page. A fully working feature (ranked community favourites, tap-to-wishlist, tap-to-view) that no real user can discover or navigate out of.

**[P0] Verified: wishlist delete has no confirmation or undo** — `Wishlist.jsx:110-122`'s `removeFromWishlist` fires an immediate DELETE with only a toast as feedback, no confirm, no undo action. The delete button sits 6px from the "move to collection" button, both ~32px — a mis-tap permanently erases a wishlist entry a collector may have tracked for months.

**[P1] Verified: CompareCollection has no guard for a missing comparison target** — `CompareCollection.jsx:20-21,32,60` reads `friendId` from a URL param with no validation; when absent, both friend queries are just quietly disabled and resolve to empty/fallback data. The page then renders a full, confident-looking comparison UI — stats, tabs, "Friend has no exclusive cans" — that looks identical to a real comparison against a collector who owns zero cans. Nothing distinguishes "no one was selected" from "your friend's vault is empty."

**[P1] No screen in this flow explains its own purpose to a first-timer** — Most Wanted never states it's ranked by community favourites; Compare Collection never explains what it shows or how to start a new comparison. Both are inferred purely from visual convention.

**[P2] Green/red comparison coloring frames "losing" as a problem with no reframing** — `CompareCollection.jsx`'s "Only Theirs" cards render in red, "Only Mine" in green — literal loss/gain language on a status-sensitive, ego-adjacent screen, with no combined score or positive framing (e.g. "3 cans left to complete the overlap") to soften a lopsided result.

## Persona Red Flags

**Casey (mobile)**: Wishlist's 32px move/remove buttons sit 6px apart, one destructive with no confirm; MonthlyReport's back button is 36px versus 44px used elsewhere in the same file; MostWanted has no back button at all.

**Riley (stress test)**: hitting `/compare` with no `with` param renders a fully-populated-looking but semantically broken UI; MostWanted's ranked list is capped only by `limit(500)` with no pagination, despite framing itself as a leaderboard.

**Jordan (first-timer)**: can't tell what "most wanted" or "compare" actually mean without inferring from visual convention; Compare Collection is only reachable via a button buried in someone else's PublicProfile, so a first-timer has no way to know it exists.

## Minor Observations
- `MonthlyReport.jsx`'s share flow falls back to a blocking `alert()` (L129) — jarring in an app that uses `sonner` toasts everywhere else
- A shared `EmptyState.jsx` component exists but is used in exactly one place codebase-wide; these 4 screens hand-roll 4 different empty states with different icon sizes and inconsistent CTAs
- `RecommendedCans.jsx` requires the user to already have collected cans from a brand before any recommendation appears — a brand-new collector with only wishlist items never sees recommendations, which may be intentional but is undocumented

## Questions to Consider
1. Was MostWanted deliberately pulled from navigation and never reconnected, or has this feature never actually been reachable by a real user?
2. Is red/green "mine vs theirs" the right tone for a social-competitive app, or does it risk making Compare Collection a screen people avoid using with friends they've already "beaten"?
3. `EmptyState.jsx` exists and is used once — was hand-rolling four more empty states intentional per-screen customization, or drift?
