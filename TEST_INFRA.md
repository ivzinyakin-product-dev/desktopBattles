# Test Infrastructure & Opaque-Box Quality Architecture
## "Tensa Zangetsu: Soul Altar Defense"

**Document Version**: 1.0.0  
**Author**: E2E Test Engineering Specialist (`test_writer_e2e_1`)  
**Target Environment**: Node.js v24 (`node --test`), Browser DOM/Canvas Runtime  
**Status**: APPROVED & PUBLISHED  

---

## 1. Executive Summary & Quality Strategy

The testing architecture for **Tensa Zangetsu: Soul Altar Defense** enforces an **opaque-box, requirement-driven methodology**. The test suite treats the game engine and its gameplay modules as a deterministic state machine governed by the specifications outlined in `ORIGINAL_REQUEST.md` and `PROJECT.md`.

Testing operates across **four rigorous tiers**:
1. **Tier 1: Feature Coverage** — Verifies primary functional contracts across all 28 features (minimum 5 test cases per feature).
2. **Tier 2: Boundary & Corner Cases** — Stresses extreme physics values, sub-pixel math, clamping logic, collision thresholds, and rapid event interleaving (minimum 5 test cases per feature).
3. **Tier 3: Cross-Feature Combinations** — Validates pairwise and multi-system interactions (e.g., Blade Kinematics $\leftrightarrow$ Slicing $\leftrightarrow$ Particles $\leftrightarrow$ Audio $\leftrightarrow$ Altar State).
4. **Tier 4: Real-World Application Scenarios** — Executes complete end-to-end game loop simulations (Flawless Wave Defense, Swarm Incursions, Menos Grande Boss Battles, and Game Over / Replay cycles).

---

## 2. Test Harness Architecture & Portable Execution

### 2.1 Headless Browser Simulation Layer
Since the game targets modern web browsers (`HTML5 Canvas 2D` and `Web Audio API`), the E2E test harness embeds a lightweight, zero-dependency headless emulation shim within Node.js. This avoids heavyweight `npm` dependencies (such as `jsdom` or `puppeteer`) while allowing the game's modules to run at microsecond execution speeds:
- **Virtual Canvas & 2D Context Mock**: Tracks calls to `save()`, `restore()`, `clip()`, `drawImage()`, `fillRect()`, `arc()`, and detects composite operations (`screen`, `source-over`).
- **Web Audio Context Mock**: Simulates `AudioContext`, `BiquadFilterNode`, `OscillatorNode`, `GainNode`, and `WaveShaperNode`, verifying parameter automation curves and frequency ramps.
- **Local Storage Mock**: Provides in-memory key-value persistence for high-score tracking (`tensa_highscore`).
- **DOM & Input Event Shim**: Simulates mouse events (`mousemove`, `mousedown`, `contextmenu`) and keyboard events (`keydown`).

### 2.2 Universal Modular Pattern Compatibility
Each module under `src/engine/` and `src/game/` adheres to the Universal Module Pattern:
```javascript
window.TZ = window.TZ || {};
window.TZ.ModuleName = ModuleClass;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModuleClass;
}
```
The test harness imports these modules directly or retrieves them from the `window.TZ` namespace.

### 2.3 Progressive Testability & Graceful Feature Detection
The test runner is designed for continuous integration across development milestones (M1 through M5). If a module or feature is currently under active development and not yet committed, the test harness marks the corresponding suite as `PENDING / SKIPPED` rather than causing an unhandled crash. As implementation agents complete files, the tests automatically activate and assert real logic.

---

## 3. Feature Inventory & Test Mapping Matrix

