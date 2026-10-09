---
name: ui-review
description: Facet's verification for any change to what users see. Use when a PR or task touches screens, copy, navigation, or styles, and when Plumb judges in UI mode. Produces screenshots at 360, 768, and 1280 px in every state, ARIA snapshots, zero axe WCAG 2.2 AA violations, a keyboard walk, a clean copy lint, and a rubric verdict including the 5-second test.
---

# UI review

Owner: Facet. Judge: Plumb in UI mode on a different model family. Rules it enforces:
`~/.cursor/rules/ui-copy.mdc` and `ux-structure.mdc` (repo copies: `rules/`).
UI globs and the audience come from the repo's AGENTS.md.

## Evidence to produce (into `.artifacts/<run-id>/`)
1. **Screenshots** of every changed route at 360, 768, and 1280 px, in each state: loading, empty,
   error, partial, no-permission, success. Force states at the network boundary (Playwright
   `page.route()` or MSW), never by editing components.
2. **ARIA snapshots** (`expect(page.locator('main')).toMatchAriaSnapshot()`): landmarks, exactly one
   `h1`, labelled controls, one primary action.
3. **axe**: zero WCAG 2.2 AA violations on changed routes and on every opened dialog and drawer.
   Use the installed snippet `~/.config/chigozie-rules/a11y.e2e.snippet.ts` (`@axe-core/playwright`,
   tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`).
4. **Keyboard walk**: a scripted Tab path reaches the primary action with visible focus that is not
   hidden by sticky bars (2.4.11). Escape closes dialogs and focus returns to the trigger.
5. **Copy lint**: `~/.config/chigozie-rules/check-ui-copy.sh <changed paths>` exits 0. Fix by
   rewording; never add `ui-copy-ignore` to text users see. Headings 6 words or fewer; buttons 1 to 3
   words starting with a verb; one primary CTA per route.
6. **Visual regression**: baseline screenshots per route; diffs are reviewed, never auto-accepted.

## Rubric for the judge (PASS / ISSUES / BLOCKED)
Given only the screenshots, ARIA snapshots, and the audience from AGENTS.md:
- Clear to that audience, in their words? No internals (APIs, IDs, codes, vendors, "v2", "MVP")?
- One main task per screen; dense content split into sub-routes, tabs, or drawers?
- Every state designed; no dead ends; disabled controls explain why?
- Does the copy sell the outcome, not the mechanism?
- Passes the no-MVP checklist in `ux-structure.mdc` (one spacing and type scale, real copy and icons)?
- **5-second test** for landing and key screens: shown the screenshot cold, the judge says what the
  product does and for whom. A wrong answer fails the page.

## Before and after
PR body: before and after screenshots side by side, one line of rationale per change, copy options
in the audience's own words. Nigerian audiences: NGN via `Intl.NumberFormat('en-NG', {style:
'currency', currency: 'NGN'})`, dates in Africa/Lagos, +234 phone format, strings behind i18n keys.

## Never
Ship a screen without loading, empty, and error states; put two primary actions on one screen;
merge with axe violations; invent proof (testimonials, logos, numbers); add dark patterns to
consent or pricing screens.

## pstack
Builds on `create-verification-skill` (feature maps with states and breakpoints),
`principle-test-behavior-not-implementation` (select by role and label), `principle-prove-it-works`,
`principle-subtract-before-you-add`, `principle-minimize-reader-load`, `unslop` for long copy,
`interrogate` for contested copy or IA, and the Visual parity playbook. Browser control:
cursor-team-kit `control-ui` if installed; otherwise Playwright.
