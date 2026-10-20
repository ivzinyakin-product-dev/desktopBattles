# Project: Tensa Zangetsu: Soul Altar Defense

## Architecture
- **Paradigm**: Standalone HTML5 Canvas 2D Arcade Game with Procedural Pixel Art & Web Audio API Synthesis.
- **Runtime Execution**: Zero external dependencies. Runnable either directly in modern browsers via standard scripts or via local HTTP static server (`server.js`) launched by Windows `run.bat`.
- **Modularity & Compatibility**: Universal Modular Pattern (`window.TZ = window.TZ || {}` with CommonJS/ESM conditional exports `if (typeof module !== 'undefined' && module.exports) { module.exports = ... }`).
- **Timing & Physics**: 120Hz fixed-timestep accumulator game loop decoupled from `requestAnimationFrame` rendering, guaranteeing continuous collision detection (CCD) for high-velocity mouse sweeps and stable Verlet distance constraint relaxation for the chained katana tassel.
- **Visuals**: RotMG (Realm of the Mad God) retro pixel art aesthetic (16x16 / 32x32 sprites generated procedurally onto offscreen canvases with automated 1-pixel dark borders, blitted with `imageSmoothingEnabled = false`).
- **Audio**: 100% procedural Web Audio API synthesis graph (oscillators, noise buffers, biquad filters, distortion, gain envelopes) with user-interaction auto-resume.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Virtual Canvas & Viewport | 1280x720 canonical resolution, crisp pixelated scaling, aspect-ratio preservation | M1 | Survey 1 |
| 2 | 120Hz Fixed Timestep GameLoop | Substepping accumulator loop, delta time clamping, interpolation factor | M1 | Survey 1 |
| 3 | Vector2 Math & Swept Quad CCD | 2D vector utilities, line-segment sweep convex quad collision detection | M1 | Survey 1, 2 |
| 4 | Procedural RotMG Sprite Generator | 16x16 / 32x32 sprite matrices with 1px dark border for Katana, Altar, Hollows | M1 | Survey 3 |
| 5 | Trauma Screen Shake Engine | Non-linear trauma-squared camera offset and angular perturbation | M1 | Survey 2 |
| 6 | Spiritual Particle System | Crimson Reiatsu embers, kuroi smoke, bone fragments, alpha fade | M1 | Survey 2 |
| 7 | Mouse Kinematics & Velocity Filter | Exponential hilt smoothing (50 s^-1) and velocity ring buffer | M2 | Survey 2 |
| 8 | Dynamic Katana Stance & Orientation | Radial idle stance outward from Altar, dynamic forward rake angle on swing | M2 | Survey 2 |
| 9 | Dual-Composite Getsuga Trail | Jet-black core ribbon with screen-blended crimson aura and embers | M2 | Survey 2 |
| 10 | Chained Tassel Verlet Physics | 8-node Verlet chain on pommel with distance constraint relaxation | M2 | Survey 2 |
| 11 | Left-Click Forced Slash | 240° circular Senka arc slash with high damage and screen shake | M2 | Survey 2 |
| 12 | Right-Click / Spacebar Crescent Wave | Ranged penetrating Kuroi Getsuga Tensho projectile wave | M2 | Survey 2 |
| 13 | Clean 2D Sprite Bisection Slicing | Slicing entity along cut plane vector into two distinct physical halves | M3 | Survey 2 |
| 14 | Severed Debris Physics & Dissolution | Lateral separation impulses, angular tumbling, spiritual smoke dissolution | M3 | Survey 2 |
| 15 | Hollow Crawler Swarm AI | Skittering flocking ground fodder advancing on Altar, contact damage | M3 | Survey 2 |
| 16 | Hollow Flyer Harasser AI | High-speed spiral dive behavior, evasive twitch upon blade approach | M3 | Survey 2 |
| 17 | Armored Brute Vanguard AI | Carapace armor ricochets light slashes, cracks under heavy swing, bisection | M3 | Survey 2 |
| 18 | Menos Grande Gillian Boss AI | Standoff march, telegraph laser, 2.5s Cero charge, 1.2s Cero beam at Altar | M3 | Survey 2 |
| 19 | Cero Deflection & Blade Clash | Tensa Zangetsu blade sweep clashing with Cero beam nullifies damage | M3 | Survey 2 |
| 20 | Soul Altar State & Defense Rules | 100 HP, damage ONLY from enemy contact or Cero, distress visual stages | M4 | Survey 3 |
| 21 | Continuous Wave Progression | Mathematical density scaling, spawn pacing, boss milestone encounters | M4 | Survey 3 |
| 22 | Score, Combo & Replay System | D to SSS combo multipliers, survival timer, stats, instant replay loop | M4 | Survey 3 |
| 23 | Web Audio API Retro Synth | Zero-asset crunchy procedural sound effects for all actions and events | M4 | Survey 3 |
| 24 | HTML5 UI & Retro HUD Overlay | Altar HP bar, wave indicator, combo meter, game over modal | M5 | Survey 1, 3 |
| 25 | Zero-Dependency Node Static Server | Lightweight Node.js HTTP server (`server.js`) | M5 | Survey 1, 3 |
| 26 | Windows 1-Click Launcher | `run.bat` dual-mode launcher (Node server or direct browser open) | M5 | Survey 1, 3 |
| 27 | Final E2E Test Suite (Tiers 1-4) | 100% pass of automated E2E test cases across all features | M5 | Project Pattern |
| 28 | Adversarial Coverage Hardening | White-box Tier 5 stress tests and gap closure | M5 | Project Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Engine Core, Math, Loop, Sprites & FX | Vector2, GameLoop, CanvasRenderer, SpriteGen, Camera/Shake, ParticleSystem | none | DONE |
| M2 | Tensa Zangetsu Blade Kinematics, Trail & Tassel | Katana controller, mouse tracking, Getsuga trail, Verlet tassel, forced slash, crescent wave | M1 | DONE |
| M3 | Slicing Engine & Enemy Swarm Ecosystem | Slicer bisection algorithm, debris physics, Crawler, Flyer, Brute, Menos Grande Cero & Deflection | M1, M2 | DONE |
| M4 | Soul Altar Defense, Waves & Web Audio Synth | Soul Altar, WaveManager, ScoreManager, AudioSynth engine | M1, M2, M3 | IN_PROGRESS |
| M5 | System Integration, Launcher & E2E Acceptance | index.html, styles.css, server.js, run.bat, 100% E2E test pass (T1-4), Tier 5 hardening | M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### M1 Math/Renderer ↔ M2 Katana
- `TZ.Vector2`: `constructor(x, y)`, `add(v)`, `sub(v)`, `scale(s)`, `mag()`, `magSq()`, `normalize()`, `dist(v)`, `dot(v)`, `cross(v)`, `lerp(v, t)`.
- `TZ.SweptQuad`: `constructor(p1, p2, p3, p4)`, `intersectsCircle(center, radius)`.
- `TZ.ParticleSystem`: `spawnEmbers(x, y, count, angle, color)`, `spawnSmoke(x, y, count)`, `spawnShards(x, y, count)`, `update(dt)`, `draw(ctx)`.
- `TZ.Camera`: `addTrauma(amount)`, `shake(ctx, callback)`.

