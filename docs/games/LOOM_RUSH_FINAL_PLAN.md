# Loom Rush: final plan

## 1. Decision summary
- **Build it.** It's a tray-match puzzle with a tailoring payoff. Every level ends with a real garment (an apron, a scarf, a football jersey) that a named customer ordered, and then they put it on.
- **Bake in the concept fixes from VERDICT.md:**
  - 6 tray slots plus one undo
  - weaving against the brief costs a tray slot
  - customers give style rules, not a fixed sequence
  - the gallery becomes your Loom Shop and its Wardrobe (the long-term hook)
  - the level 5 wall gets smoothed into a gentle ramp (section 3)
- **Garments are a skin over the rows.** The puzzle underneath doesn't change: what you weave is still an ordered list of coloured strips, and every rule, the solver and the bot sim read only that list. A garment template decides where each strip shows up (section 2, Garments), so the difficulty curve and its tests stay valid.
- **Keep what you loved:** the tap, fly and weave feel; the reveal with the Masterpiece stamp (now a try-on); bold colours, each with its own symbol (now also the garment's motif); the yarn cat and "Straight from the basket!".
- **Build:** the same web stack as One Spark (TypeScript + Vite + PixiJS v8 + Capacitor), Android first, then iOS. Menus, save, ads, IAP, the gallery and the test harness are shared with One Spark. The web build doubles as a free demo.
- **Pizzazz first:** the vertical slice ships with the top 3 ad moments (section 4), and we test real ad clips before full production.

## 2. The game
**One line:** tap spools from the baskets, weave matching threes into cloth, and make each customer the garment they asked for.

| Rules | |
|---|---|
| The garment | Each order is a garment, shown on the loom as a stitch-by-numbers template. Every strip you weave fills the next numbered region with its colour and its symbol as a motif. See Garments below. |
| Board | Stacks of spools in 4–7 colours. Each colour has its own symbol, for colour-blind players. Only the top spool of a stack can be tapped, and you can peek at the one beneath. |
| Tray | **6 slots.** Tapped spools fly in and group by colour. 3 of one colour weave a strip into the loom and leave the tray. |
| Knots | A knotted spool can't be tapped until you tap a stack right next to it. |
| Undo | **One per level:** the last spool goes back to its stack (not after a strip weaves). More undos are a booster. |
| The brief | Each customer gives 1–3 **style rules**, shown as icons on their card, e.g. "blue on both edges", "no red next to orange", "three warm strips in a row", "finish with gold". The card shows each rule's state live: kept, at risk, or broken. |
| Loose thread | A strip that breaks a rule drops a **loose thread** into the tray. It takes a slot until your next strip that keeps the rules, or until you snip it. Going against the brief now has a real cost. |
| Fail | The tray is full with no three, or no spool can be tapped (tangled). |
| Stars | Delivered · most rules kept · all rules kept. All rules kept = **Masterpiece** (golden trim, with your shop's label sewn in). |

### Garments (a skin over the rows)
**How the rows map onto a garment.**
- A level's result is still a list of strips in weave order (4–12). The garment template maps strip 1, 2, 3 and so on to named regions. For the apron: 1 = bib, 2 = pocket, 3 = skirt, 4 = hem.
- On the loom, the template lies flat like a sewing pattern. Regions are outlined and numbered in weave order, and the next one pulses. A woven strip still runs across the loom, then flows into its region.
- Each colour's symbol becomes that region's motif (dots, stars, waves), so finished garments look patterned and stay readable for colour-blind players.
- Rule icons are pinned to the regions they govern: "blue on both edges" pins to the collar and the hem, and "finish with gold" pins to the last region. Live states (kept, at risk, broken) show on the pins and on the card.
- **Band view:** a toggle shows the same strips as plain bands, as in the prototype. It's the same data and the same rules. It doubles as the Phase 1 greybox and an accessibility option.

**Template rules (checked in CI, section 6).**
- Region count equals the level's strip count. Each template has size variants (scarf 4/6/8/10; jersey 6/8/10, with cuffs merged into sleeves when short), and a level uses the variant that matches its strip count.
- Consecutive strips land in regions that touch, so "no red next to orange" looks true on the garment.
- Strip 1 and the last strip are the garment's real edges (neckline and hem, or both scarf ends), so "edges" and "finish with" rules point at the right place.
- A pair (two sleeves, two socks) is one region drawn twice and filled by one strip.
- **Readability floor** (starting targets, at 360 pt phone width): template area at least 300×200 pt; every region at least 16 pt across at its narrowest, with room for its number and a motif of at least 12 pt; **at most 12 regions** per garment.
- A level with more than 12 strips becomes a **two-piece outfit** (e.g. Oliver's market jacket and scarf). Strips fill piece A, then piece B, and a drawn thread joins them so adjacency still reads.

**Garment ladder.** Band-shaped garments come first (rows run straight across); shaped garments (regions of different shapes, pairs) come later. A garment's debut counts as that level's one new thing: it introduces no mechanic, raises no knob, and is never Hard or Super Hard (section 3). Variants of a known template (a headscarf or a royal stole from the scarf) aren't debuts. Levels and counts are starting targets.

| Debut | Garment | Customer | Layout | Regions |
|---|---|---|---|---|
| 1 | Kitchen apron | Grandma Rose | Band | 4 (the tutorial; the only debut alongside new mechanics) |
| 2 | Market scarf | Oliver | Band | 4–10 |
| 7 | Bed socks (a pair) | Grandma Rose | Shaped, simple | 5 |
| 16 | Football jersey | Alfie | Shaped | 6–10 |
| 30 | Royal cape | Queen Eleanor | Band, long (block 3's showpiece) | 8–12 |
| 36 | Sundress | Poppy | Shaped | 8–12 |
| 46 | Market jacket | Oliver | Shaped | 8–12 |
| 56 | Patchwork cardigan | Grandma Rose | Shaped | 8–12 |
| 151+ | Two-piece outfits mixed in | Any | Either | Up to 12 per piece |

- Garments add one rule type of their own: **matching pair** ("cuffs match the collar": two named regions share a colour), from level 71 (section 3). The solver sees it as "strip i equals strip j".
- New templates ship in app updates. Level-data-only updates reuse templates already in the app (Apple 4.2).

**The payoff: the try-on** (replaces the unroll).
- The finished garment lifts off the loom with one shake (the cloth shader), and the customer steps in and puts it on.
- Rules tick off as their pins sparkle on the worn garment, the customer reacts in character, and the stamp lands. Masterpiece: a twirl, golden trim and your shop label. Lovely: a happy pose. Hmm, OK: a polite tug at the collar.
- Showpieces (slot 10) get a short runway walk: Queen Eleanor's cape sweeps out, and Alfie does a goal celebration in his jersey.
- Skippable after the first second, and never longer than about 4 s (starting target).

**Wardrobe and personalisation.**
- The Loom Shop gets a **Wardrobe**: one rail per regular holding every garment you've made them. Masterpieces go on mannequins in the window. Secret garments show as empty hangers with silhouette tags.
- **Customers come back wearing your work.** Each regular is a paper-doll rig with slots (head, neck, body, legs, feet). When they return, they wear up to 2 of your past pieces in free slots (Masterpieces first), on their order card, in the try-on and when they walk past the shop window. About 1 order in 5 mentions it: "Still wearing your scarf, love!"

**Ramp (smoothing the level 5 wall).**
- Introduce one new idea at a time: rules, then knots, then deeper stacks, then a 6th colour, then a 7th colour, with breather levels in between.
- The gates in section 6 stop any single step from getting much harder.
- The prototype's "Royal Order" becomes the first Hard level (18), not level 5. The full curve is in section 3.

**Stakes.** The tray filling up is the tension. At 5 of 6 the tray glows amber, the loom creaks, and the spool you're about to tap is highlighted if it would save you. A loose thread steals that last slot.

**Rewards and easter eggs.**
- **The try-on:** the customer puts on what you made and reacts (above).
- **The Loom Shop:** the shop and its Wardrobe of everything you've made, with Masterpieces on window mannequins.
- **Yarn cat (from the prototype):** it peeks in now and then; tap it for the secret Cat's Cradle jumper, which the cat then wears around the shop.
- **Straight from the basket (from the prototype):** a three from 3 taps on one stack plays a sting and counts toward a shop trophy.
- **New: hidden patterns.** Weave a secret sequence (rainbow order, or every colour exactly once) for a secret garment, e.g. a rainbow jumper. The Wardrobe shows empty hangers with silhouette tags as hints.
- **New: clean loom.** Finish with an empty tray and zero loose threads, and Grandma Rose sends a thank-you biscuit tin for the shop counter.

**Customers (regulars who come back with harder briefs).**

| Customer | First order | Later garments | Personality |
|---|---|---|---|
| Grandma Rose | A kitchen apron | Bed socks, patchwork cardigan | Warm, simple briefs, the tutorial voice |
| Oliver | A market scarf | Long winter scarf, market jacket | Stall owner, likes bold stripes |
| Poppy | A picnic headscarf | Sundress | Bright colours, her briefs bring in knots |
| Alfie | A football jersey | Kit socks, team scarf | Flashy, long multi-rule orders |
| Queen Eleanor | A royal stole | Royal cape | Rare showpiece orders with strict rules |

**Why come back tomorrow.**
- **The shop grows:** regulars return with new briefs and gifts, wearing what you made them; the window, Wardrobe rails and loom are upgradeable.
- **Daily commission:** one solver-checked brief a day, with a streak and a small piece (a patch or a pocket square) for the shop's sample book.
- **Customer stories:** short arcs over several levels, e.g. Alfie's team kit (jersey, then socks, then scarf, worn together at the final), or Grandma Rose's patchwork cardigan, built panel by panel.
- **Weekly market event:** later, once the game is live.

**First 30 seconds.**
1. The app opens straight into level 1 with no menu. Grandma Rose: "A cheerful apron for my kitchen, please!" The apron's outline sits on the loom in 4 numbered regions.
2. A ghost finger taps a spool; it whirrs into the tray. Two more taps make a three, a strip weaves in with a soft thunk, and it flows into the bib.
3. Her one rule ("yellow at the top"), pinned to the bib, ticks green.
4. By about 25 seconds she ties the apron on and twirls, the Masterpiece stamp lands, and it hangs on her rail in the Wardrobe.

## 3. Difficulty curve
Slow rise, then a long "solvable but challenging" slope, and only then real difficulty. This section expands the ramp in section 2. **Every number here is a starting target to tune**, measured by the bot sim (greedy = a careful player, random = a player who doesn't think, rule-aware = a player chasing the brief). Real player data replaces the bot numbers once we have it (see Telemetry below).

**Phases.** Within each phase, block averages step down from the top of the band to the bottom, so it's a slope, not a flat line. "Tension" is the share of greedy runs whose tray reaches 5 of 6, which is the last-slot moment.

| Phase | Levels | Greedy wins (normal levels) | Hard levels | Random wins (ceiling) | Rule-aware Masterpiece | Tension |
|---|---|---|---|---|---|---|
| Onboarding | 1–10 | 92–100% | none | ≤ 40% (levels 1–3 exempt) | ≥ 60% | ≤ 25% |
| Learning slope | 11–40 | 82–95% | 70–80% | ≤ 10% | 40–70% | 20–45% |
| Long challenge slope | 41–150 | 72–88% | 60–72% | ≤ 3% | 25–50% | 35–60% |
| Mastery | 151+ | 65–80% | 55–65% | ≤ 1% | 20–35% | 45–70% |

- **Super Hard:** only from level 61, at most 1 in any 20 levels, greedy 45–55%. It takes that block's Hard slot, usually a Queen Eleanor order.
- **Floor:** no level ever goes below 45% greedy, and the 20% Masterpiece gate (section 6) holds on every tier.

**Sawtooth.** Every block of 10 levels is one stretch of customer orders.

| Slot | Role |
|---|---|
| 1–2 | Opener: the block's easiest normal levels, slightly harder than the last block's opener |
| 3–7 | Gradual rise, each level 0–6 points harder (greedy) than the one before |
| 8 | **Hard**: flagged in data, with a Hard badge on the map and the customer card (Super Hard gets its own badge) |
| 9 | **Breather**: at least 15 points easier than the Hard level, and in or above the phase's normal band |
| 10 | Showpiece: mid-band, a long garment (or later an outfit) made for the try-on's runway walk |

Block 1 has no Hard level; its slot 8 is a normal level.

**New mechanics, one at a time.** Each one's first level plays like a breather and teaches it with the layout and a ghost finger, with no text. The next 2 levels use it on its own. Combinations come after that.

| From level | New element |
|---|---|
| 1 | Tap, tray, threes; one simple rule ("yellow at the top"). 4 colours, stacks 2 deep |
| 3 | Undo |
| 4 | Loose thread (a rule that's easy to break, so you see the cost once) |
| 6 | Stacks 3 deep (peeking starts to matter) |
| 8 | 5th colour |
| 11 | Knots (Poppy) |
| 13 | Two-rule briefs |
| 15 | Rule type: "no A next to B" |
| 18 | First Hard: Queen Eleanor's Royal Order (combines what you know; nothing new) |
| 21 | Stacks 4 deep |
| 24 | 6th colour |
| 27 | Rule type: "N warm in a row" |
| 31 | Rule type: "finish with colour" |
| 41 | Three-rule briefs |
| 51 | 7th colour |
| 61 | Stacks 5 deep |
| 71 | Rule type: "matching pair" (two named garment regions share a colour) |

**Difficulty knobs.** Compared with the previous normal level, a level turns **at most one knob up**; a new mechanic counts as that knob. Every other knob stays the same or goes easier. Hard levels push one knob further, never two. Breathers turn knobs down.

| Knob | Easier → harder | When it moves |
|---|---|---|
| Spool count (level length) | 12 → 30+ | All phases; the main fine-tuner |
| Burial (how deep matching spools sit, set by layout or generator seed) | shallow → deep | All phases; fine-tuner |
| Colours | 4 → 7 | 5th at 8, 6th at 24, 7th at 51. Fewer colours stay as breathers |
| Stack depth | 2 → 5 | 3 at 6, 4 at 21, 5 at 61 |
| Knots (share of spools, and knots that need another knot loosened first) | 0 → about 30% | From 11, rising slowly through the Long challenge slope |
| Rule count | 1 → 3 | 2 from 13, 3 from 41 |
| Rule type | simple → strict | New types on block openers (15, 27, 31, 71), then mixed |
| Tray slots | **locked at 6** | Never a knob. The amber 5-of-6 moment and the +1-slot rescue depend on it |

**Garments and the curve.** Garments never change the numbers. The rules and the sim take only strips, so every band in this section holds with garments on. A garment debut (ladder in section 2) is that level's one new thing, so it introduces nothing, raises no knob, and isn't Hard or Super Hard. Garment choice is never a difficulty knob.

**Level data and the curve test.**
- Each level's JSON carries:
  - `tier`: normal, hard, superHard or breather
  - `block`
  - `introduces`: the new mechanic, or null
  - `knobUp`: the one knob it raises
  - `difficulty`: 0–100, equal to 100 minus the greedy win %. The sim writes it; it's never typed in.
  - `garment`: template id and size variant (read by the renderer only), and `garmentDebut`: true or false
- A CI curve test (built on the ported `sim-test.js` bots) runs them (1,000 seeded runs per level) and **fails the build** if:
  1. a level's greedy win % is outside its phase or tier band, it breaks the random ceiling, or (normal levels only) its Masterpiece rate or tension is outside the band;
  2. a normal level is more than 6 points harder (greedy) than the previous normal level;
  3. a Hard or Super Hard level isn't directly followed by a breather;
  4. there's a Hard level in block 1, a Super Hard before level 61, or two Super Hards within 20 levels;
  5. a level raises more than one knob, or introduces a mechanic and also raises a knob;
  6. a stored `difficulty` is more than 3 points off the sim;
  7. **smoothed curve:** a block's average greedy win % isn't 0–5 points below the previous block's (0–2 in Mastery), or after level 10 there are 3+ trivial levels in a row (greedy ≥ 97% and random ≥ 20%);
  8. a garment debut introduces a mechanic, raises a knob, or is a Hard or Super Hard level (level 1 exempt).
- Every run prints the curve as a table plus a CSV, so you can eyeball it.

**Telemetry (from soft launch, behind consent, anonymous).**
- **Per level:** first-try win rate, attempts to first win, Masterpiece rate, undo, Snip and rescue use, and time per attempt.
- **Quit points:** the last level played before 7 days away.
- In Phase 2, log the testers' first-try wins next to the bot rates to get a first bot-to-player mapping.
- **Player data overrides the bots.** Once a level has 500+ first attempts, the player first-try win rate replaces greedy as the curve metric and the bands are re-set from the data. The shape rules (sawtooth, deltas, one knob) stay.
- If a level's quit rate is 2x or more its block's average, fix it in the level data: ease it, or flag it Hard and put a breather after it.
- Never tune difficulty to sell rescues or boosters. High use of either is a warning, not a target.
- Fixes ship as level data only.

**Daily commission.** It runs separately on a mild weekly shape: Monday plays like a Learning-slope normal level, the weekend like a Long-slope Hard level, and it's never Super Hard. It only uses garments the player has already unlocked.

## 4. Pizzazz and ad hooks
| Idea | The 3-second ad moment | Product feature that makes it true | Verdict |
|---|---|---|---|
| **Last-slot save** | The tray is at 5 of 6 and glowing amber. A finger hovers, then taps the one spool that makes a three. Slow-mo, the tray clears in a ripple, and the strip floods into the jersey's last sleeve. | Amber tray state, a "saver" highlight, slow-mo on a last-slot three, creak-then-relief audio | **Build (#1)** |
| **The try-on** (was the big unroll) | The garment lifts off the loom with thread-whirr ASMR, Queen Eleanor swings the cape on and walks the runway, the rule pins sparkle, and the Masterpiece stamp thumps down. | The try-on: cloth shader (not real sim), customer rig with put-on, reactions and runway walk, per-rule pin ticks, a stamp with screen shake | **Build (#2)** |
| **Weave it for someone** | "Made this for Mum": a football jersey with MUM and a 1 on the back, or a scarf with her name woven in. | Gift mode: pick an unlocked garment, a name and colours, weave it, and share it as a link. The link carries only the garment, strips and name (no server). It opens in the web demo with the garment on a hanger (the flat template, no extra art), then "weave your own". Names are length-capped and filtered | **Build (#3)**, a viral loop that uses the web build |
| Spool cascade | One tap triggers three triples in a row | A combo sting from tray grouping | Folded into #1 |
| Yarn cat chaos | The cat gets tangled in a half-woven scarf | Easter egg | Retention, not ads |
| Street parade | The regulars stroll past the shop window, all wearing your work | Returning customers wear past pieces | Later: test in phase 3 if #1–#3 underperform |

**Test before full production.**
- Record 15-second clips from the vertical slice: 2–3 cuts each of #1, #2 and #3, plus plain gameplay.
- Run a small paid creative test, only with your approval and budget.
- Point traffic at a store "coming soon" page or the web demo.
- Compare click-through and cost per install between clips, and whether demo players finish 3+ levels.
- Build more of whatever wins; drop hooks that don't move the numbers.

## 5. Tech stack
| Piece | Choice | Why |
|---|---|---|
| Language/build | TypeScript + Vite | Same as One Spark: fast reload, and Cursor knows it. |
| Engine | **PixiJS v8** | The game logic already exists as pure rules. Pixi gives sprites, ParticleContainer, filters (the try-on cloth shader), masks for garment regions and WebGL/WebGPU in a small bundle. |
| Customers | Paper-doll cutout rig in Pixi: body-part sprites tweened with GSAP, garments as tinted region masks per slot | One rig per customer covers every garment, pose and past-piece layering. No Spine licence or extra runtime. |
| Tweens/audio | GSAP for spool flights and UI. Howler.js for audio sprites (whirr, thunk, creak) | Proven, small. Keep the synthesized SFX as placeholders. |
| Native wrap | Capacitor 8 (move to 9 once it's stable, as for One Spark) | Same web code on Android and iOS. |
| Plugins | @capacitor/haptics, @capacitor-community/admob (with consent), @revenuecat/purchases-capacitor, @capacitor/preferences, splash screen, status bar | Same set as One Spark. |
| Web | Free demo, ad landing page, and the target for gift links | One codebase. |

**Shared with One Spark.** Build these once as a small `kit` package, used by both games. If the One Spark repo isn't ready yet, write them self-contained so they can move across later.

| Module | Shared | Game-specific |
|---|---|---|
| Menus/UI kit | Buttons, panels, sheets, toasts, safe-area layout | Skins and colours |
| Save | Versioned local save with migrations; cloud save later | Save schema |
| Ads | AdMob wrapper, consent, frequency caps, rewarded flow | Placement choices |
| IAP | RevenueCat wrapper, remove ads, restore purchases | Product list |
| Album/gallery | A grid of collectibles, reveal animation, secret silhouettes | Sky Album vs the Loom Shop and Wardrobe (built on the same component) |
| Test harness | Vitest setup, Playwright e2e with screenshot overlap checks, a CI runner for bots and solvers | Each game's solver and bots |
| Platform | Audio unlock and resume, haptics, quality tiers, the native-feel checklist | |

**Performance budgets** (mid-range Android WebView; your phone is the reference device)

| Budget | Target |
|---|---|
| Frame | 60 fps. Game logic < 1 ms a frame. Auto-drop to a low tier if frames run long. |
| Particles | ≤ 800 live (low tier 300). Thread fluff and confetti use pre-baked sprites. |
| Rendering | < 40 draw calls (one spool atlas). Each garment region is rendered to a texture once when its strip lands, and the dressed customer is baked once per try-on, not redrawn every frame. Render resolution capped at DPR 2. |
| Textures | Atlases ≤ 2048x2048. Only the active customer's rig and garment atlas is loaded; Wardrobe and street figures use small thumbnails (starting target 128x192) baked on delivery. Total GPU texture memory < 80 MB. |
| Download | JS < 1.5 MB gzipped. Web demo first load < 5 MB. |
| Cold start | < 3 s to playable, with the native splash covering the load. |
| Input | Tap to spool lift < 50 ms. |

**Art scope (budget; counts are starting targets).** Customers only wear garments made for them, so overlays grow with orders per customer, not customers × garments.

| Asset | Vertical slice | Soft launch | Notes |
|---|---|---|---|
| Garment templates (flat loom pattern: region outlines plus size variants) | 3 (apron, scarf, socks) + headscarf variant | 8 + variants (headscarf, stole, kit socks, team scarf) | Vector outlines, also used by the CI validator |
| Worn overlays (region masks fitted to one customer's rig) | 4 | About 14 | One per garment per customer who owns it |
| Customer rigs | 3 (Rose, Oliver, Poppy) | 5 | Idle, put-on, 3 reactions; runway walk added at soft launch |
| Motif tiles | 7 | 7 | One per colour symbol, in one shared atlas |

If the art budget slips, cut in this order: runway walks, then past-piece layering down to 1 piece, then fewer size variants. Never cut band view or motifs.

The web-on-mobile risks and checklist are the same as One Spark: WebView speed tiers, iOS audio unlock, safe areas, Apple guideline 4.2 (everything bundled, no remote code, level data only in updates).

## 6. Quality
- **Unit tests (Vitest), on fixed seeds:**
  - top-only taps and peeking
  - knot loosening by adjacency
  - tray grouping and 6 slots
  - three weaves a strip
  - undo (one, blocked after a weave)
  - loose thread in and out, and snipping
  - every style rule type (matching pair included)
  - the garment template validator, for every template and size variant: region count equals strip count, consecutive regions touch, the first and last regions are real edges, every rule pin resolves to a region, and a pair shares one strip
  - skin independence: the rules and sim take no garment input (an import-boundary lint rule), and band view and garment view draw the same strips
  - stars and Masterpiece
  - both fail types
- **Exact solver as a CI gate** (extended from the prototype's `solve` to rules, loose threads and 6 slots): every level is winnable, every brief can be fully kept (a Masterpiece exists), and the solver finishes within its state cap.
- **Bot sim as a CI gate** (from `sim-test.js`; random, greedy and rule-aware bots, 1000 runs per level; bots never use undo, so undo is pure cushion):

| Gate | Threshold |
|---|---|
| Careful (greedy) bot wins | In its phase and tier band (section 3); never below 45% |
| Rule-aware bot gets a Masterpiece | ≥ 20% on every level (no theoretical-only third stars) |
| Smooth ramp | The section 3 curve test passes (≤ 6-point steps between normal levels, a breather after every Hard) |
| Rules matter | Rule-aware beats greedy on rules kept by 25+ points |
| Brief costs something | From level 3 on, the rule-aware bot's win rate is below greedy's (choosing to follow the brief must carry risk) |

- **E2E (Playwright):** a Masterpiece win with the try-on, a delivered-but-imperfect win, a full-tray fail, knot denied and then loosened, undo, a loose thread, the cat, the shop and Wardrobe, a returning customer wearing a past piece, a gift link round trip, the band-view toggle, a phone touch run, and screenshot checks for overlaps and for the readability floor (every region at 360 pt width).
- **Final-weight art perf check (a gate before the art pass is locked):** build a stress level (the deepest stacks, a full tray, a cascade, a 12-region garment try-on with the runway walk and two worn past pieces, and maximum particles) as an APK using final-weight art: a finished art sample, or stand-in atlases at final resolution and layer count, with lighting, bloom and particles at maximum. Test it on a cheap Android phone (3–4 GB RAM, Mali-G52/Adreno-610 class). Pass (starting targets):
  - 60 fps typical
  - never below a steady 30 fps at worst load
  - startup under about 3 s
  - no thermal throttling over 10 minutes
  - GPU texture memory within the section 5 budget

  If it fails, cut art weight (layers, effects, atlas size) until it passes. Re-run it whenever the art direction changes.
- **Device checklist (you):** 60 fps feel, tap accuracy on small spools, sound on/off/silent, haptics, notch, background/resume, an ad mid-session, a cheap phone.
- **Loop for every chunk:** plan → implement → tests → review (diff plus screenshots) → plain commit.

## 7. Phases and gates
| Phase | Size | Done when (evidence) |
|---|---|---|
| **1. Core + greybox** | S–M | TS rules with all five concept fixes. The 5 prototype levels are converted to style briefs. Solver and bot gates are green. The curve test (section 3) runs and prints the curve; on the 5 prototype levels it only warns. The Pixi greybox plays end to end in band view, with each level's garment outline drawn around the bands and a greybox reveal. Level JSON carries `garment`, and the template validator runs on placeholder band templates. An APK runs at 60 fps on your phone. |
| **2. Vertical slice** | L | 15 levels passing the curve test (section 3), 3 regulars (Grandma Rose, Oliver, Poppy), garments arrive: 3 templates (apron, scarf, socks) plus the headscarf variant within the art budget (section 5), the try-on, Loom Shop and Wardrobe v1, returning customers wearing past pieces, 7 daily commissions, pizzazz #1–#3, and an art and audio pass. The final-weight art perf check (section 6) passes on a 3–4 GB Mali-G52/Adreno-610-class phone before the art pass is locked. 5 testers play 15 minutes without help, understand the rules without text, and can say which region the next strip fills and which region a rule pin means. Ad clips recorded. |
| **3. Ad creative test** | S | Results in hand and a go / no-go on the hook. Budget only with your approval. |
| **4. Android soft launch** | M | 60+ levels pass the curve test, with all 5 regulars and 8 garment templates. Curve telemetry (section 3), ads, IAP and consent live. Crash-free sessions tracked. Day-1 and Day-7 retention measured, with targets set from the data. |
| **5. iOS** | M | Passes App Store review (4.2, ATT, IAP). Parity with Android. |

## 8. Monetization (tasteful)
- **Rescue on fail:** +1 tray slot for the rest of the level, or one extra undo. Costs coins or a rewarded ad. Offered once, with no countdown.
- **Boosters:** Unpick (an extra undo), Snip (remove a loose thread), Shuffle (shuffles the top spools), Peek (shows the whole stack). Earned often, also buyable.
- **Rewarded ads:** opt-in only (double shop tips, a free booster). Interstitials only between levels, rarely, none in the first levels.
- **Cosmetics:** shop decor, Wardrobe mannequins and rails, loom skins, spool sets, shop-label designs, an optional market pass.
- **Remove ads** as a one-time purchase.
- **No traps:** every level beatable without paying, no loot boxes, clear prices, no energy timers at launch. Customer garments are earned by weaving, never sold.

## 9. Risks
| Risk | Mitigation |
|---|---|
| Crowded tray-match genre | Lead with what's unique: named customers wearing what you make, the try-on, the Wardrobe, gift links. Test the hooks with ads before scaling. |
| Style rules feel like homework | Rules are icons with a live state on the card. At most 1 rule early and 3 at most. Playtest "understood without text" in phase 2. |
| Loose thread too punishing | Tune with the sim gates. It clears on the next good strip, and Snip exists. |
| Level content volume | A seeded generator plus the solver plus an in-browser editor. Gates reject bad levels automatically. 30 dailies banked before launch. |
| Shop meta creep | Shop v1 is display plus decor only. Economy features wait for retention data. |
| Garment art scope balloons | Customers only wear their own garments. One rig per customer with tinted region masks. Counts are budgeted in section 5 with a cut order. New templates wait for retention data. |
| Small garment regions unreadable on phone | The readability floor and 12-region cap are checked in CI and Playwright at 360 pt. Two-piece outfits instead of crowded templates. Band view toggle. |
| The garment hides the puzzle (players lose the weave order) | Numbered regions, a pulsing next region and rule pins on regions. The Phase 2 tester check. Band view. |
| Garments drift the difficulty curve | Garments are a skin: the import-boundary lint rule, and curve test check 8 for debuts. |
| Web performance on cheap Android | Budgets and tiers from day one. Profile on a cheap device every phase. |
| Store review / ad SDK friction | The shared native-feel checklist and consent, plus early test builds. |

## 10. Cursor starter prompt (Phase 1)
```
Port Loom Rush into a real web stack. References in this folder: prototype.html (rules,
levels, feel; CORE and LEVELS sections), sim-test.js (solver + bot gates), VERDICT.md,
FINAL_PLAN.md. Copy the prototype's feel; apply only the rule changes FINAL_PLAN.md
section 2 lists, and don't invent others. Garments (section 2) are a skin over the
strips: the rules and sim must never read garment data (add a lint rule for it).

Stack: TypeScript + Vite + PixiJS v8, GSAP, Vitest, Playwright, Capacitor 8 (Android only).
Shared code: menus/UI kit, save, ads, IAP, gallery and test harness go in a self-contained
kit/ folder so One Spark can reuse them. If the One Spark repo already has them, reuse
those instead and tell me.

Order, in small verified chunks (tests first for each):
1. Repo setup with lint, Vitest, Playwright and a CI script.
2. Pure TS rules, no rendering: stacks (top-only, peek), knots by adjacency, a 6-slot tray
   with colour grouping, three weaves a strip, one undo (blocked after a weave), style-rule
   briefs (start with: edges colour, no A next to B, N warm in a row, finish with colour),
   loose threads (in on a rule break, out on the next good strip or a snip), fails (full,
   tangled), stars and Masterpiece. Levels in JSON, each with a garment field (template
   id + size variant) that only the renderer reads. Unit tests for every rule.
3. Port solve() and the bots from prototype.html, extended to rules, loose threads and
   6 slots. CI gates use FINAL_PLAN.md section 6 thresholds plus the section 3 curve
   test: level JSON gets tier, block, introduces, knobUp and a sim-written difficulty;
   in Phase 1 it only warns on the 5 prototype levels. Convert the 5 prototype
   levels (customers Grandma Rose, Oliver, Poppy, Alfie, Queen Eleanor) to briefs and
   make them pass, tuning the ramp so no step gets much harder. Their items become
   apron, scarf, headscarf, football jersey and royal stole. Add the garment template
   validator (section 2 template rules) with placeholder band templates.
4. Pixi greybox at parity: board, spool flight, tray, loom strips in band view with the
   level's garment outline drawn around them, customer card with live rule states, a
   greybox reveal and stamp, the shop (gallery) screen, menus, HUD with no overlaps,
   touch and mouse. No garment art, try-on, Wardrobe or gift links yet (Phase 2).
5. Playwright e2e: Masterpiece win, imperfect win, full-tray fail, knot, undo, loose
   thread, cat easter egg, shop, plus screenshots.
6. Capacitor Android build with haptics. Hit the performance budgets in FINAL_PLAN.md.

Rules: show me a running web build after chunk 4 and an APK on my phone after chunk 6.
Before the art pass is locked, build a final-weight art stress scene APK for the cheap-Android
perf check (FINAL_PLAN.md section 6) and stop for my device test.
Plain commits using my git config: no signing, no Co-authored-by or tool trailers,
never --no-verify. Ask before pushing. Report what's unverified at each step.
```
