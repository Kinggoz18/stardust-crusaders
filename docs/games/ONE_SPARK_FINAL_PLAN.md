# One Spark: final plan

## 1. Decision summary
- **Main game:** the Path version (drag through matching rockets, limited moves, goals).
- **Aiming version:** becomes the daily "One Spark" puzzle and occasional special levels.
- **Keep what you loved:** the sky clearing as you play, the crowd and ground-hit reaction, the Sky Album, golden pictures, easter eggs. Art gets upgraded later.
- **Build:** a web game (TypeScript + PixiJS), wrapped for Android first, then iOS, with Capacitor. The web build doubles as a free browser demo.
- **Difficulty:** a slow rise, a long solvable-but-challenging slope, flagged Hard levels with breathers, all gated in CI (section 3).
- **Pizzazz first:** the vertical slice ships with the top 3 ad moments (section 4), and we test real ad clips before full production.

## 2. The game
**One line:** drag through matching fireworks to light up the night sky, save the festival crowd, and collect the picture hidden in every sky.

| Path rules (main game) | |
|---|---|
| Board | 6x8 rockets in 4–5 colours (each has a shape for colour-blind players). The crowd sits below. |
| Drag | 3+ adjacent rockets of one colour, diagonals count. They launch and burst, and gaps refill from the top. |
| Specials | 5 rockets = **Comet** (clears the row or column of the last drag direction). 6–7 = **Peony** (bursts its 3x3). 8+ = **Rainbow** (links any colour; when fired it lights every rocket of the path colour). |
| Combos | 2+ specials in one path = combo (a star goal). Planned for the slice: special + special mixes (Comet+Comet = cross, Rainbow+Rainbow = whole sky). |
| Moves and goals | 12–15 moves. Goals: light N rockets, N of one colour, defuse duds. Leftover moves launch the board in a finale. |
| Stars | Clear the sky · finish with 3+ moves left · combo. 3 stars = golden picture. |

**Daily One Spark (the aiming version).** One hand-made puzzle a day on a fixed board. Aim the rockets, strike one match, and the whole sky lights in one chain. The colour rule is A (any burst lights any rocket). Every puzzle is solver-checked, with par computed, never typed in. Rewards: a streak and a daily sticker in the album.

**Stakes.** Duds carry a fuse that drops by 1 each move. Launch any rocket next to one to defuse it. At 0 it drops into the crowd: people panic, the screen shakes, and the level fails. In the Daily, a comet aimed into the crowd does the same.

**Rewards and easter eggs.**
- **Sky clears:** the sky goes from dark night to bright as you light rockets.
- **Sky Album:** a full clear makes the embers fly into that level's hidden picture. 3 stars makes it golden.
- **Secret shell:** rare, at most 1 per level. Plays a little melody, bursts a heart, gives +2 moves.
- **New: shooting star.** Rarely streaks across mid-level. Tap it before it fades for a free booster and a wish-sound sting.
- **New: secret shapes.** Drag a path in a hidden shape (a star, a heart, your initial) and the burst takes that shape. The album has a "secrets found" page with blank silhouettes as hints.

**Why come back tomorrow.**
- **Festival Tour map:** cities, each a night of levels plus an album page; finishing a page lights a constellation.
- **Daily One Spark:** streak and sticker.
- **The crowd grows:** visible festival-goers join as you progress.
- **Weekly festival event:** later, once live.

**First 30 seconds.** The app opens straight into level 1 with no menu. The sky is dark and the crowd murmurs. A ghost finger drags 3 rockets, they burst, the sky lifts a shade, and the crowd cheers. Move 2 points to a 5-long path ("makes a Comet") and the Comet sweeps a row. By move 3–4 the sky is bright, the embers form a kite, and the Sky Album opens with one slot filled.

