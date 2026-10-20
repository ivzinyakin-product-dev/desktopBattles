# Handoff Report: Survey Explorer 3
**Project**: Tensa Zangetsu: Soul Altar Defense
**Scope**: Technical Specifications & Algorithmic Designs for R3 (Soul Altar Defense & Wave Progression), R4 (Procedural Pixel Art & Web Audio Synth), and R5 & Verification (Standalone Canvas Architecture, Windows Launcher, and Test Suite).
**Author**: Survey Explorer 3
**Date**: 2026-10-18T14:27:00Z
**Target Audience**: Orchestrator, Milestone Implementers, and Test Engineers

---

## 1. Observation

### 1.1 Workspace & Environment State
- **Workspace Directory**: `c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles`
- **Initial File Structure**:
  - `src/engine/` (empty directory)
  - `src/game/` (empty directory)
  - `README.md` (30 bytes placeholder)
  - No existing code, no dependencies, no `package.json`
- **Runtime Environment (Verified via CLI)**:
  - `node`: `v24.20.0` available and operational. Includes native `node:test`, `node:assert`, ES module loader, and built-in HTTP server capabilities.
  - `python`: Not installed / unavailable.
  - `git`: Not recognized in PATH.
  - `msedge.exe`: Located and verified at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Capable of headless browser execution (`--headless --dump-dom`).

### 1.2 Target Requirements (From `ORIGINAL_REQUEST.md`)
- **R3. Soul Altar Defense & Wave Progression**:
  - Soul Altar in center with 100 HP.
  - Damage rules: Altar takes damage **only** from direct enemy contact or Menos Grande Cero beam.
  - Continuous scaling of wave density and intensity; Menos Grande boss encounter at wave thresholds.
  - Score tracking: survival time, kill count, combo multipliers, game over modal with instant replay.
- **R4. Procedural Pixel Art & Web Audio Synth**:
  - RotMG (Realm of the Mad God) 16x16 / 32x32 pixel art procedurally generated for Tensa Zangetsu, Soul Altar, and 4 Hollow types (Crawler, Flyer, Brute, Menos Grande).
  - 100% zero external asset dependencies.
  - Web Audio API procedural synthesis for blade slashes, steel clashes, hollow cries, Cero charging and blast, altar damage, game over.
- **R5. One-Click Launch & Verification**:
  - Standalone HTML5 Canvas architecture.
  - Windows `run.bat` for instant launch without setup.
  - Automated test runner and verification suite for all acceptance criteria.

---

## 2. Logic Chain

### 2.1 Section 1: R3 - Soul Altar Defense & Wave Progression

#### A. Altar Spatial Geometry & State Dynamics
1. **Spatial Representation**:
   - Central coordinates: $C = (W/2, H/2)$ in a virtual canvas space of $1024 \times 768$ (or dynamic window resolution).
   - Collision Radius: $R_{\text{altar}} = 36\text{ px}$.
   - Interaction Boundary: Circular radial hitbox provides continuous equidistant defense coverage from all $360^\circ$ angles.
2. **Health & State Machine**:
   - `maxHp = 100`, `hp = 100`.
   - Four distinct visual/functional states:
     - `INTACT` ($75 \le \text{HP} \le 100$): Vibrant cyan Reishi aura (`#06b6d4`), solid stone masonry, slow pulse ($\omega = 2\text{ rad/s}$).
     - `DAMAGED` ($40 \le \text{HP} < 75$): Faint surface hairline cracks, subtle screen vignette, occasional Reishi particle venting.
     - `CRITICAL` ($1 \le \text{HP} < 40$): Deep jagged fissures leaking dark red miasma, rapid distress pulse ($\omega = 8\text{ rad/s}$), HUD warning alert.
     - `DESTROYED` ($\text{HP} \le 0$): Trigger slow-motion collapse ($0.2\times$ time scale), soul pillar disintegration, transition to Game Over.
