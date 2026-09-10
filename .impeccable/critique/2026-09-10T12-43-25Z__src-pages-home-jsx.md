---
score: 17/36
heuristic: nielsen-10
p0: 0
p1: 4
p2: 3
p3: 3
timestamp: 2026-09-10T12-43-25Z
slug: src-pages-home-jsx
---
# Critique: Home page (`src/pages/Home.jsx`)

**Method:** Full dual-assessment run — Assessment A (design review) and Assessment B (detector + code-level evidence) executed as two isolated parallel subagents, per the critique invariant. No degraded-mode banner needed.

## Design Health Score (Nielsen's 10 Heuristics)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2/4 | Loading state collapses into the empty state (RarityHero, brand row, carousel); Streak stat has no shared loading gate with its siblings. |
| 2 | Match Between System & Real World | 3/4 | Strong collector vernacular ("Pulls," "vault," "Streak"), but the Score card's caption ("Your Energy Drink Vault") doesn't explain what the score actually measures. |
| 3 | User Control and Freedom | 2/4 | FeedPreview's "Global/Following" control looks like a filter toggle but both options just navigate to `/feed` — the visible preview never changes. |
| 4 | Consistency and Standards | 2/4 | FeedPreview misuses `role="tablist"`/`role="tab"` with static, never-updating `aria-selected` literals and no roving tabindex — this is two nav links dressed as a broken tab widget. |
| 5 | Error Prevention | 1/4 | None of Home's four Supabase queries (profile, collection, shared_cans, votes) surface `error`/`isError` — a failed fetch renders identically to a genuinely empty account. |
| 6 | Recognition Rather Than Recall | 3/4 | Rarity legend pairs color dot + text directly under the donut; icon+label pairing throughout StatsRow. |
| 7 | Flexibility and Efficiency of Use | n/a | Appropriately a glanceable Operate-mode landing screen, not a power-tool surface. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Strong type/color personality, diluted by 4+ inconsistent card-framing conventions across 7 stacked sections with no single visual anchor. |
| 9 | Help Recognize/Diagnose/Recover from Errors | 1/4 | No error UI anywhere; a failed fetch on flaky venue wifi (a stated core product scenario) is indistinguishable from "0 cans." |
| 10 | Help and Documentation | 1/4 | Collection Score is a non-obvious computed metric (rarity-weighted sum) with zero explanation anywhere on the page. |

**Total: 17/36** (heuristic 7 scored n/a — glanceable landing surface, not a power tool)

## Design Specificity Verdict

Home is split between one piece of real bespoke craft and an otherwise generic dashboard skeleton. `RarityHero`'s half-donut is genuinely product-specific engineering — a hand-tuned `ResizeObserver`-measured radius working around recharts' broken half-circle math, built specifically to answer "what's my rarity distribution," not a templated pie chart. Copy is domain-fluent throughout ("Rare Pulls," "vault," "Streak" with a Flame icon). But structurally, the page is the generic "stat cards + activity feed + CTA list" template — seven `bg-card border-border rounded-2xl` boxes stacked with uniform `mt-5` spacing and no section framing. The same skeleton would work for a fitness app or budgeting tool with icons swapped. Tellingly, `index.css` defines a `.hero-card` class explicitly commented as "the one-per-page emphasis treatment... Home's Collection Score" — but it's used nowhere in the codebase. The design system's own stated intent for hierarchy was never wired into the page that most needs it.

## Overall Impression

Home functions but doesn't yet direct attention. Seven sections of roughly equal visual weight compete for the eye with no macro-grouping between "your collection" content (hero/score/stats) and "community" content (feed/carousel/brand browsing) — a returning collector's 3-second glance has to do the prioritization work the layout should be doing for them. The one custom-built visualization (RarityHero) is strong; everything downstream of it reads as accretion — features added over separate sessions (the brand-filter row and SpotlightCarousel were both "revived" this session) without a pass to re-establish what should win the eye.

## What's Working

1. **RarityHero's custom half-donut** — bespoke, product-specific engineering (real `ResizeObserver` measurement, rounded end-caps, per-slice labels) that visualizes exactly what a rarity-obsessed collector cares about.
2. **Collector-fluent copy and iconography** — consistently pulls vocabulary from the collecting/gacha world ("Rare Pulls," "vault," Flame-icon Streak) instead of generic dashboard nouns.
3. **FeedPreview's sibling-link architecture** — correctly avoids the common overlay-link-wrapping-interactive-children bug (keydown bubbling double-firing navigation) via an explicit sibling-link pattern instead of nesting.

