---
target: "utility flow: Settings, Notifications, PublicProfile, Achievements"
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-28T10-21-30Z
slug: settings-notifications-publicprofile-achievements
---
Method: dual-agent (A: design-review sub-agent · B: detector sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | PublicProfile/Achievements never distinguish "loading" from "failed" |
| 2 | Match Between System / Real World | 3/4 | Copy and achievement vernacular fit the audience well |
| 3 | User Control and Freedom | 2/4 | PublicProfile has no back button and sits outside the app shell entirely |
| 4 | Consistency and Standards | 2/4 | Achievement-unlock gold palette breaks from the app's own rarity color system; custom toggles reinvent existing primitives |
| 5 | Error Prevention | 1/4 | Account deletion is the highest-stakes action in the app and is entirely stubbed |
| 6 | Recognition Rather Than Recall | 3/4 | Locked achievements show description + live progress, not just a padlock |
| 7 | Flexibility and Efficiency of Use | 2/4 | No batch actions in Notifications, acceptable at current scale |
| 8 | Aesthetic and Minimalist Design | 3/4 | Clean card/row grouping throughout |
| 9 | Error Recovery | 1/4 | Notifications' mutations have zero `onError` — a failed accept/decline fails completely silently |
| 10 | Help and Documentation | 2/4 | Achievement descriptions double as help; nothing else explains itself |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment**: Split along the expected line. Settings and Notifications are appropriately generic Operate-mode utility screens — that's the correct choice here, not a flaw. Achievements is where specificity should matter most and it's mixed: the achievement definitions themselves are well-grounded in the product, but the unlock celebration reaches for a generic gold/trophy palette instead of the app's own established rarity color system. PublicProfile is the strongest of the four — rarity pie chart, Collection Score, trade/compare CTAs are all genuinely Sippd-native.

**Deterministic scan**: Clean, with the same `.jsx` coverage caveat re-confirmed a fourth time via a fresh synthetic-file test.

## Overall Impression

The visual layer here is solid — this flow's problems are almost entirely about error handling and one architectural gap, not aesthetics. I verified the two most serious claims directly: **account deletion is fully stubbed** (a permanently-disabled button, "coming soon" copy, explicitly marked `// stubbed — Prompt 0.8` in the code) despite PRODUCT.md stating server-side cascade deletion as a binding architectural constraint — and **PublicProfile has zero navigation chrome**, confirmed: its header is a static logo block with no back button, and the route sits outside the app shell (no BottomNav either), so a user who taps into a locked stranger's profile has no way out except OS back.

**On account deletion specifically**: this is categorically different from everything else fixed this session. Every other fix has been a client-side React/Tailwind change. A real fix here means a new Supabase Edge Function using the Auth Admin API with a full cascade across many tables (follows, notifications, reactions, trades, crates, votes) — it needs `service_role` access I don't have, and PRODUCT.md itself notes edge functions require an explicit deploy step, never automatic. I'm flagging this clearly rather than either quietly skipping it or attempting a partial/unsafe version of it.

## What's Working
- **`AchievementBadge.jsx`** — locked achievements show title, description, and a live progress fraction, not just a padlock. Directly answers "how do I unlock this."
- **`ChangePasswordPanel` in Settings.jsx** — re-verifies the current password via `signInWithPassword` before allowing a change, with a comment explaining why `updateUser()` alone isn't sufficient. Real security reasoning, not just a client-side check.
- **PublicProfile's privacy gating** — a locked account gets a clean, on-brand "Private Account" state rather than a broken or half-rendered page.

## Priority Issues

**[P0] Verified: account deletion is entirely stubbed, contradicting PRODUCT.md's own stated architecture** — `Settings.jsx:148-167`, a permanently-disabled button behind "Account deletion will be available soon." PRODUCT.md states account deletion must be "server-side via the Auth Admin API with full cascade + array sweeps." No corresponding edge function exists in the repo. **Flagging for your decision, not silently building it** — this needs `service_role` access and a dedicated session to design the cascade correctly across every table a user's data touches.

**[P0] Verified: PublicProfile has no way back** — `PublicProfile.jsx:154-163`, the header is a static Sippd wordmark with zero back button, and `/u/:userId` sits outside `AppLayout` in `App.jsx` (no BottomNav either). A user tapping into a profile from Feed or Leaderboard lands with zero navigation elements.

**[P1] Verified: Notifications' mutations fail completely silently** — zero `toast` import anywhere in `Notifications.jsx`, and none of `markAllRead`, `handleFollowRequest`, `handleTradeRequest` define `onError`. A failed trade-accept during a flaky connection produces no error, no reverted UI, nothing — directly contradicts PRODUCT.md's own "every mutation needs real onError handling" principle.

**[P1] Verified: toggle switches and unread status have no accessible state** — `Settings.jsx:312-323,334-346`'s privacy/notification toggles are plain buttons with no `role="switch"`/`aria-checked`; `Notifications.jsx`'s unread indicator is a bare colored dot with no text equivalent. A screen reader announces "button" with no state.

**[P2] PublicProfile conflates "not found" with "failed to load"** — no `isError` branch on its queries, so a transient network failure shows the same "Profile not found" as a genuinely nonexistent user, with no retry.

## Persona Red Flags

**Sam (accessibility)**: toggle switches convey state only via position/color, no ARIA; the rarity/status chip row has no `aria-pressed`, so a screen reader can't tell which chip is selected.

**Riley (stress test)**: killing the network mid-load on a stranger's profile produces a false "doesn't exist" instead of a retry state; a failed trade-accept gives zero feedback that anything happened.

**Jordan (first-timer)**: actually well-served by Achievements — every locked badge shows a real path forward. The one gap: "Default Rarity Vote" in Settings has no explanation of where that default actually applies elsewhere in the app.

## Minor Observations
- Achievements keeps BottomNav visible *and* shows its own back-chevron to Profile — redundant double-navigation, though harmless
- Achievement-unlock animation uses gold/amber, not matching any tier in the app's own rarity palette — likely a deliberate "celebration ≠ rarity" distinction rather than a bug, left as-is
- Settings' Email row is wrapped in a no-op `onClick={() => {}}` — looks interactive (cursor, hover) but does nothing
- Settings' back button is 36px, inconsistent with the 44px convention established elsewhere

## Questions to Consider
1. If deletion is stubbed and hidden behind a permanently-disabled button, what does that communicate to a user who genuinely wants to leave — is a fake "coming soon" better or worse than not showing the section at all?
2. Was PublicProfile's missing back button and nav-shell exclusion an intentional "focus mode," or did it fall through the cracks when the pattern was set for the other screens?
3. Was the achievement-unlock gold palette a deliberate choice to keep "celebration" visually distinct from "rarity," or an unexamined default?
