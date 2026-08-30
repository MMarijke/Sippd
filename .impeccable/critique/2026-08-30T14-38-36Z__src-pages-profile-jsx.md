---
target: Profile page (src/pages/Profile.jsx)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-30T14-38-36Z
slug: src-pages-profile-jsx
---
Method: dual-agent (two isolated sub-agents ran in parallel, no shared context)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good skeletons; edit-save has no spinner; ShareCardModal's generating/saving states are strong |
| 2 | Match System / Real World | 3 | Score/Rare Pulls/Trade language fits the hobby; Info popover explains scoring in plain terms |
| 3 | User Control and Freedom | 3 | Name edit has cancel; modals have exits; trade status changes aren't confirm-gated but are reversible |
| 4 | Consistency and Standards | 3 | Button styling, mono labels, card treatment consistent throughout |
| 5 | Error Prevention | 3 | Trade submit disabled until valid; blank-name save silently no-ops with zero feedback |
| 6 | Recognition Rather Than Recall | 2 | Star reused for both Rare and Favourites; Trophy used for Wishlist (cans not yet owned) — icons don't disambiguate |
| 7 | Flexibility and Efficiency | 3 | Trade templates in TradeLogDialog are a real power-user affordance |
| 8 | Aesthetic and Minimalist Design | 2 | 5 equal-weight nav buttons; the page's most important number (Score) is styled as a small caption |
| 9 | Error Recovery | 3 | Toasts on mutation failures are specific; profile-fetch errors fail silently to a "Collector" fallback |
| 10 | Help and Documentation | 2 | Score has a real contextual-help popover — the only one; no equivalent for trade status or rarity tiers |
| **Total** | | **27/40** | **Acceptable (68%)** |

## Design Specificity Verdict

**LLM assessment**: The page shell — avatar circle, name + edit pencil, 4 stat tiles, a stack of nav buttons, then a list — is a generic account/profile template interchangeable with any app. What's Sippd-specific is a thin layer of domain vocabulary on top (rarity-weighted Score, Rare Pulls, Trade History's Give/Got chips). The one place the design fully commits to a can-collector identity — ShareCardModal's neon rarity-grid export card — is never shown on the page itself; it only exists off-screen, generated for image export.

**Deterministic scan**: Zero findings across all six files scanned (Profile.jsx + its five composed components), exit code 0. Verified as a genuine clean result, not a broken tool (working --help, no local config suppressing rules, real ruleset behind the wrapper). Not a contradiction of the P1/P2 issues below — the detector's ruleset targets mechanical anti-patterns, not holistic judgments like "does this feel generic" or "is Score visually subordinate to the button list."

**Convergence worth flagging**: the detector found nothing, but Assessment B's own manual read (done secondarily, while gathering evidence) independently landed on the same touch-target issue Assessment A flagged as P1 — and found three more instances of it. Two independently-run passes converged on one real pattern without coordinating.

## Overall Impression

Functionally solid and internally consistent, but emotionally flat for a screen whose entire purpose is bragging rights. The thing that would actually make a collector proud — the neon rarity-grid share card — is hidden behind an extra tap into a modal, while the page you land on by default buries the one competitively-meaningful number (Score) as a small caption beneath a wall of five look-alike buttons. Biggest opportunity: make the artifact currently reserved for Instagram export be the thing the user sees on their own profile.

## What's Working

1. **The Score info popover** — well-placed contextual help answering exactly the question a competitive collector would ask ("why is my number what it is"), without cluttering the main view.
2. **ShareCardModal's generated card** — cyan glow, rarity-color-coded 3x6 grid, rarity breakdown bar, gold "Latest Achievement" callout. The one part of this experience that fully commits to a flex-worthy collector aesthetic.
3. **The conditional region line** (pin emoji + region) — small but specific personality touch that degrades gracefully when no region is set, rather than showing an empty placeholder.

## Priority Issues