### M2 Katana ↔ M3 Slicer & Enemies
- `TZ.Katana`:
  - `hilt`: `{ x, y }`, `tip`: `{ x, y }`, `prevHilt`: `{ x, y }`, `prevTip`: `{ x, y }`
  - `speed`: `number`, `isSlashing`: `boolean`, `angle`: `number`
  - `getBladeSegment()`: returns `{ hilt, tip, prevHilt, prevTip }`
  - `getSweptQuad()`: returns `TZ.SweptQuad`
  - `projectiles`: Array of `TZ.GetsugaWave` (`{ x, y, vx, vy, radius, life, update, draw }`)
- `TZ.Slicer`:
  - `sliceEnemy(enemy, cutPoint, cutAngle, swingSpeed, swingVel)`: returns `[HalfA, HalfB]` as debris entities.

### M3 Enemies ↔ M4 Soul Altar & WaveManager
- `TZ.Enemy`:
  - `x`, `y`, `radius`, `hp`, `speed`, `type`, `isDead`
  - `update(dt, altarPos, katana)`: returns collision event if touching altar
  - `onHit(damage, cutNormal, cutAngle, swingSpeed)`: handles damage / bisection
- `TZ.SoulAltar`:
  - `x`, `y`, `radius` ($36\text{px}$), `hp` (max 100)
  - `takeDamage(amount)`: decreases HP, triggers screen shake, updates state
  - `isDestroyed()`: boolean (`hp <= 0`)
- `TZ.AudioSynth`:
  - `playSlash(speed)`, `playClash()`, `playGetsugaWave()`, `playHollowDeath(type)`, `playCeroCharge()`, `playCeroBlast()`, `playAltarHit()`, `playGameOver()`.

## Code Layout
```
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\
├── index.html                   # HTML5 shell, canvas, HUD UI overlays
├── styles.css                   # Canvas layout, RotMG scanlines, pixel font styling
├── run.bat                      # Windows 1-click launcher (Node server / direct browser)
├── server.js                    # Zero-dependency local Node.js HTTP server
├── src/
│   ├── engine/
│   │   ├── Vector2.js           # 2D Vector math, swept quad CCD utilities
│   │   ├── GameLoop.js          # Fixed timestep (120Hz physics accumulator, rAF)
│   │   ├── CanvasRenderer.js    # 1280x720 virtual canvas, DPI scaling, layer rendering
│   │   ├── Camera.js            # Trauma-squared screen shake and viewport transforms
│   │   ├── ParticleSystem.js    # Reiatsu spiritual embers, smoke, mask bone shards
│   │   ├── AudioSynth.js        # 100% procedural Web Audio API retro sound engine
│   │   └── SpriteGen.js         # Procedural RotMG 16x16 / 32x32 sprite generator & cache
│   └── game/
│       ├── Katana.js            # Tensa Zangetsu kinematics, Getsuga trail, Verlet tassel, waves
│       ├── Slicer.js            # 2-half polygon bisection algorithm, debris separation physics
│       ├── Enemy.js             # Hollow Crawler, Flyer, Armored Brute, Menos Grande boss AI
│       ├── SoulAltar.js         # Soul Altar entity (100 HP, damage rules, aura pulse)
│       ├── WaveManager.js       # Wave density scaling, spawn pacing, boss encounters
│       ├── ScoreManager.js      # Score tracking, combo ranks (D to SSS), survival time
│       └── Game.js              # Master state coordinator (Title, Playing, GameOver)
├── test/
│   ├── test-engine.js           # Core engine, vector math & sprite generator tests
│   ├── test-combat.js           # Blade kinematics, trail, tassel & slicing tests
│   ├── test-defense.js          # Altar damage exclusivity, waves & audio mocks
│   └── test-e2e.js              # Comprehensive E2E opaque-box suite (Tiers 1-4)
```