3. **Collision & Damage Rules**:
   - **Damage Exclusivity Rule**:
     $$\Delta \text{HP}_{\text{altar}} < 0 \iff (\text{Enemy Contact}) \lor (\text{Cero Beam Intersection})$$
     - Player sword slashes, Getsuga waves, and friendly particles inflict exactly $0$ damage on the Altar.
   - **Enemy Impact Values**:
     - *Crawler*: $8$ contact damage. Self-destructs on impact in a puff of purple miasma.
     - *Flyer*: $12$ contact damage. Dives onto altar and shatters.
     - *Armored Brute*: $24$ contact damage. Heavy crush impact with screen shake ($8\text{px}$ magnitude).
     - *Menos Grande*: $50$ contact damage if it reaches the altar (primary threat is its ranged Cero).
   - **Damage Throttle & I-Frames**:
     - To prevent instantaneous 1-frame wipeouts when 10 enemies arrive simultaneously:
       Each impact grants $100\text{ms}$ global grace flash (`altarFlashTimer = 0.1s`), rendering the altar sprite white and capping simultaneous multi-hit damage spikes to a max of $30\text{ damage}$ per frame batch.
4. **Repair & Defense Dynamics**:
   - *Wave Clear Restoration*: Upon completing a wave, the Altar channels pure Reishi, restoring $\min(15, 100 - \text{HP})$ health.
   - *Spiritual Resonance Shockwave*: When the player reaches a $25\times$ combo, the Altar radiates a concentric blue shockwave ($R = 180\text{px}$) knocking back all nearby enemies and stunning them for $0.6\text{s}$.

#### B. Continuous Wave Scaling & Pacing Architecture
1. **Continuous vs Discrete Phasing**:
   - A hybrid architecture: Discrete narrative wave milestones ("Wave 1: Incursion", "Wave 5: Menos Grande Approaching!"), backed by continuous mathematical scaling of spawn budgets and spawn intervals.
2. **Mathematical Progression Formulas**:
   - **Total Enemies per Wave** $N(w)$:
     $$N(w) = \lfloor 10 + 6 \cdot w + 1.2 \cdot w^{1.3} \rfloor$$
     - Wave 1: 17 enemies
     - Wave 2: 24 enemies
     - Wave 3: 33 enemies
     - Wave 4: 41 enemies
     - Wave 5: 49 enemies + 1 Menos Grande Boss
     - Wave 8: 75 enemies + 1 Menos Grande Boss
     - Wave 10: 93 enemies + 2 Menos Grande Bosses
   - **Spawn Interval** $T_{\text{spawn}}(w)$ (seconds between enemy spawns):
     $$T_{\text{spawn}}(w) = \max\left(0.25, 1.8 \cdot 0.88^{w-1}\right)$$
     - Wave 1: $1.80\text{s}$
     - Wave 2: $1.58\text{s}$
     - Wave 3: $1.39\text{s}$
     - Wave 5: $1.08\text{s}$
     - Wave 8: $0.74\text{s}$
     - Wave 10: $0.57\text{s}$ (cap at $0.25\text{s}$ prevents CPU choke).
   - **Concurrent Alive Cap** $Cap(w)$:
     $$Cap(w) = \min(60, 12 + 4 \cdot w)$$
3. **Enemy Archetype Spawning Weights**:
   | Wave | Crawler (Speed: 120, HP: 1) | Flyer (Speed: 190, HP: 1) | Brute (Speed: 70, HP: 3) | Menos Grande (Speed: 35, HP: 8) |
   | :--- | :--- | :--- | :--- | :--- |
   | **1** | 100% | 0% | 0% | 0% |
   | **2** | 75% | 25% | 0% | 0% |
   | **3** | 50% | 35% | 15% | 0% |
   | **4** | 40% | 35% | 25% | 0% |
   | **5** | 35% | 35% | 30% | 1 Boss at wave midpoint |
   | **6-7** | 30% | 35% | 35% | 0% |
   | **8** | 25% | 35% | 40% | 1 Boss at wave midpoint |
   | **10+** | 20% | 40% | 40% | 2 Bosses simultaneously |