**[P1] Edit-name pencil button fails touch-target and accessibility basics — and it's not isolated.**
Why it matters: `<button onClick={startEdit}>` wraps a bare 14px Pencil icon with zero padding and no aria-label, on the entry point to the page's most personal action (renaming yourself) — on a mobile-first app. It sits right next to Check/X buttons that are correctly sized w-11 h-11 but still lack aria-label. Assessment B independently found the same unpadded-icon-button pattern three more times in TradeLogDialog.jsx: the clear button on the selected-user chip (20px), the template-cancel button (16px, no wrapper at all), and the CanPicker clear button (24px) — all well under the ~44px guideline the same files otherwise follow deliberately.
Fix: Apply the same w-11 h-11 hit-box (or p-1.5 -m-1.5 padding technique, already used correctly on the Score popover trigger) to all four buttons, and add aria-label to every icon-only button on this page and in TradeLogDialog.
Suggested command: /impeccable audit (accessibility pass), then /impeccable harden

**[P1] Score is visually subordinate to a wall of look-alike buttons.**
Why it matters: For a product whose stated differentiator is the competitive/social layer, the single most competitively meaningful number on this page renders at text-xs font-mono caption size, while five equal-weight outline buttons dominate below it — three of which (Settings, Log Out, and a redundant second share action) aren't competitive at all. There's also no visible rank/standing anywhere on the page, despite that being the product's core hook.
Fix: Promote Score into a hero element (larger type, paired with rank if available), and tier the button list into primary (showcase/share) vs. secondary (settings) vs. destructive (logout) instead of one flat stack.
Suggested command: /impeccable layout, then /impeccable bolder for the Score treatment

**[P2] Four overlapping "share"-shaped actions with no distinguishing copy.**
Why it matters: "Share My Collection," "Generate Share Card / Instagram" (which itself opens a modal containing a separate "Share" button and a "Share to Instagram" button) — four share-flavored actions, identical visual weight, no copy explaining what's a link vs. what's an image.
Fix: Consolidate to one entry point, or clearly differentiate the copy.
Suggested command: /impeccable clarify

**[P2] No path back into the core loop for a zero-collection user.**
Why it matters: A first-timer with 0 cans sees "Score: 0," four zero-value stat tiles, and a button list that assumes an existing collection — nothing invites them to add their first can.
Fix: Conditionally swap in an empty-state CTA when collected.length === 0.
Suggested command: /impeccable onboard

**[P3] Icon reuse/mismatch in StatBox.**
Why it matters: Star covers both "Rare" and "Favourites"; Trophy labels "Wishlist" (cans not owned yet). Icons stop being scannable shortcuts.
Fix: Distinct, semantically matched icon per tile.
Suggested command: /impeccable typeset or fold into the /impeccable layout pass above

## Persona Red Flags

**Sam (Accessibility-Dependent)**: The unlabeled, undersized Pencil edit button and unlabeled Check/X confirm/cancel buttons would announce as bare "button" to a screen reader with no indication of function — and this isn't a one-off: TradeLogDialog.jsx has three more instances of the same pattern, confirmed by independent reads in both assessments.

**Jordan (First-Timer)**: Lands on an unexplained "Score: 0" (discoverable only via the popover), zero-value stat tiles, and a button list offering nothing that leads back to actually building a collection.

**Casey (Distracted Mobile User)**: Five visually near-identical outline buttons require careful reading rather than shape/color scanning. A fast thumb-scroller is likely to tap "Share My Collection" when they meant "Generate Share Card," or vice versa.

## Minor Observations

- saveEdit silently no-ops on a blank/whitespace name — no inline error, no toast.
- The region text has no truncation class defined for unusually long values.
- Trade History's status chips are click-to-cycle but styled like static filter chips — no visual affordance signals they're interactive.
- Two independent color-coding systems (trade-status colors vs. rarity colors) coexist with no visual separation.
- The profiles query destructures isLoading but ignores error — a failed profile fetch fails silently to a "Collector" fallback.
- TradeLogDialog's can picker only shows its list when the collection is <=8 items or a search term is typed — could read as broken for larger collections.
- ShareCardModal's off-screen export template uses low-opacity text in a few places — likely fine since it's rasterized into an exported PNG, worth a contrast check if ever surfaced on-page.

## Questions to Consider

1. If competitive standing is the product's stated differentiator, why does the only rank-adjacent artifact (the rarity grid + achievement card) live hidden off-screen for image export instead of being what a user sees every time they open their own profile?
2. What happens if the five stacked buttons collapse into one primary "Showcase" action plus a small utility row?
3. Could the neon share-card design become the profile's visible hero rather than a hidden export target?