## 3. Difficulty curve
Slow rise, then a long "solvable but challenging" slope, and only then real difficulty. **Every number here is a starting target to tune**, measured by the bot sim (greedy = a careful player, random = a player who doesn't think). Real player data replaces the bot numbers once we have it (see Telemetry below).

**Phases.** Within each phase, block averages step down from the top of the band to the bottom, so it's a slope, not a flat line.

| Phase | Levels | Greedy wins (normal levels) | Hard levels | Random wins (ceiling) | Greedy moves left (avg) | Greedy 3 stars |
|---|---|---|---|---|---|---|
| Onboarding | 1–10 | 92–100% | none | ≤ 50% (levels 1–3 exempt) | ≥ 5 | ≥ 50% |
| Learning slope | 11–40 | 82–95% | 70–80% | ≤ 15% | 3–6 | 30–60% |
| Long challenge slope | 41–150 | 72–88% | 60–72% | ≤ 5% | 2–4 | 15–40% |
| Mastery | 151+ | 65–80% | 55–65% | ≤ 2% | 1–3 | 10–30% |

- **Super Hard:** only from level 61, at most 1 in any 20 levels, greedy 45–55%. It takes that block's Hard slot.
- **Floor:** no level ever goes below 45% greedy. "Extremely difficult" means Super Hard only; the normal curve never gets there.

**Sawtooth.** Every block of 10 levels is one Festival Tour night.

| Slot | Role |
|---|---|
| 1–2 | Opener: the block's easiest normal levels, slightly harder than the last block's opener |
| 3–7 | Gradual rise, each level 0–6 points harder (greedy) than the one before |
| 8 | **Hard**: flagged in data, with a Hard badge on the map and the level start card (Super Hard gets its own badge) |
| 9 | **Breather**: at least 15 points easier than the Hard level, and in or above the phase's normal band |
| 10 | Finale: mid-band, built for spectacle (long paths, the night's album page completes) |

Block 1 has no Hard level; its slot 8 is a normal level.

**New mechanics, one at a time.** Each one's first level plays like a breather and teaches it with the board layout and a ghost finger, with no text. The next 2 levels use it on its own. Combinations come after that.

| From level | New element |
|---|---|
| 1 | Drag 3+, diagonals count |
| 2 | Comet (5-long path) |
| 4 | Peony (6–7) |
| 6 | Duds: one dud, fuse 8 (the crowd stakes arrive early) |
| 8 | Rainbow (8+) |
| 12 | Colour goal |
| 15 | 5th colour |
| 18 | 2 duds |
| 22 | Special + special mixes (Comet+Comet cross, Rainbow+Rainbow whole sky) |
| 26 | Shorter fuses (6) |
| 33 | Defuse-N-duds goal |
| 41+ | Board blockers, if added later (not in the Phase 1 rules). Each type gets its own block opener |

**Difficulty knobs.** Compared with the previous normal level, a level turns **at most one knob up**; a new mechanic counts as that knob. Every other knob stays the same or goes easier. Hard levels push one knob further, never two. Breathers turn knobs down.

| Knob | Easier → harder | When it moves |
|---|---|---|
| Moves | 15 → 12 (10 in Mastery) | All phases; the main fine-tuner |
| Goal target (rockets lit, colour count) | low → high | All phases; fine-tuner alongside moves |
| Colours | 4 → 5 | From level 15. 4-colour levels stay as breathers |
| Dud count | 1 → 3 | 2 from level 18, 3 in the Long challenge slope |
| Dud fuse length | 8 → 4 | 6 from level 26, 4 only in Mastery or on Hard levels |
| Dud spawn rate | 0 → 0.03 | Long challenge slope on |
| Specials frequency (seed and colour weighting) | more long paths → fewer | Long challenge slope and Mastery |
| Board blockers (later) | none → some | 41+, only if added |

**Level data and the curve test.**
- Each level's JSON carries:
  - `tier`: normal, hard, superHard or breather
  - `block`
  - `introduces`: the new mechanic, or null
  - `knobUp`: the one knob it raises
  - `difficulty`: 0–100, equal to 100 minus the greedy win %. The sim writes it; it's never typed in (like par).
- A CI curve test runs the bots (1,000 seeded runs per level) and **fails the build** if:
  1. a level's greedy win % is outside its phase or tier band, it breaks the random ceiling, or (normal levels only) its moves left or 3-star rate is outside the band;
  2. a normal level is more than 6 points harder (greedy) than the previous normal level;
  3. a Hard or Super Hard level isn't directly followed by a breather;
  4. there's a Hard level in block 1, a Super Hard before level 61, or two Super Hards within 20 levels;
  5. a level raises more than one knob, or introduces a mechanic and also raises a knob;
  6. a stored `difficulty` is more than 3 points off the sim;
  7. **smoothed curve:** a block's average greedy win % isn't 0–5 points below the previous block's (0–2 in Mastery), or after level 10 there are 3+ trivial levels in a row (greedy ≥ 97% and random ≥ 20%).
- Every run prints the curve as a table plus a CSV, so you can eyeball it.

**Telemetry (from soft launch, behind consent, anonymous).**
- **Per level:** first-try win rate, attempts to first win, moves left on wins, boosters and extra moves used, and time per attempt.
- **Quit points:** the last level played before 7 days away.
- In Phase 2, log the testers' first-try wins next to the bot rates to get a first bot-to-player mapping.
- **Player data overrides the bots.** Once a level has 500+ first attempts, the player first-try win rate replaces greedy as the curve metric and the bands are re-set from the data. The shape rules (sawtooth, deltas, one knob) stay.
- If a level's quit rate is 2x or more its block's average, fix it in the level data: ease it, or flag it Hard and put a breather after it.
- Never tune difficulty to sell boosters or extra moves. High use of either is a warning, not a target.
- Fixes ship as level data only (section 5).

**Daily One Spark: its own mild weekly curve.** It runs separately from the Tour. The solver reports par and the number of distinct solutions, and the daily gate checks both against the day's band.

| Day | Par (turns) | Distinct solutions |
|---|---|---|
| Mon | 1–2 | 3+ |
| Tue–Wed | 2 | 2+ |
| Thu–Fri | 2–3 | 2+ |
| Sat | 3 | 1–2 |
| Sun | 3–4 | 1+ (the week's showpiece) |

Week to week the bands stay put; variety comes from new boards, not harder Mondays.

## 4. Pizzazz and ad hooks
| Idea | The 3-second ad moment | Product feature that makes it true | Verdict |
|---|---|---|---|
| **Save the festival** | A dud at 1, the crowd gasps and looks up, a finger finds the one path, slow-mo, then a cheer | Visible faces in the crowd, slow-mo on a last-second defuse, gasp/cheer audio, a "phew" camera beat | **Build (#1)** |
| **Whole-sky cascade to dawn** | One huge path, then a chain sweeps the entire sky with rising pitch, and night turns to sunrise | Rainbow+Rainbow / mega path = full-board cascade, rising-pitch audio, a dawn gradient on the final clear | **Build (#2)** |
| **Sky messages** | Fireworks spell "HAPPY BIRTHDAY ADA" over the crowd | Type a short message and the sky spells it (unlocked letter shapes). It shares as a link that opens in the browser demo, then "play to make your own" | **Build (#3)**, viral loop that uses the web build |
| Living crowd | People cheer, duck, and point at bursts | Part of #1, built anyway | Folded into #1 |
| Real-city nights | Lagos sky with a talking-drum picture | City art and pictures per Tour stop. Lagos is the slice city. Check landmark image rights | Art direction, not a hook |
| Shooting star / secret shapes | Surprise moments | Section 2 | Retention, not ads |

**Test before full production.** Record 15-second clips from the vertical slice: 2–3 cuts each of #1, #2 and #3, plus the plain gameplay. Run a small paid creative test with your approval and budget. Point traffic at a store "coming soon" page or the web demo. Compare click-through and cost per install between clips, and whether demo players finish 3+ levels. Build more of whatever wins, and drop hooks that don't move numbers.

## 5. Tech stack
| Piece | Choice | Why |
|---|---|---|
| Language/build | TypeScript + Vite | Fast reload, a tiny config, and Cursor handles it well. |
| Engine | **PixiJS v8** (current 8.20.x) | We already own the game logic (pure rules from the prototypes), so we need a fast renderer, not an engine. Pixi's strengths are exactly our look: particles (ParticleContainer), additive blending, filters, WebGL/WebGPU. Smaller bundle than Phaser. Phaser's extras (physics, tilemaps, its scene model) go unused, and porting the immediate-mode prototypes into its conventions is more work. Cost: we write a small scene/input layer, which the prototypes already have. |
| Tweens/audio | GSAP (free) for UI tweens. Howler.js for audio sprites and unlock handling | Proven, small. Keep synthesized SFX as placeholders. |
| Native wrap | Capacitor 8 (Capacitor 9 is due around late Nov 2026; upgrade once it's stable) | Same web code on Android and iOS, plus native plugins. |
| Plugins | @capacitor/haptics, @capacitor-community/admob (with the consent form), @revenuecat/purchases-capacitor, @capacitor/preferences (local save), splash screen, status bar | Cloud save later (Play Games / Game Center or a small backend). |
| Web | The same build on the web: a free demo, an ad landing page, and the sky-message link target | One codebase. |

**Performance budgets** (mid-range Android WebView; your phone is the reference device)

| Budget | Target |
|---|---|
| Frame | 60 fps. Game logic < 2 ms a frame. Auto-drop to a low tier if frames run long. |
| Particles | ≤ 1,500 live (low tier 600). Pre-baked glow sprites, no full-screen blur. |
| Rendering | < 50 draw calls. Render resolution capped at DPR 2. |
| Textures | Atlases ≤ 2048x2048. Total GPU texture memory < 100 MB. |
| Download | JS < 1.5 MB gzipped. Web demo first load < 5 MB, the rest lazy-loaded. |
| Cold start | < 3 s to playable on device, with the native splash covering the load. |

**Web-on-mobile risks**
- **WebView speed:** quality tiers, profile on a cheap Android in Phase 1 rather than at the end, avoid layout/DOM inside the game loop.
- **iOS audio:** unlock on the first touch, resume after ads, calls and backgrounding, and test with the silent switch on.
- **Safe areas:** `viewport-fit=cover` plus `env(safe-area-inset-*)`, and the HUD lays out inside the insets.
- **Native feel / Apple 4.2 (minimum functionality):**
  - no bounce, scroll, text selection or long-press menus
  - all assets bundled for offline play
  - haptics and IAP
  - never load the game from a remote URL
  - updates ship as level data only, never code

## 6. Quality
- **Unit tests (Vitest):** every Path rule, run on fixed random seeds so results repeat (adjacency, min 3, special by length, gravity and refill, duds, combo, secret shell), plus the Aiming trace, simulate and solver.
- **Level gates in CI:**
  - Aiming solver (ported from `solver-test.js`): solvable, par computed, zero turns fails, par and solution count in the day's band (section 3).
  - Path bot simulation (ported from `path-sim-test.js`): every start board has a move, greedy beats random by 30+ points, and every level passes the curve test and its bands (section 3).
- **E2E (Playwright):** scripted drag paths, a win with picture reveal, out of moves, a misfire, the album, a sky message, phone touch drag, plus screenshot checks for HUD overlaps.
- **Final-weight art perf check (a gate before the art pass is locked):** build a stress level (a full board of specials mid-combo, the full crowd, a sky-clearing burst, and maximum particles) as an APK using final-weight art: a finished art sample, or stand-in atlases at final resolution and layer count, with lighting, bloom and particles at maximum. Test it on a cheap Android phone (3–4 GB RAM, Mali-G52/Adreno-610 class). Pass (starting targets):
  - 60 fps typical
  - never below a steady 30 fps at worst load
  - startup under about 3 s
  - no thermal throttling over 10 minutes
  - GPU texture memory within the section 5 budget

  If it fails, cut art weight (layers, effects, atlas size) until it passes. Re-run it whenever the art direction changes.
- **Device checklist (you):** 60 fps feel, drag accuracy at the screen edges, sound on/off/silent, haptics, notch, background/resume, an ad mid-session, a cheap phone.
- **Loop for every chunk:** plan → implement → tests → review (diff plus screenshots) → plain commit.

## 7. Phases and gates
| Phase | Size | Done when (evidence) |
|---|---|---|
| **1. Port (parity with the prototypes)** | S–M | Both modes run in TS + Pixi with prototype rules and levels. Unit, CI and e2e tests green. An APK runs at 60 fps on your phone. The curve test (section 3) runs and prints the curve; on the 5 prototype levels it only warns. |
| **2. Vertical slice** | L | 10 Path levels pass the onboarding band and the curve test, and 7 Daily puzzles (Mon–Sun) fit the weekly curve (section 3). Pizzazz #1–#3 built. The final-weight art perf check (section 6) passes on a 3–4 GB Mali-G52/Adreno-610-class phone before the art pass is locked. Lagos art and audio pass done. 5 testers play 15 minutes without help. Ad clips recorded. |
| **3. Ad creative test** | S | Results in hand, and a go / no-go on the hook. Budget only with your approval. |
| **4. Android soft launch** | M | 60+ levels pass the curve test. Curve telemetry (section 3), ads, IAP and consent live. Crash-free sessions are tracked. Day-1 and Day-7 retention measured, with targets set from the data. |
| **5. iOS** | M | Passes App Store review (4.2, App Tracking Transparency prompt, IAP). Parity with Android. |

## 8. Monetization (tasteful)
- **Extra moves** on fail: +5 for coins or a rewarded ad. Offered once, with no countdown pressure.
- **Boosters:** Fuse Cutter (defuse a dud), Shuffle, Recolour (one rocket), Starter Comet. Earned often, also buyable.
- **Rewarded ads:** opt-in only (double coins, a free booster). Interstitials only between levels, rarely, none in the first levels.
- **Cosmetics:** album frames, trail styles, crowd outfits, sky themes, an optional festival pass.
- **Remove ads** as a one-time purchase.
- **No traps:** every level beatable without paying, no loot boxes, clear prices, no energy timers at launch.

## 9. Risks
| Risk | Mitigation |
|---|---|
| Crowded match genre | Lead with what's unique (sky clearing, the crowd, sky messages). Test hooks with ads before scaling. |
| Web performance on cheap Android | Budgets and quality tiers from day one. Test on a cheap device every phase. |
| Scope creep | Gates per phase. The slice is 10 levels and one city. New ideas go to a backlog. |
| Daily puzzle content | An in-browser level editor plus the solver. 30 days banked before launch. |
| Store review / ad SDK friction | Native-feel checklist, consent form, test builds early on both stores. |

## 10. Cursor starter prompt (Phase 1)
```
Port One Spark into a real web stack. References in this folder: prototype-path.html
(main game), prototype.html (daily "One Spark" puzzle), FINAL_PLAN.md, solver-test.js,
path-sim-test.js. Copy their rules, level data and feel; don't invent new rules.

Stack: TypeScript + Vite + PixiJS v8, Vitest, Playwright, Capacitor 8 (Android only for now).

Order, in small verified chunks (tests first for each):
1. Repo setup with lint, Vitest, Playwright and a CI script.
2. Pure TS rules with no rendering: the Path core (CORE section of prototype-path.html:
   seeded RNG, 8-way paths, min 3, Comet 5 / Peony 6-7 / Rainbow 8+, gravity/refill,
   duds, combo, secret shell, shuffle) and the Aiming core (trace, deterministic
   simulate, solver). Levels go in JSON. Unit tests for every rule.
3. Port solver-test.js and path-sim-test.js as CI gates with the same thresholds.
   Results must match the prototypes. Add the curve test from FINAL_PLAN.md section 3:
   level JSON gets tier, block, introduces, knobUp and a sim-written difficulty. In
   Phase 1 it only warns on the 5 prototype levels; from Phase 2 it fails the build.
4. Pixi greybox at parity: board, drag, bursts, the sky brightening per rocket, the crowd
   and dud fall, win picture reveal, Sky Album, menus, HUD with no overlaps, touch and mouse.
5. Playwright e2e: drag paths, win with reveal, out of moves, misfire, album, plus screenshots.
6. Capacitor Android build with haptics. Hit the performance budgets in FINAL_PLAN.md.

Rules: show me a running web build after chunk 4 and an APK on my phone after chunk 6.
Before the art pass is locked, build a final-weight art stress scene APK for the cheap-Android
perf check (FINAL_PLAN.md section 6) and stop for my device test.
Plain commits using my git config: no signing, no Co-authored-by or tool trailers,
never --no-verify. Ask before pushing. Report what's
unverified at each step.
```