4. **Menos Grande Boss AI & Cero Mechanics**:
   - **Standoff Distance**: Halts at $d = 280\text{px}$ from Altar.
   - **State Sequence**:
     1. `MARCH`: Walks toward Altar at $v = 35\text{px/s}$.
     2. `AIM`: Locks onto Altar center $C$. Displays faint crimson targeting laser.
     3. `CHARGE` ($2.5\text{s}$): Red sphere expands at mouth ($r = 4\text{px} \to 22\text{px}$). Spiraling particle trails. Rising audio whine.
     4. `FIRE` ($1.2\text{s}$): Fires $26\text{px}$ wide Cero beam. Deals $35$ total damage over duration ($5\text{ damage}$ per $0.15\text{s}$ tick).
     5. `COOLDOWN` ($3.0\text{s}$): Exhausted recovery before recharging.
   - **Counterplay & Deflection**:
     - If the player swings Tensa Zangetsu through the beam with velocity $v_{\text{swing}} \ge 450\text{px/s}$ or strikes it with a ranged Getsuga Tensho projectile, the Cero beam is shattered with a massive white/red shockwave ("CERO DEFLECTION!"), canceling further altar damage and stunning the Menos for $1.5\text{s}$!

#### C. Score Tracking, Combo Multipliers & Replay System
1. **Scoring Formulas**:
   - Base Points:
     - Crawler: $100$ pts
     - Flyer: $150$ pts
     - Brute: $300$ pts
     - Menos Grande: $1,500$ pts
   - Combo Multiplier Table:
     | Combo Count | Multiplier | Bleach Rank | Title |
     | :--- | :--- | :--- | :--- |
     | 1 - 4 | $1.0\times$ | D | Shikai |
     | 5 - 9 | $1.5\times$ | C | Bankai |
     | 10 - 19 | $2.0\times$ | B | Kuroi Getsuga |
     | 20 - 34 | $3.0\times$ | A | Hollowfied Mask |
     | 35 - 49 | $4.5\times$ | S | Vasto Lorde |
     | 50+ | $6.0\times$ | SSS | Final Getsuga Tensho |
   - Combo Timer: Decays over $2.0\text{s}$. Each kill resets timer to $2.0\text{s}$.
   - Getsuga Cleave Bonus: Slicing $k \ge 2$ enemies in a single slash grants $(k - 1) \times 200\text{ bonus pts}$.
2. **Game Over Modal & Instant Replay**:
   - Upon Altar $\text{HP} \le 0$:
     - Time scale drops to $0.2\times$ for $1.0\text{s}$.
     - Canvas displays retro glitch/shatter overlay.
     - HUD displays:
       - Survival Time (`MM:SS.ms`)
       - Final Score & Personal Best (stored in `localStorage.getItem('tensa_highscore')`)
       - Total Slices & Breakdown by Hollow type
       - Highest Combo Rank achieved
     - One-key instant restart: Pressing `[SPACE]`, `[R]`, or clicking "REPLAY" re-initializes all entities, waves, and altar state in the same canvas frame without reloading the browser window.

---

### 2.2 Section 2: R4 - Procedural Pixel Art & Web Audio Synth

#### A. RotMG Procedural Pixel Art Specification
RotMG's visual signature relies on 8x8/16x16/32x32 grids, high-contrast primary/secondary shading, and a mandatory 1-pixel dark outline around every exterior non-transparent pixel.

1. **Sprite Matrix Definitions & Color Palettes**:
   Each sprite is represented as an array of strings, where each character maps to an RGBA palette color:

   - **Tensa Zangetsu (Katana & Hilt)** (32x32 canvas, drawn diagonally):
     - `.` = Transparent
     - `#` = Black outline `#000000`
     - `k` = Obsidian blade core `#0a0a0f`
     - `s` = Silver cutting edge `#e2e8f0`
     - `r` = Crimson Getsuga aura `#ff0033`
     - `g` = Gold/Silver Manji tsuba `#cbd5e1`
     - `h` = Hilt wrap `#1e1e24`
     - `c` = Broken chain links `#94a3b8`

   - **Soul Altar** (32x32 canvas):
     - `.` = Transparent
     - `#` = Dark outline `#0f172a`
     - `b` = Dark stone base `#334155`
     - `m` = Carved marble pillar `#64748b`
     - `l` = Highlight stone `#94a3b8`
     - `c` = Cyan Reishi soul core `#06b6d4`
     - `w` = Core white-hot center `#ffffff`
     - `p` = Pulsing aura `#67e8f9`

   - **Hollow 1: Crawler** (16x16 canvas):
     ```
     '....######......',
     '..##wwwwww##....',
     '.#wwwwwwwwww#...',
     '.#w..wwww..w#...',
     '.#w##wwww##w#...',
     '.#wwwwwwwwww#...',
     '..#wwwbbwww#....',
     '..#bbbbbbbb#....',
     '.#bbbbbbbbbb#...',
     '.#b.bbbbbb.b#...',
     '#b..bb..bb..b#..',
     '#...bb..bb...#..',
     '....bb..bb......',
     '....#....#......',
     '................',
     '................'
     ```
     Palette: `w` = Bone Mask (`#f8fafc`), `b` = Purple Body (`#3b0764`), `.` = Transparent, `#` = Outline (`#09090b`).

   - **Hollow 2: Flyer** (16x16 canvas):
     - White avian hollow mask with crimson curved wings (`#881337`, `#be123c`, `#f43f5e`).
     - Procedural 2-frame flapping animation generated by vertical sine offset of wing pixels.

   - **Hollow 3: Armored Brute** (32x32 canvas):
     - Heavy horned mask with curved ivory horns (`#f59e0b`, `#fef3c7`), obsidian armored shoulders (`#18181b`, `#27272a`), hollow hole in torso with crimson energy core.

   - **Hollow 4: Menos Grande** (32x32 canvas, rendered at 64x64 or 96x96):
     - Towering black shroud robe (`#09090b`, `#1c1917`), elongated white wooden beak mask (`#f1f5f9`), red slit eyes and Cero charge cavity (`#ff0033`).

