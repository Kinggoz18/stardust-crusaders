---
name: landing-page
description: Build or rewrite a product landing page that sells the outcome and proves it. Use for landing, pricing, or marketing pages on the product's own domain. Covers problem, outcome, proof, one CTA; messaging.md; SEO basics; Lighthouse CI budgets at Core Web Vitals "good" thresholds; field INP; and the 5-second test.
---

# Landing page

Owner: Facet (Reel owns off-platform creative). Pairs with `ui-review` for the evidence.

## 1. Start from messaging.md
- The repo's `messaging.md` (template: `templates/messaging.md.template`) holds the audience, value
  proposition, the audience's own words, sourced proof points, and banned words. Missing: draft it
  first and ask Chigozie for the audience and proof. Reel reads the same file (message match: an
  ad's promise equals the landing headline).
- Write the copy before the layout.

## 2. Structure: problem, outcome, proof, one CTA
1. **Problem** in the audience's words ("Chasing payments eats your week.").
2. **Outcome** they get, not the mechanism ("Get paid in days, not weeks.").
3. **Proof**: a real number, logo row, or short quote with its source. Placeholder proof is flagged
   in the PR and blocks launch. Never invent testimonials, logos, or numbers.
4. **One primary CTA**, repeated at most at the top and bottom, same words each time.
- Headings 6 words or fewer. No internals, vendor names, "beta", "v2", or "MVP".
- Explore 2 to 3 hero variants behind one switcher and screenshot each before picking.

## 3. SEO basics (check each)
Server-side or static rendering; `<title>` and meta description; Open Graph and Twitter card tags;
canonical URL; `sitemap.xml` and `robots.txt`; exactly one `h1`; descriptive `alt` text; structured
data (`Organization`, `Product`, or `SoftwareApplication`) where it fits.

## 4. Performance budgets (Lighthouse CI)
Google's "good" thresholds: LCP 2.5 s or less, CLS 0.1 or less. Lighthouse cannot measure INP, so
Total Blocking Time is the lab stand-in. `lighthouserc.json`:
```json
{ "ci": { "collect": { "numberOfRuns": 3 },
  "assert": { "assertions": {
    "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
    "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
    "total-blocking-time": ["error", { "maxNumericValue": 200 }],
    "categories:accessibility": ["error", { "minScore": 0.95 }],
    "categories:seo": ["error", { "minScore": 0.95 }] } } } }
```
Once live, measure field INP (200 ms or less) with the `web-vitals` library (`onINP`), plus LCP and CLS.
Low-bandwidth audiences: image budgets, `loading="lazy"` below the fold, fonts with `font-display: swap`.

## 5. Consent and third parties
No analytics before consent (NDPA 2023, GDPR): accept and reject with equal weight, no pre-ticked
boxes. New third-party scripts are flagged for Warden (CSP, privacy).

## 6. Verify
- `ui-review` evidence at 360, 768, 1280 px; axe clean; copy lint clean.
- Lighthouse CI report attached; budgets pass.
- **5-second test** by Plumb in UI mode: shown the hero screenshot cold, it must say what the
  product does and for whom. A wrong answer fails the page.

## pstack
Builds on `principle-experience-first` (one clear promise), the Prototype playbook and
`principle-exhaust-the-design-space` (hero variants), `arena` with a cross-model judge for contested
copy, `unslop` for filler, and `principle-prove-it-works`.