| # | Feature Name | Primary Module | Acceptance Criteria Tested | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|--------------|----------------|----------------------------|:------:|:------:|:------:|:------:|
| 1 | Virtual Canvas & Viewport | `CanvasRenderer.js` | 1280x720 canonical resolution, crisp pixelated scaling, layers | 5 | 5 | Yes | Yes |
| 2 | 120Hz Fixed Timestep Loop | `GameLoop.js` | Substepping accumulator, delta clamping (0.1s), alpha interpolation | 5 | 5 | Yes | Yes |
| 3 | Vector2 Math & Swept Quad | `Vector2.js` | 2D vector ops, continuous collision detection (CCD), swept quad | 5 | 5 | Yes | Yes |
| 4 | Procedural RotMG SpriteGen | `SpriteGen.js` | 16x16 / 32x32 matrices, palette mapping, 1px dark border filter | 5 | 5 | Yes | Yes |
| 5 | Trauma Screen Shake Engine | `Camera.js` | Non-linear trauma-squared offset & rotation, decay rate 1.8/s | 5 | 5 | Yes | Yes |
| 6 | Spiritual Particle System | `ParticleSystem.js` | Crimson embers, kuroi smoke, bone shards, gravity, alpha fade | 5 | 5 | Yes | Yes |
| 7 | Mouse Kinematics & Filter | `Katana.js` | Exponential hilt smoothing (50 s^-1), velocity ring buffer | 5 | 5 | Yes | Yes |
| 8 | Dynamic Katana Orientation | `Katana.js` | Radial idle outward stance, dynamic forward rake angle on swing | 5 | 5 | Yes | Yes |
| 9 | Dual-Composite Getsuga Trail | `Katana.js` | Jet-black core ribbon (4px), screen-blended crimson aura, embers | 5 | 5 | Yes | Yes |
| 10 | Chained Tassel Verlet Physics | `Katana.js` | 8-node chain, pommel pin constraint, distance relaxation (5px) | 5 | 5 | Yes | Yes |
| 11 | Left-Click Forced Slash | `Katana.js` | 240° Senka arc slash, 0.35s cooldown, 1.5x damage, circle radius 100px | 5 | 5 | Yes | Yes |
| 12 | Right-Click / Space Crescent | `Katana.js` | Penetrating Kuroi Getsuga projectile (820 px/s, max 8 pierce, 1.8s CD) | 5 | 5 | Yes | Yes |
| 13 | Clean 2D Sprite Bisection | `Slicer.js` | Bisection along cut plane into two distinct physical halves | 5 | 5 | Yes | Yes |
| 14 | Severed Debris Physics | `Slicer.js` | Opposing separation velocities, tumbling angular speed, dissolution | 5 | 5 | Yes | Yes |
| 15 | Hollow Crawler Swarm AI | `Enemy.js` | Flocking separation, skittering sinusoidal gait, 8 contact damage | 5 | 5 | Yes | Yes |
| 16 | Hollow Flyer Harasser AI | `Enemy.js` | Inward spiral approach, high-speed dive (270 px/s), blade twitch | 5 | 5 | Yes | Yes |
| 17 | Armored Brute Vanguard AI | `Enemy.js` | Carapace ricochet (<600 px/s), heavy crack (>=600 px/s), bisection | 5 | 5 | Yes | Yes |
| 18 | Menos Grande Gillian Boss | `Enemy.js` | Standoff march, 2.5s Cero charge, 1.2s Cero beam (35 dmg), boss kill | 5 | 5 | Yes | Yes |
| 19 | Cero Deflection & Clash | `Katana.js` / `Enemy.js` | Blade sweep >= 450 px/s deflects Cero beam, nullifies altar damage | 5 | 5 | Yes | Yes |
| 20 | Soul Altar Defense Rules | `SoulAltar.js` | 100 HP, damage ONLY from enemy contact/Cero, 4 distress states | 5 | 5 | Yes | Yes |
| 21 | Continuous Wave Progression | `WaveManager.js` | Scaling count N(w), spawn interval T(w), alive cap, boss encounter | 5 | 5 | Yes | Yes |
| 22 | Score, Combo & Replay | `ScoreManager.js` | D to SSS multipliers, 2.0s decay timer, cleave bonuses, replay reset | 5 | 5 | Yes | Yes |
| 23 | Web Audio Retro Synth | `AudioSynth.js` | Procedural sound generation for all game events, auto-unlock | 5 | 5 | Yes | Yes |
| 24 | HTML5 UI & Retro HUD | `index.html` / `Game.js` | Altar HP bar, wave indicator, combo meter, game over overlay | 5 | 5 | Yes | Yes |
| 25 | Zero-Dep Node Static Server | `server.js` | HTTP static file delivery, MIME mapping, port fallback | 5 | 5 | Yes | Yes |
| 26 | Windows 1-Click Launcher | `run.bat` | Command-line script launching Node server or direct browser | 5 | 5 | Yes | Yes |
| 27 | Final E2E Test Suite | `test/test-e2e.js` | Unified automated test runner verifying Tiers 1–4 | - | - | - | - |
| 28 | Adversarial Stress & Hardening | `test/test-e2e.js` | Extreme input, memory leak, infinite loop, and crash protection | 5 | 5 | Yes | Yes |