2. **Automated RotMG 1-Pixel Outline Pass**:
   The procedural generator runs an outline filter over the matrix:
   $$\forall (x, y) \text{ s.t. } P(x, y) \neq \text{transparent}, \quad \text{if } \exists (dx, dy) \in \{(\pm 1, 0), (0, \pm 1)\} \text{ with } P(x+dx, y+dy) == \text{transparent} \implies \text{border}(x+dx, y+dy) = \#000000$$
   This guarantees authentic RotMG aesthetic without manual outline authoring errors.

3. **Dynamic Bisecting Slicing Geometry Algorithm**:
   To satisfy: *"Enemies cleanly split into two halves and bounce away upon contact with the blade"*:
   - Let an enemy be cut at position $P_0 = (x_0, y_0)$ with blade swing angle $\theta$.
   - Normal vector $\vec{n} = (-\sin\theta, \cos\theta)$, direction vector $\vec{u} = (\cos\theta, \sin\theta)$.
   - Instead of complex CPU raster re-generation, use **Canvas 2D Dual Half-Plane Clipping**:
     - Both Half 1 and Half 2 hold a reference to the enemy's pre-rendered offscreen sprite canvas.
     - **Half 1 Polygon**:
       Segment $A = P_0 - 200\vec{u}$, $B = P_0 + 200\vec{u}$.
       Closed polygon: $A \to B \to (B + 200\vec{n}) \to (A + 200\vec{n})$.
       `ctx.save()`, `ctx.clip(poly1)`, `ctx.drawImage(sprite, -w/2, -h/2)`, `ctx.restore()`.
     - **Half 2 Polygon**:
       Closed polygon: $B \to A \to (A - 200\vec{n}) \to (B - 200\vec{n})$.
       `ctx.save()`, `ctx.clip(poly2)`, `ctx.drawImage(sprite, -w/2, -h/2)`, `ctx.restore()`.
   - **Physics & Separation**:
     - $\vec{v}_1 = \vec{v}_{\text{enemy}} \cdot 0.2 + \vec{n} \cdot v_{\text{burst}} + \vec{v}_{\text{blade}} \cdot 0.2$, $\omega_1 = +6\text{ rad/s}$.
     - $\vec{v}_2 = \vec{v}_{\text{enemy}} \cdot 0.2 - \vec{n} \cdot v_{\text{burst}} + \vec{v}_{\text{blade}} \cdot 0.2$, $\omega_2 = -6\text{ rad/s}$.
     - Halves drift apart, rotate, emit bleeding spiritual Reishi particles, and fade to $\alpha = 0$ over $0.7\text{s}$.

#### B. Web Audio API Procedural Synthesis Architecture
Completely asset-free sound engine using native Web Audio API (`AudioContext`).

1. **Auto-Unlock Architecture**:
   - Modern browsers suspend `AudioContext` until a user gesture occurs.
   - Attach a one-time unlock listener to `window` for `'pointerdown'`, `'keydown'`, `'mousemove'`:
     ```js
     function unlockAudio() {
       if (audioCtx.state === 'suspended') {
         audioCtx.resume();
       }
     }
     ```