## Priority Issues

**P1 — First-timer zero state buries the one encouraging line six sections down**
- What: A brand-new user with 0 cans sees three consecutive "nothing" widgets (empty gray donut ring, bold "0" score, 0/0/0 stats), then the *global community feed* with zero framing, before reaching the only actionable copy on the page ("Add your first can to see it here") — which lives inside `SpotlightCarousel`, section 6 of 7.
- Why it matters: this is the product's most emotionally high-stakes moment (first impression), and the current arc reads "I have nothing" ×3 → "here's what strangers already have" → finally, buried, "get started." No section adapts its framing based on collection size.
- Fix: move first-run guidance up near the Score/Stats block, or suppress/relabel FeedPreview for zero-collection users so it doesn't read as a discouraging comparison.

**P1 — Collection Score never gets its own design system's intended hero treatment**
- What: `.hero-card` in `index.css` is explicitly commented as the emphasis treatment for "Home's Collection Score," but is used nowhere in the codebase — the Score card (Home.jsx:148) is styled identically to the passive Monthly Report CTA link.
- Why it matters: Score is the page's answer to "what's my collection status" and currently carries zero visual distinction from a low-stakes nav link.
- Fix: apply `.hero-card` (or equivalent gradient/glow) to the Score card wrapper.

**P1 — Loading state is visually identical to (or absent from) the real empty state**
- What: `RarityHero` receives `collected={isLoading ? [] : collected}` (Home.jsx:144), rendering the same gray empty-ring visual during normal load as a genuine 0-can account. Separately, the brand-filter row and SpotlightCarousel are gated entirely behind `!isLoading` with no skeleton — they pop in fully formed post-load, shifting layout below the fold.
- Why it matters: every returning collector briefly sees the "you have nothing" visual on ordinary load latency, which also dilutes the signal for genuine first-timers. The abrupt pop-in is a CLS/polish issue on top.
- Fix: give RarityHero/brand-row/carousel real loading skeletons distinct from empty-state rendering.

**P1 — FeedPreview's Global/Following control is a broken, dishonest ARIA tablist**
- What: `role="tablist"`/`role="tab"` with hardcoded, never-updating `aria-selected="true"/"false"` literals and no roving tabindex (FeedPreview.jsx:92-109); activating either option doesn't filter the visible preview at all — both just navigate to `/feed`.
- Why it matters: screen-reader users get a widget that violates the WAI-ARIA tabs pattern with no working alternative; sighted users get a control that visually promises local filtering it doesn't deliver.
- Fix: either implement real local filtering of the 3-item preview by scope, or drop the tabs pattern for two honestly-labeled nav links.

**P2 — No error handling on any of Home's four Supabase queries**
- What: profile, `user_collection`, `shared_cans`, and `rarity_votes` queries never surface `error`/`isError`; a failed fetch renders identically to "0 cans, 0 score."
- Why it matters: this is a mobile-first, point-of-acquisition app — flaky venue wifi is a stated core scenario, not an edge case.
- Fix: minimum viable fix is one inline retry/error affordance per critical section (Score/Stats, RarityHero).

**P2 — Several touch targets on Home and its children read below the 44px floor**
- What: notification Bell (`PageHeader.jsx`, 32×32px), FeedPreview refresh button (32×32px), FeedPreview tab buttons (28px height), the header Scan button (`size="sm"` → 32px), and brand-filter pills (~28px height) all measure under 44px.
- Why it matters: this repeats a class of issue an earlier session pass ("bring flagged touch targets to 44px") specifically fixed elsewhere — these instances were evidently missed or added after that pass.
- Fix: bump each to a `h-11` (44px) minimum consistent with the rest of the app's now-standardized target size (see the recent FilterBar fix for the pattern).

**P2 — Scan CTA contrast may drop below WCAG AA under the Steel theme**
- What: `[data-theme="common"]` (Steel) sets `--primary` to a desaturated mid-gray against a pure-white `--primary-foreground`, computing to roughly 3:1 contrast for the `text-xs` Scan button label — below the 4.5:1 AA floor for small text.
- Why it matters: this is the app's single most important CTA, and it specifically weakens under one of the six shipped themes.
- Fix: verify actual computed contrast per theme and adjust `--primary`/`--primary-foreground` pairing for Steel if confirmed.

