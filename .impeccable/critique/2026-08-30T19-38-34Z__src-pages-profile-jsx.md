---
target: src/pages/Profile.jsx
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-30T19-38-34Z
slug: src-pages-profile-jsx
---
Method: dual-agent (A: a41c2826e94dafb05 · B: ae27993c774a5c216)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Solid skeletons/spinners; rank badge has no explicit loading indicator |
| 2 | Match System / Real World | 4 | Strong domain vocabulary — Top Pulls, Rare Pulls, Scan Your First Can |
| 3 | User Control and Freedom | 3 | Good escape hatches (Esc/Cancel, Android back-button in ShareCardModal); no confirm on Log Out |
| 4 | Consistency and Standards | 2 | Three independently hardcoded rarity color maps (Profile.jsx, ShareCardModal.jsx, TradeHistory.jsx) |
| 5 | Error Prevention | 2 | Trade delete has ConfirmDialog; the equally consequential Log Out has none |
| 6 | Recognition Rather Than Recall | 3 | Score popover and image chips in trade picker reduce recall burden |
| 7 | Flexibility and Efficiency | 2 | Trade templates are a real shortcut; Top Pulls showcase is 100% auto-sorted, no manual curation |
| 8 | Aesthetic and Minimalist Design | 3 | Cohesive neon-cyan/mono theme; Score hero and Top Pulls hero are near-identical stacked gradient cards |
| 9 | Error Recovery | 3 | Specific toasts with real error text; Regenerate escape hatch in ShareCardModal |
| 10 | Help and Documentation | 1 | Only Score has an explainer popover; rarity confidence/consensus logic is undocumented in-UI |
| **Total** | | **26/40** | **Acceptable (65%)** |

## Design Specificity Verdict

**LLM assessment**: The content is genuinely product-specific — rarity tiers, Top Pulls, score-by-rarity math, an Instagram share flow for a physical collectible, trade logging between collectors. But the composition is still a stock account-page skeleton (avatar+name → stats grid → button stack → settings → logout) with domain flavor layered on top, rather than a structure built around bragging rights from the ground up.

**Deterministic scan**: Zero findings across all six files (Profile.jsx + ShareCardModal.jsx + TradeHistory.jsx + TradeLogDialog.jsx + StatBox.jsx + useCollectionHighlights.js), exit code 0 — genuine clean result.

**Convergence worth flagging**: the detector found nothing, but Assessment B's own manual secondary pass caught one real gap the detector missed — ShareCardModal.jsx's modal close button (`X`, line ~270) has no `aria-label`, while every other icon-only button across these six files correctly does. That's a likely detector false negative against the codebase's own enforced convention, not a false alarm.

## Overall Impression

Cognitive load checklist: 3 of 8 items fail (single focus, chunking, minimal choices — 5 co-equal action buttons exceeds the 4-item guideline), landing at "moderate" load: the page tries to be identity card + dashboard + settings + social feed all in one scroll. Emotional journey: the peak (Score hero, Top Pulls showcase) is front-loaded near the top, but the page continues past it into a flat action-button stack, Settings, Log Out, then Trade History — which for most users renders "No trades logged yet." A page whose entire purpose is competitive bragging rights currently ends on absence and a sign-out button, which works against peak-end sequencing.

Biggest opportunity: the structural issues from the original critique (subordinated Score, buried showcase, unlabeled buttons, no path for zero-collection users, overlapping share actions) are confirmed fixed. What's left is a layer beneath that — three independently-drifting rarity color definitions, no confirm on a destructive-ish action (Log Out), and a page order that still trails off after its own emotional peak instead of closing on it.

## What's Working

1. **`useCollectionHighlights.js`** — extracted specifically because Profile's and ShareCardModal's `getEffectiveRarity` had silently diverged; real engineering discipline preventing live-page/share-card mismatch.
2. **ShareCardModal's Android back-button handling** (`popstate`/`pushState`) — a genuine mobile-specific touch most web apps skip.
3. **The Score popover** — explains an opaque number on demand instead of forcing memorization, and cross-links to the Ranks page.