2. **Audio Synthesis Recipes**:

   - **Blade Swing / Slash** (`playSlash(speed)`):
     - Graph: `NoiseBuffer -> BiquadFilter (bandpass, Q=2.5) -> GainNode -> Master` + `Oscillator (sawtooth) -> GainNode -> Master`.
     - Freq sweep: $1600\text{Hz} \to 320\text{Hz}$ in $0.10\text{s}$.
     - Gain envelope: Attack $0.005\text{s}$, exponential decay to $0.0001$ over $0.12\text{s}$.
     - Velocity scaling: mouse speed scales volume ($0.3 \to 0.9$) and starting pitch ($1200\text{Hz} \to 2000\text{Hz}$).

   - **Steel Clash / Parry** (`playClash()`):
     - Graph: Dual high-pitched square/sine waves ($2600\text{Hz}$ and $3300\text{Hz}$) + highpass filtered noise ($4500\text{Hz}$).
     - Envelope: Instant attack ($0.001\text{s}$), metallic ring decay over $0.18\text{s}$.

   - **Getsuga Tensho Wave** (`playGetsugaWave()`):
     - Graph: Deep sine bass drop ($160\text{Hz} \to 40\text{Hz}$) + distorted sawtooth ($220\text{Hz} \to 70\text{Hz}$) through `WaveShaperNode` (overdrive) + lowpass filter opening ($400\text{Hz} \to 2600\text{Hz} \to 500\text{Hz}$).
     - Duration: $0.45\text{s}$. Massive roaring shockwave.

   - **Hollow Death Shriek** (`playHollowDeath(type)`):
     - Graph: Frequency Modulation (FM).
       - Carrier: Triangle oscillator sweeping $420\text{Hz} \to 80\text{Hz}$.
       - Modulator: Sawtooth oscillator at $55\text{Hz}$ with modulation gain of $220$.
     - Accompanied by white noise burst through bandpass ($900\text{Hz}$).
     - Distinct crunchy screech as mask shatters.

   - **Menos Cero Charge** (`startCeroCharge()`, `stopCeroCharge()`):
     - Continuous sine/triangle oscillator ramping from $110\text{Hz} \to 920\text{Hz}$ over $2.2\text{s}$.
     - LFO tremolo accelerating from $4\text{Hz} \to 26\text{Hz}$.
     - Creates intense anime energy-charging tension.

   - **Menos Cero Blast** (`playCeroBlast()`):
     - Graph: Low-pass filtered pink/white noise ($350\text{Hz}$) + sub-bass drop ($75\text{Hz} \to 25\text{Hz}$) + distortion saturation.
     - Duration: $1.2\text{s}$ sustained cataclysmic beam rumble.

   - **Altar Damage** (`playAltarHit()`):
     - Dual crystalline chimes ($784\text{Hz}$ [G5] + $1174\text{Hz}$ [D6]) detuned by $-30\text{ cents}$, lowpass muted ($800\text{Hz}$) + stone fracture thud.

   - **Game Over** (`playGameOver()`):
     - Chiptune minor arpeggio sequence ($D4 \to A3 \to F3 \to D3 \to A2$) played via retro $25\%$ pulse square wave, ending in low rumble reverb.

---

### 2.3 Section 3: R5 & Verification Architecture