---

## 4. Tier-by-Tier Specification & Coverage Methodology

### 4.1 Tier 1: Feature Coverage (Primary Functional Contracts)
Validates that each feature behaves strictly according to its specification under standard operational parameters:
- **T1.1 Core Engine & Vector Math**:
  - `Vector2` arithmetic: `add`, `sub`, `scale`, `normalize`, `dot`, `cross`, `dist`, `lerp`.
  - `SweptQuad` convex polygon generation and circle intersection.
  - `GameLoop` fixed timestep accumulation at 120Hz (8.33ms physics steps) with interpolation alpha.
  - `CanvasRenderer` virtual resolution 1280x720 canvas rendering.
  - `Camera` trauma-squared screen shake decay and context transforms.
  - `SpriteGen` matrix parser, color palettes, and automated 1-pixel dark border generation.
  - `ParticleSystem` lifespan, velocity, and gravity decay for Reiatsu embers, smoke, and bone shards.
- **T1.2 Blade Kinematics, Getsuga & Tassel**:
  - `Katana` hilt tracking via exponential filter ($\lambda = 50.0\text{ s}^{-1}$).
  - Dynamic orientation: radial outward stance when idle; forward rake tilt when swinging ($S_m \ge 280\text{ px/s}$).
  - Getsuga trail dual-composite structure: outer crimson aura and 4px black core ribbon.
  - Pommel chain 8-node Verlet integration with rigid distance constraints ($d_0 = 5\text{ px}$).
  - Forced slash ("Senka" arc): 240° sweep, 0.35s cooldown, 100px radius hit registration.
  - Crescent wave ("Kuroi Getsuga"): 820 px/s projectile velocity, piercing logic, 1.8s cooldown.
- **T1.3 Slicing Engine & Enemy Ecosystem**:
  - `Slicer` bisection: splits sprite cleanly along cut plane into two non-overlapping halves.
  - Severed debris: opposing repulsion velocities ($\vec{v}_1 \cdot \hat{n} > 0$, $\vec{v}_2 \cdot \hat{n} < 0$), tumbling rotation, 0.85s dissolution.
  - Hollow Crawler: flocking separation, sinusoidal skittering gait, 8 contact damage.
  - Hollow Flyer: logarithmic spiral approach, high-speed dive (270 px/s), blade twitch evade.
  - Armored Brute: carapace ricochets swings $< 600\text{ px/s}$; cracks on heavy swing $\ge 600\text{ px/s}$.
  - Menos Grande: standoff march, 2.5s Cero charge, 1.2s Cero beam, 35 damage infliction.
  - Cero deflection: blade sweep $\ge 450\text{ px/s}$ nullifies Cero damage and stuns boss.
- **T1.4 Altar Defense, Waves, Score & Audio**:
  - Soul Altar: 100 initial HP, strict damage exclusivity (sword = 0, projectiles = 0, enemies = positive damage).
  - Altar distress states: `INTACT` ($75\text{–}100$), `DAMAGED` ($40\text{–}74$), `CRITICAL` ($1\text{–}39$), `DESTROYED` ($\le 0$).
  - Wave Manager: mathematical density scaling $N(w) = \lfloor 10 + 6w + 1.2w^{1.3} \rfloor$, spawn intervals, boss milestone encounters (Wave 5, 8, 10).
  - Score & Combo: base values (Crawler 100, Flyer 150, Brute 300, Menos 1500), multipliers (D $1.0\times$ to SSS $6.0\times$), 2.0s combo decay.
  - AudioSynth: synthesizes retro procedural sounds for slash, clash, getsuga, hollow death, cero, altar hit, game over.
  - Infrastructure: `server.js` HTTP responses and MIME types; `run.bat` presence and syntax.

---

### 4.2 Tier 2: Boundary & Corner Cases (Extreme Values & Failure Modes)
Stress-tests boundary conditions, edge limits, and mathematical extremes:
- **T2.1 Kinematic & Collision Extremes**:
  - Ultra-high velocity mouse whip ($10,000\text{ px/s}$): CCD SweptQuad detects collision without tunneling.
  - Zero velocity / stationary mouse: blade smoothly rests in defensive radial stance.
  - Coincident points: distance and normalization when $\vec{v} = (0, 0)$ without `NaN` or `Infinity`.
  - Screen boundary clamping: mouse movements outside canvas coordinates clamped gracefully.
