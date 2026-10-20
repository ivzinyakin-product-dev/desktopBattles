# ⚔️ Tensa Zangetsu: Soul Altar Defense

[![Tests Passing](https://img.shields.io/badge/Tests-311%2F311%20Passed-brightgreen.svg)](test/test-e2e.js)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20(Vanilla%20JS)-blue.svg)](package.json)
[![Platform](https://img.shields.io/badge/Platform-Web%20%2F%20Desktop-orange.svg)](run.bat)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Art Style](https://img.shields.io/badge/Art-RotMG%20Pixel%20Style-purple.svg)](src/engine/SpriteGen.js)

> **Tensa Zangetsu: Soul Altar Defense** is a high-octane desktop web arcade slasher combining **Realm of the Mad God (RotMG)** retro pixel-art with **Bleach** anime lore. 
> 
> Direct the pitch-black Bankai blade (**Tensa Zangetsu**) using high-speed mouse sweeps to slice incoming armies of Hollows along clean 2D cut planes, deflect devastating Cero beams, and defend the central **Soul Altar** across escalating waves of spiritual warfare.

---

## 🎮 Key Gameplay Mechanics

### 1. Dynamic Mouse Blade Kinematics & Verlet Physics
* **Direct Blade Tracking**: The katana hilt follows the cursor via exponential smoothing ($\lambda = 50\text{ s}^{-1}$), dynamically transitioning between a radial resting stance and a forward-raked cutting stance (+0.35 rad) during fast mouse sweeps.
* **Getsuga Tensho Trail**: 16-sample ribbon trail using dual-composite blending (glowing screen-blended crimson aura + 4px jet-black core).
* **Verlet Chain Tassel**: 8-node physical chain attached to the pommel with distance relaxation constraints, swaying naturally upon violent mouse whips.
* **Senka Arc Slash [Left-Click]**: Forced 240° circular sweep over 150ms with ease-out cubic velocity, high damage multiplier, and screen shake.
* **Kuroi Getsuga Wave [Right-Click / Spacebar]**: Ranged crescent projectile (820 px/s) piercing up to 8 enemies in a line.

### 2. Analytical 2D Sprite Bisection (Slicer Engine)
* **True Polygon Splitting**: Slashed Hollows are mathematically bisected along the exact cut plane perpendicular to blade motion.
* **Debris Physics**: Severed halves receive lateral separation impulses and angular tumbling velocities (5–9 rad/s), dissolving into spiritual Reiatsu particles over 0.85s.
* **Continuous Collision Detection (CCD)**: Custom `SweptQuad` volume collision prevents tunneling even under $10,000\text{ px/s}$ mouse whips.

### 3. Hollow Swarm Ecosystem & Menos Grande Boss
* 🕷️ **Hollow Crawlers**: Fast swarm infantry using flocking separation (Boids algorithm) rushing the Altar (1-hit kill).
* 🦇 **Hollow Flyers**: Agile scouts executing inward logarithmic spirals with reactive blade evasion and high-speed dives (270 px/s).
* 🛡️ **Armored Brutes**: Heavy vanguards. Weak swings ($< 600\text{ px/s}$) ricochet with metallic clashing sparks; heavy slashes ($\ge 600\text{ px/s}$) crack the carapace.
* 👹 **Menos Grande Gillian Boss**: Giant 32x32 colossus. Halts at 280px standoff, charges a destructive Cero beam (2.5s telegraph), and unleashes a massive laser (35 damage).
* ⚡ **Cero Blade Deflection**: Time a high-speed slash ($\ge 450\text{ px/s}$) across the Cero beam to slice and deflect the laser, stunning the Menos Grande!

### 4. Soul Altar Defense & Wave Progression
* **100 HP Core**: Center monument with 4 visual health phases (`INTACT` $\to$ `DAMAGED` $\to$ `CRITICAL` $\to$ `DESTROYED`).
* **Friendly-Fire Immunity**: The player's blade never damages the Altar.
* **Wave Recovery**: Clearing all enemies in a wave restores +15 HP to the Altar.
* **Bleach Rank Ladder**: Combo multiplier scaling from $1.0\times$ to $6.0\times$ with titles:
  $$\text{Shikai} \longrightarrow \text{Bankai} \longrightarrow \text{Getsuga} \longrightarrow \text{Kuroi Getsuga} \longrightarrow \text{Hollowfied} \longrightarrow \text{Mugetsu}$$

### 5. 100% Procedural Assets (Zero External Files)
* **RotMG Pixel Art**: 11 procedural 16x16 / 32x32 sprite matrices with automated 4-way 1px dark borders cached on offscreen canvases.
* **Procedural Web Audio Synthesizer**: Custom retro sound generator using oscillators, biquad filters, and noise buffers (blade slashes, steel clashing, Hollow death crunches, Cero drone & beam, Altar hits, Game Over despair arpeggio).

---

## 🕹️ Controls

| Input | Action | Details |
| :--- | :--- | :--- |
| **Mouse Motion** | **Swing Blade** | Move mouse faster than 280 px/s to slice enemies |
| **Left Click (LMB)** | **Senka Slash** | Instant 240° circular arc slash (0.35s cooldown) |
| **Right Click (RMB) / Space** | **Kuroi Getsuga** | Ranged piercing crescent wave (1.8s cooldown) |
| **[F]** | **Fullscreen** | Toggle borderless fullscreen display |
| **[P] / [Esc]** | **Pause** | Pause or resume battle |
| **[R]** | **Restart** | Instant replay / reset during battle or game over |

---

## 🚀 Quick Start

### Option A: Windows 1-Click Launch (Recommended)
Simply double-click the included batch launcher:
```cmd
run.bat
```
*If Node.js is installed, it starts the local server and opens your browser. If Node.js is not present, it launches `index.html` directly.*

### Option B: Node.js Local Server
Run with native Node.js (no npm packages required):
```bash
npm start
# or
node server.js
```
Then visit **`http://localhost:8080/`** in any modern web browser.

### Option C: Direct Browser Opening
Simply double-click `index.html` to open it in your browser of choice.

---

## 🧪 Testing & Verification

The project features a 4-tier opaque-box test suite running on Node.js's native test runner (`node:test`).

Run all test suites (311 tests):
```bash
npm test
```
Or run individual suites:
```bash
npm run test:engine   # Vector2, CCD, GameLoop, CanvasRenderer, Camera, Particles, SpriteGen
npm run test:combat   # Katana kinematics, Getsuga trails, Verlet tassel, Slicer, Enemy AI
npm run test:e2e      # 4-tier end-to-end integration and adversarial stress suite
```

```text
▶ Feature 1-28: Complete Architecture Coverage
ℹ tests 311
ℹ suites 58
ℹ pass 311
ℹ fail 0
ℹ duration_ms 170ms
```

---

## 📁 Repository Structure

```text
desktopBattles/
├── index.html              # HTML5 Canvas viewport, HUD layout, and bootstrapper
├── styles.css              # Retro arcade styling, CRT scanline shader overlay
├── server.js               # Zero-dependency local static HTTP server (MIME, security)
├── run.bat                 # Windows 1-click dual-mode launcher
├── package.json            # Scripts & project metadata (zero dependencies)
├── LICENSE                 # MIT License
├── README.md               # Game manual and architectural documentation
├── src/
│   ├── engine/
│   │   ├── Vector2.js          # 2D math & Continuous Collision Detection (SweptQuad)
│   │   ├── Camera.js           # Trauma-squared (T^2) camera screen shake engine
│   │   ├── CanvasRenderer.js   # 1280x720 virtual viewport & pixelation pipeline
│   │   ├── GameLoop.js         # 120Hz fixed-timestep physics accumulator
│   │   ├── ParticleSystem.js   # Zero-allocation pool for Reiatsu embers & smoke
│   │   ├── SpriteGen.js        # Procedural RotMG 16x16 / 32x32 sprite matrices
│   │   └── AudioSynth.js       # Procedural Web Audio API sound synthesizer
│   └── game/
│       ├── Katana.js           # Blade kinematics, Getsuga trail, Verlet tassel
│       ├── Projectile.js       # Kuroi Getsuga crescent wave projectiles
│       ├── Slicer.js           # Analytical 2D sprite polygon bisection & debris
│       ├── Enemy.js            # Crawlers, Flyers, Armored Brutes, Menos Grande Boss
│       ├── SoulAltar.js        # Soul Altar entity (100 HP, 4 states, wave heals)
│       ├── WaveManager.js      # Wave scaling formula N(w) & milestone boss logic
│       ├── ScoreManager.js     # Score multiplier ladder (D->SSS) & Bleach ranks
│       └── Game.js             # Master coordinator, floating text, and HUD
└── test/
    ├── test-engine.js      # Engine unit tests (54 tests)
    ├── test-combat.js      # Combat & slicing unit tests (86 tests)
    └── test-e2e.js         # 4-tier comprehensive integration test suite (171 tests)
```

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
Feel free to fork, modify, and build upon it!