#### A. Standalone Project Layout
Clean, modular ES module structure runnable natively in modern browsers and compatible with local HTTP serving:
```
desktopBattles/
├── index.html              # Standalone web entry point (Canvas, HUD, Game Over modal)
├── css/
│   └── style.css           # RotMG retro styling, scanline effects, pixel font HUD
├── src/
│   ├── engine/
│   │   ├── Vector2.js      # Vector math, dot/cross, angle, lerp, normalization
│   │   ├── AudioSynth.js   # 100% procedural Web Audio synthesizer
│   │   ├── SpriteGen.js    # Procedural RotMG pixel art matrix generator
│   │   ├── Renderer.js     # Canvas rendering, camera shake, particle manager
│   │   └── GameLoop.js     # 60fps delta-timed game loop, input handlers
│   └── game/
│       ├── Altar.js        # Soul altar state, collision check, health, aura
│       ├── Katana.js       # Tensa Zangetsu blade physics, tassel spring chain, Getsuga trails
│       ├── Enemy.js        # Crawler, Flyer, Brute, Menos Grande boss AI
│       ├── Slicer.js       # Dynamic 2-half polygon bisection & impulse physics
│       ├── WaveManager.js  # Pacing, spawn budget, boss thresholds, difficulty curves
│       ├── ScoreManager.js # Score, combo multipliers, survival timer, stats
│       └── Game.js         # Master game state orchestrator
├── test/
│   ├── test_sprites.js     # Unit test: Sprite matrices, color mapping, outline pass
│   ├── test_slicer.js      # Unit test: 2-half bisection polygon geometry & impulse
│   ├── test_altar.js       # Unit test: Health bounds, friendly fire immunity, contact damage
│   ├── test_waves.js       # Unit test: Spawn pacing curve, boss thresholds, composition
│   ├── test_score.js       # Unit test: Combo multiplier tiers, decay timing, score math
│   └── test_audio_mock.js  # Unit test: Web Audio node creation, envelopes, parameters
├── server.js               # Zero-dependency Node.js HTTP static server
└── run.bat                 # Windows 1-click launcher
```

#### B. Windows `run.bat` Launcher Specification
A bulletproof batch script that checks for Node.js, starts the local HTTP server, and automatically launches the user's default browser (or Edge):
```cmd
@echo off
setlocal enabledelayedexpansion
title Tensa Zangetsu: Soul Altar Defense
cd /d "%~dp0"

echo ====================================================================
echo   TENSA ZANGETSU: SOUL ALTAR DEFENSE (Bankai Arcade Edition)
echo ====================================================================
echo.

where node >nul 2>&1
if %errorlevel% equ 0 (
    echo Starting local game server on http://localhost:8080...
    start "" "http://localhost:8080"
    node server.js
) else (
    echo Node.js not found in PATH. Launching index.html directly...
    start "" "%~dp0index.html"
)
```

#### C. `server.js` (Zero-Dependency Node Static Server)
Using only built-in `http`, `fs`, and `path` modules:
- Serves `index.html`, `js`, `css`, and offscreen assets with correct MIME types (`text/html`, `application/javascript`, `text/css`).
- Port: `8080` (falls back to `8081` if busy).
- Instant startup ($< 50\text{ms}$).

#### D. Comprehensive Automated Testing Strategy
Using Node.js v24 native test runner (`node --test test/*.js`):
1. **`test_sprites.js`**:
   - Asserts all 6 sprite matrices (Katana, Altar, Crawler, Flyer, Brute, Menos) parse to valid dimensions.
   - Asserts no invalid color codes.
   - Asserts 1-px RotMG dark outline correctly surrounds non-empty pixels.
2. **`test_slicer.js`**:
   - Asserts that bisecting an entity at angle $\theta$ produces two non-overlapping polygons covering the original area.
   - Asserts separation velocity vectors have opposite signs ($\vec{v}_1 \cdot \vec{n} > 0$ and $\vec{v}_2 \cdot \vec{n} < 0$).
3. **`test_altar.js`**:
   - Asserts initial HP is exactly 100.
   - Asserts sword slashes inflict 0 damage (friendly fire immunity verified).
   - Asserts Crawler deals 8, Flyer deals 12, Brute deals 24, Menos Cero deals 35 damage.
   - Asserts Altar reaches `DESTROYED` and triggers Game Over at $\text{HP} \le 0$.
4. **`test_waves.js`**:
   - Asserts Wave 1 contains 100% Crawlers.
   - Asserts Wave 5 spawns Menos Grande boss.
   - Asserts spawn interval decreases monotonically toward $0.25\text{s}$ cap.
5. **`test_score.js`**:
   - Asserts combo multiplier matches table: 1x ($<5$), 1.5x ($5-9$), 2.0x ($10-19$), 3.0x ($20-34$), 4.5x ($35-49$), 6.0x ($50+$).
   - Asserts combo decays after $2.0\text{s}$ of inactivity.
6. **`test_audio_mock.js`**:
   - Uses a minimal Web Audio API mock (`MockAudioContext`, `MockOscillator`, `MockGain`).
   - Asserts that all sound trigger methods (`playSlash`, `playClash`, `playGetsugaWave`, `playHollowDeath`, `playCeroBlast`, `playAltarHit`, `playGameOver`) execute without throwing exceptions.