## Priority Issues

**[P1] ShareCardModal's modal-close button has no aria-label, breaking the codebase's own established convention.**
Why it matters: every other icon-only button across Profile.jsx, TradeHistory.jsx, and TradeLogDialog.jsx carries `aria-label` (the exact pattern this project's own accessibility pass fixed everywhere else this session) — this one in ShareCardModal.jsx was outside that pass's stated scope and was missed. A screen reader announces it as a bare, unlabeled button on the modal a user is most likely to open right after a first "flex-worthy" pull.
Fix: add `aria-label="Close"` to the `X` button at the top of ShareCardModal.
Suggested command: /impeccable audit

**[P1] Three independently hardcoded rarity color maps will drift.**
Why it matters: Profile.jsx (`RARITY_BAR_CLASS`), ShareCardModal.jsx (`RARITY_BG`/`RARITY_COLORS_HEX`), and TradeHistory.jsx (`RARITY_COLORS`) each define their own palette. The share card — the artifact users actually post publicly — is the one most likely to silently diverge from the live app's colors as the palette evolves.
Fix: centralize into one exported token map consumed by all three.
Suggested command: /impeccable harden

**[P1] No confirmation before Log Out.**
Why it matters: a single tap signs the user out, while the far less consequential trade-delete goes through a ConfirmDialog.
Fix: reuse the existing `ConfirmDialog` component for sign-out.
Suggested command: /impeccable harden

**[P2] Page order still trails off after its own emotional peak.**
Why it matters: the scroll ends on Settings → Log Out → an empty Trade History state rather than closing on the Score/Top Pulls peak, for a page whose stated purpose is bragging rights.
Fix: reorder Trade History above the utility tier, or add a closing share CTA near the showcase.
Suggested command: /impeccable layout

**[P2] No manual curation of the Top Pulls showcase.**
Why it matters: `useCollectionHighlights.js` sorts strictly by rarity rank with no tiebreak or pin/reorder option — a collector with several Legendary cans can't choose which ones represent them publicly.
Fix: allow pinning/reordering the showcased cans.
Suggested command: /impeccable shape

## Persona Red Flags

**Sam (Accessibility-Dependent)**: ShareCardModal's close `X` (no aria-label) and the rarity breakdown bar (`Profile.jsx`, the 1.5px strip) convey rarity by color alone with no pattern/label redundancy.

**Casey (Distracted Mobile User)**: Log Out is a same-width, same-style ghost button directly under Settings, distinguished only by red text, with no confirm step to catch a scroll-tap slip. TradeCard's delete button sits tight against the three status-toggle buttons in one row.

**Alex (Power User)**: Can't pin/curate the auto-sorted Top Pulls showcase; the Score popover states Common=1, Legendary=5 but never discloses Uncommon/Rare/Ultra Rare point values, so a competitive user can't reverse-engineer their own score.

## Minor Observations

- ShareCardModal re-fetches `user-collection`/`shared-cans`/`my-votes` independently instead of receiving them as props from Profile.jsx, which already has them.
- StatBox's `glow` prop is applied only to Favourites with no evident product rationale.
- `useCollectionHighlights.js`'s latest-achievement fallback can surface a stale/arbitrary badge when no unlocked achievement has a date.
- Region field (📍 emoji) has no visible edit affordance next to a name field that clearly does, and is the one non-Lucide icon in an otherwise consistent icon language.

## Questions to Consider

1. Who owns keeping three independently-hardcoded rarity palettes in sync as new rarities or theme tweaks are added?
2. Should this page close on its own emotional peak (Score/showcase) instead of trailing into Settings/Log Out/an empty trade list?
3. Is fully-automatic showcase curation an acceptable trade-off for simplicity, or does a competitive collecting app need to let users choose what represents them?