- **T2.2 Altar Health Boundaries & Exclusivity**:
  - Health clamped at upper bound: wave clear heal cannot exceed 100 HP.
  - Health clamped at lower bound: damage cannot reduce HP below 0.
  - Damage throttle: 10 enemies hitting simultaneously capped at 30 damage per frame batch.
  - Friendly fire boundary: 100 consecutive forced slashes through Altar inflict exactly 0 damage.
- **T2.3 Wave Progression Boundaries**:
  - Wave 1 boundary conditions ($w = 1$).
  - High-wave scalability stress ($w = 50$): alive cap and spawn intervals respect safety clamps.
  - Mid-wave zero enemy state: correctly transitions to wave clear without hanging.
- **T2.4 Slicer & Geometry Corners**:
  - Tangential graze: cut line tangent to enemy bounding radius.
  - Centroid cut: cut passing through exact sprite center $(0, 0)$.
  - Exact vertical ($\theta = \pi/2$) and horizontal ($\theta = 0$) cut planes.
  - Projectile pierce limit: crescent wave hits exactly 8 enemies and dissipates on 9th.
- **T2.5 Combat Threshold Boundaries**:
  - Armored Brute threshold: swing speed $599\text{ px/s}$ ricochets; $600\text{ px/s}$ cracks carapace.
  - Cero deflection threshold: swing speed $449\text{ px/s}$ fails to deflect; $450\text{ px/s}$ deflects.
  - Combo timer decay: combo valid at $1.999\text{s}$; drops to zero at $2.001\text{s}$.

---

### 4.3 Tier 3: Cross-Feature Combinations (Systemic Interactions)
Validates that multiple subsystems integrate smoothly without state corruption:
- **T3.1 Blade Swing $\rightarrow$ Slicing $\rightarrow$ Particles $\rightarrow$ Shake $\rightarrow$ Audio**:
  - High-speed blade sweep cuts Crawler.
  - Slicer bisects sprite into two physical debris halves.
  - Particle system emits 20+ Reiatsu embers and bone shards.
  - Camera trauma increments by $+0.12$.
  - AudioSynth triggers `playHollowDeath('crawler')`.
- **T3.2 Forced Slash $\rightarrow$ Multi-Kill Cleave $\rightarrow$ Combo Multiplier**:
  - Left-click triggers 240° Senka arc.
  - Slices 3 enemies in one sweep.
  - Cleave bonus score computed ($2 \times 200 = 400\text{ bonus pts}$).
  - Combo increments and advances rank from D to C ($1.5\times$).
  - Camera trauma increments by $+0.25$.
- **T3.3 Cero Beam $\rightarrow$ Blade Sweep $\rightarrow$ Deflection & Boss Stun**:
  - Menos Grande charges Cero ($2.5\text{s}$) and fires beam toward Altar.
  - Player sweeps Katana through beam ($v \ge 450\text{ px/s}$).
  - Deflection event nullifies Altar damage.
  - Menos Grande transitions to stunned state ($1.5\text{s}$).
  - AudioSynth plays steel clash / parry SFX.
- **T3.4 Armored Brute $\rightarrow$ Ricochet $\rightarrow$ Carapace Crack $\rightarrow$ Bisection**:
  - Swing 1 ($400\text{ px/s}$): Ricochets off armor, plays clash SFX, spawns sparks.
  - Swing 2 ($750\text{ px/s}$): Cracks carapace, stuns Brute ($1.2\text{s}$), plays fracture SFX.
  - Swing 3: Bisects unarmored Brute cleanly into debris halves.
- **T3.5 Swarm Incursion $\rightarrow$ Altar Collision $\rightarrow$ State Progression**:
  - Multiple Crawlers reach Altar radius ($R = 36\text{ px}$).
  - Altar absorbs impact, triggers screen flash and trauma.
  - Altar HP drops below 75 $\rightarrow$ visual transition to `DAMAGED`.
  - Altar HP drops below 40 $\rightarrow$ visual transition to `CRITICAL`.
- **T3.6 Wave Clear $\rightarrow$ Reishi Restoration $\rightarrow$ State Recovery**:
  - Wave completes with Altar at 60 HP (`DAMAGED`).
  - Altar channels Reishi, restoring $+15\text{ HP}$ to 75 HP.
  - Altar transitions back to `INTACT` state.

---