**P3 — Hardcoded, non-tokenized hex fallback in RarityHero's empty state**
- What: `fill={isEmpty ? '#3F3F46' : ...}` (RarityHero.jsx:117) has no corresponding `--rarity-*` token and no comment justifying the escape hatch (unlike the documented `RARITY_HEX` pattern used elsewhere in the same file).
- Why it matters: this one gray won't reskin across the 6-theme system, unlike everything else on the page.
- Fix: source from a themed token or add the same documented justification comment `RARITY_HEX` already carries.

**P3 — Streak stat has no shared loading gate with its StatsRow siblings**
- What: `rarePulls`/`wishlistCount` explicitly render `'—'` while `isLoading`, but Streak (from a separately-loading `useStreak()` hook) is rendered unconditionally — it can flash `0d` before resolving.
- Fix: gate Streak's display behind the same loading flag, or behind its own hook-reported loading state if available.

**P3 — SpotlightCarousel's peek-width comment doesn't match actual behavior at 375px**
- What: the code comments a "~20% peek of the next card," but at a 375px viewport the `min(80vw, 280px)` card width actually yields roughly 13% peek (the 280px cap wins over the 80vw calculation at this breakpoint).
- Why it matters: cosmetic doc/behavior mismatch, not a functional bug — nothing overflows.
- Fix: update the comment, or revisit the width formula if a larger peek was actually intended.

## Persona Red Flags

**Jordan (first-timer, 0 cans)**
- Lands on three consecutive "nothing" widgets before any encouragement appears; the one friendly empty-state line is buried in section 6 of 7.
- Sees other people's activity (FeedPreview) with zero bridging copy immediately after their own zero-stats block — reads as discouraging rather than motivating.
- Header subtitle text is identical for 0 cans and 500 cans — no onboarding-specific framing exists anywhere keyed off collection size.

**Sam (accessibility-dependent)**
- FeedPreview's fake tablist announces "Global, tab, selected" to a screen reader with no way to actually reach different content through it.
- RarityHero's donut — the primary "what's my status" visual — has no text alternative (`aria-label`/`title` summarizing tier counts); a screen-reader user gets nothing from the chart itself, only the separate legend below it.
- The Scan CTA's contrast risk under the Steel theme (P2 above) specifically disadvantages low-vision users on that theme.

**Casey (distracted, one-handed mobile)**
- SpotlightCarousel's only scroll affordance is an 11px "Swipe →" label — no dots, no trailing fade — easy to miss that cards exist off-screen on a quick glance.
- The brand-filter row can hold up to 9 pills with no "more" indicator; a fast thumb-scroller may not register that later brands exist.
- Scan (the point-of-acquisition action) is only reachable via the small header button — no secondary/sticky affordance once scrolled past the fold.

## Minor Observations

- Collection Score's caption duplicates the header subtitle's fallback text verbatim instead of explaining what the score measures.
- Monthly Report CTA always displays the current month regardless of whether that month's report is actually the one ready to view.
- Individual FeedPreview rows aren't independently linked to the specific can/user mentioned — only the whole-card link works, and it routes generically to `/feed`.
- PageHeader's title/subtitle block has no `truncate`/`min-w-0` guard against an unbounded-length `full_name` on a 375px viewport, while the sibling actions block is `flex-shrink-0`.
- RarityHero's `max-w-[330px]` sits inside a `px-5` (40px total) container — only 5px of slack at exactly 375px viewport width. Not currently overflowing, but fragile if any wrapper padding changes.
- Detector scan (`detect.mjs`) returned zero findings across all six reviewed files — no mechanical anti-patterns flagged.

## Questions to Consider

1. If Collection Score is meant to be Home's headline metric (per the design system's own `.hero-card` intent), has "the hero" quietly shifted to the Rarity donut without the styling ever catching up?
2. FeedPreview's Global/Following control is marked up and styled exactly like a real content filter but is secretly two navigation links — was local filtering ever actually intended, or should this stop pretending to be a tab?
3. With seven stacked sections and no macro-grouping between "your collection" and "community" content, is Home currently optimized for a returning collector's 3-second glance, or has it become a running list of every widget shipped this quarter?