7. **Headless Browser Smoke Test**:
   - Command: `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --dump-dom http://localhost:8080`
   - Verifies that `<canvas id="gameCanvas">` is rendered and that no JavaScript unhandled errors occur during initial boot.

---

## 3. Caveats

1. **Browser Web Audio Autoplay Policy**:
   - Modern browsers (Chrome, Edge, Firefox) prohibit audio playback prior to user interaction.
   - *Mitigation*: The audio engine must remain in a standby/suspended state and auto-resume on the very first mouse movement, pointer click, or keypress (`window.addEventListener('pointerdown', resumeAudio, { once: true })`).
2. **ES Module Loading over `file://` Protocol**:
   - If a user double-clicks `index.html` directly from Windows Explorer (using `file:///...`), Chromium browsers may block `<script type="module">` due to strict local CORS origin rules.
   - *Mitigation*:
     - `run.bat` automatically launches via the zero-dependency Node.js HTTP server (`http://localhost:8080`), completely avoiding `file://` CORS issues.
     - As an added safeguard, code can be structured so that classes are cleanly modularized or bundled/namespaced onto a global `window.GameEngine` if zero-server direct double-click execution is desired.
3. **Framerate Independence**:
   - Refresh rates on modern monitors range from 60Hz to 144Hz/240Hz.
   - *Mitigation*: All physics (sword velocity, enemy movement, Cero charge, particle dissipation) must multiply by delta time $\Delta t$ and clamp $\Delta t \le 0.1\text{s}$ to prevent tunneling on background tab throttling.
4. **Altar Multi-Hit Swarm Protection**:
   - If 15 Crawlers hit the Altar on the exact same frame, unmitigated damage ($15 \times 8 = 120$) would instantly end the game without visual readability.
   - *Mitigation*: Implemented $100\text{ms}$ global flash i-frame window and batched damage ceiling.

---

## 4. Conclusion

- **R3 (Soul Altar & Waves)**: The design provides exact mathematical formulas for Altar durability (100 HP, strict contact/Cero damage rule), continuous wave scaling ($N(w) = \lfloor 10 + 6w + 1.2w^{1.3}\rfloor$), Menos Grande Cero beam charging and deflection mechanics, and multi-tier combo scoring ($1.0\times$ to $6.0\times$).
- **R4 (Pixel Art & Audio)**: Complete sprite matrices and 1-px RotMG outline algorithms eliminate the need for external image assets. The 2-half polygon clipping geometry achieves clean anime enemy splitting. The zero-asset Web Audio synthesis graphs cover every required SFX with exact oscillator, filter, and envelope specifications.
- **R5 & Verification**: The standalone architecture, lightweight `server.js`, and `run.bat` provide seamless one-click launch on Windows. The 6-suite automated test harness leveraging Node.js v24 (`node --test`) guarantees that all acceptance criteria can be verified continuously and objectively.

---

## 5. Verification Method

To independently verify the technical specifications and implementations:

1. **Run Unit & Algorithmic Test Suite**:
   ```powershell
   node --test test/test_sprites.js test/test_slicer.js test/test_altar.js test/test_waves.js test/test_score.js test/test_audio_mock.js
   ```
   *Expected Result*: All tests pass with 0 failures, verifying sprite matrices, slicing polygons, altar health math, wave curves, combo multipliers, and audio node generation.

2. **Verify Windows 1-Click Launch**:
   Run `run.bat` from terminal or double-click in Windows Explorer:
   ```cmd
   .\run.bat
   ```
   *Expected Result*: Spawns local HTTP server on port 8080, launches browser to `http://localhost:8080`, displays responsive Canvas at 60 FPS with active Soul Altar and Bankai sword controls.

3. **Verify Headless Browser Smoke Check**:
   ```cmd
   "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --dump-dom http://localhost:8080
   ```
   *Expected Result*: Dumps full DOM containing `<canvas id="gameCanvas">` and HUD elements without process crashes or syntax errors.

4. **Invalidation Conditions**:
   - Any external `.png`, `.wav`, or `.mp3` file dependency in `src/` invalidates the zero-external-asset guarantee.
   - Altar taking damage from player sword slashes invalidates the Soul Altar Defense rule.
   - Sliced enemies failing to produce two separate tumbling halves invalidates the slicing acceptance criterion.