### 4.4 Tier 4: Real-World Application Scenarios (Full Game Simulations)
Simulates end-to-end player sessions from title launch to game over:
- **T4.1 Scenario A: "The First Wave - Flawless Defense"**:
  - Game boots into `PLAYING` state at Wave 1.
  - Player tracks mouse, sweeping blade across 17 incoming Crawlers.
  - All 17 Crawlers bisected before reaching Altar radius.
  - Altar finishes wave with $100\text{ HP}$ ($0\text{ damage taken}$).
  - Combo reaches 17 ($2.0\times$ Kuroi Getsuga rank).
  - Wave 1 clears successfully and transitions to Wave 2.
- **T4.2 Scenario B: "Desperate Defense - Swarm Incursion & Recovery"**:
  - Wave 3 spawns mixed swarm (Crawlers, Flyers, Brutes).
  - High density causes 2 Crawlers and 1 Flyer to breach defenses ($8 + 8 + 12 = 28\text{ damage}$).
  - Altar HP drops to 72 (`DAMAGED` state).
  - Player unleashes Left-Click Forced Slash and Right-Click Kuroi Getsuga wave, eliminating remaining swarm.
  - Wave clear triggers $+15\text{ HP}$ recovery, restoring Altar to 87 HP.
- **T4.3 Scenario C: "Menos Grande Boss Battle & Cataclysmic Bisection"**:
  - Wave 5 milestone: Menos Grande Gillian spawns at screen perimeter.
  - Menos advances to $280\text{ px}$ standoff, powers up Cero charging orb.
  - Menos fires $1.2\text{s}$ Cero beam. Player intercepts beam with blade sweep ($500\text{ px/s}$), deflecting the blast.
  - Player counterattacks with Kuroi Getsuga crescent wave and consecutive blade slashes.
  - Menos HP reaches 0: giant Gillian bisects into colossal debris halves, triggering screen flash, clearing screen, and awarding 1500 points.
- **T4.4 Scenario D: "Altar Fall, Game Over & Instant Replay Loop"**:
  - Catastrophic swarm reduces Altar HP from 20 to 0.
  - Engine transitions state to `GAME_OVER`.
  - Time scale slows to $0.2\times$, Game Over audio arpeggio plays.
  - High score saved to `localStorage`.
  - Player triggers instant restart (`replay()` / `[SPACE]`).
  - State cleanly reinitializes: Altar HP reset to 100, Wave reset to 1, score reset to 0, all active enemies and debris purged.
  - Game resumes active loop without memory leaks or duplicate listeners.

---

## 5. Test Suite Execution & Output Format

### 5.1 Native Test Command
```bash
node --test test/test-e2e.js
```

### 5.2 Test Runner Output & Reporting
The test suite utilizes Node.js v24 `node:test` sub-suites. Every tier is encapsulated in a distinct `describe()` block:
- `[TIER 1] Feature Coverage`
  - `Core Engine & Vector Math (F1, F2, F3)`
  - `Procedural Sprites & Visual FX (F4, F5, F6)`
  - `Katana Kinematics & Blade Dynamics (F7, F8, F9, F10)`
  - `Special Attacks (F11, F12)`
  - `Slicing Engine & Enemy AI (F13, F14, F15, F16, F17, F18, F19)`
  - `Soul Altar, Waves, Score & Audio (F20, F21, F22, F23)`
  - `Launcher & Infrastructure (F25, F26)`
- `[TIER 2] Boundary & Corner Cases`
  - `Kinematics & CCD Velocity Extremes`
  - `Altar Health & Damage Exclusivity Bounds`
  - `Slicing Geometry & Pierce Limits`
  - `Combat & Parrying Velocity Thresholds`
  - `Wave Pacing & Clamping Extremes`
- `[TIER 3] Cross-Feature Combinations`
  - `Blade Cut -> Slicer -> Particles -> Camera Trauma`
  - `Forced Slash -> Multi-Kill Cleave -> Combo Progression`
  - `Menos Cero Beam -> Katana Deflection -> Boss Stun`
  - `Armored Brute Ricochet -> Crack -> Clean Bisection`
  - `Swarm Breach -> Altar Distress -> Wave Clear Recovery`
- `[TIER 4] Real-World Application Scenarios`
  - `Scenario A: Flawless Wave 1 Defense`
  - `Scenario B: Swarm Incursion & Defensive Recovery`
  - `Scenario C: Menos Grande Boss Encounter & Cero Deflection`
  - `Scenario D: Altar Collapse, Game Over & Replay Loop`

This structure ensures granular visibility into project health and guides milestone implementation.
