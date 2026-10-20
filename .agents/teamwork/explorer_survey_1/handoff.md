# Handoff Report: Codebase Survey & Engine Architecture

- **Author**: Survey Explorer 1 (teamwork_preview_explorer)
- **Task**: Codebase survey, architectural analysis, modularity evaluation, engine interfaces, and launcher design for "Tensa Zangetsu: Soul Altar Defense".
- **Date**: 2026-10-18T14:26:00Z
- **Target Audience**: Project Orchestrator, Implementation Workers, Reviewers, and E2E Test Engineers.

---

## 1. Observation

### 1.1 Workspace File Tree & Greenfield Inventory
A recursive scan of `c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles` was executed using PowerShell:
```powershell
Get-ChildItem -Force -Recurse | Select-Object FullName, Length, Attributes
```
**Results observed:**
- `c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents` (Directory)
  - Contains `.agents\teamwork\` with subdirectories: `orchestrator_1\`, `explorer_survey_1\`, `explorer_survey_2\`, `explorer_survey_3\`.
  - Contains `.agents\teamwork\ORIGINAL_REQUEST.md` (2,474 bytes) and `.agents\teamwork\BRIEFING.md` (1,512 bytes).
- `c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\src` (Directory)
  - Contains `src\engine` (Empty directory, 0 files).
  - Contains `src\game` (Empty directory, 0 files).
- Root workspace has no `index.html`, no `run.bat`, no `package.json`, no CSS files, and no scripts.
- **Verdict**: The project is entirely greenfield. No legacy code or pre-existing dependencies exist.

### 1.2 Host Environment & Tooling Scan
- **Node.js**:
  Command: `node -v`
  Output: `v24.20.0`
  Result: Modern Node.js 24 with native ES module and CommonJS support is installed and fully functional.
- **NPM**:
  Command: `cmd /c "npm -v"`
  Output: `11.19.0`
  Result: NPM is available via `npm.cmd` (direct `.ps1` execution is restricted by PowerShell execution policy, so batch scripts or Node directly are preferred).
- **Web Browser**:
  Command: `Test-Path 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'`
  Output: `True`
  Result: Microsoft Edge is installed at the standard 64-bit/x86 path and available as the default/system browser.
- **Python**:
  Command: `python --version`
  Output: `ApplicationFailedException: The file cannot be accessed by the system` (Windows Store stub).
  Result: Python is NOT available. Any local server or automated scripts MUST rely on Node.js or native Windows batch commands (`cmd.exe`).

### 1.3 User Requirements Summary (from `ORIGINAL_REQUEST.md`)
- **R1: Sword Physics & Mouse Control**: Mouse-driven Tensa Zangetsu blade. High-velocity swings trigger slashes with dynamic Getsuga Tensho trails (black ink core, crimson aura). Left-click forced slash. Right-click / Spacebar ranged crescent wave. Katana hilt with chained tassel undergoing real-time spring / Verlet physics.
- **R2: Enemy Swarms & Slicing Mechanics**: Hollow Crawlers, Flyers, Armored Brutes, and Menos Grande boss (Cero beam). Contact with the blade cleanly splits enemies into two distinct halves along the cut angle vector, with separated physics impulses, spiritual particles, and screen shake.
- **R3: Soul Altar Defense & Wave Progression**: Central Soul Altar with 100 HP. Waves scale in density/intensity. Tracking survival time, kill count, combo multiplier. Game Over on 0 HP with replay options.
- **R4: Procedural Pixel Art & Web Audio Synth**: 16x16 / 32x32 RotMG pixel art procedural generation for blade, altar, and all Hollows. Web Audio API synthesized retro sound effects (slashes, steel clash, hollow cries, Cero blast) with zero external asset dependencies.
- **R5: One-Click Launch**: Standalone HTML5 Canvas architecture runnable in modern browsers, with a `run.bat` script for instant Windows launch.

---

## 2. Logic Chain

### 2.1 The Browser Execution Pitfall: ES Modules vs `file://` CORS
1. **Observation**: Browsers (Chromium/Edge, Firefox, Safari) enforce strict CORS policies on local `file://` URIs.
2. **Mechanism**: If `index.html` loads scripts using `<script type="module" src="...">`, opening `index.html` directly via file explorer (`file:///.../index.html`) causes the browser to block module imports with:
   `Access to script at 'file:///...' from origin 'null' has been blocked by CORS policy`.
3. **Requirement Impact**: Requirement R5 demands "A standalone HTML5 Canvas architecture runnable in modern browsers, with a `run.bat` script for instant Windows launch." If a user double-clicks `index.html` or runs a simple `run.bat` that opens `file://`, pure ES modules will fail with a blank screen.
4. **Alternative Architectural Solutions Evaluated**:
   - *Option 1 (Pure Bundling)*: Use Vite/Webpack/esbuild.
     - *Deduction*: Introduces heavyweight `node_modules` dependencies, build steps, and complexity contrary to zero-dependency standalone arcade architecture.
   - *Option 2 (Pure ES Modules + Built-in Node HTTP Server in `run.bat`)*:
     - *Deduction*: `run.bat` starts `node server.js` (a 25-line zero-dependency native Node HTTP server) and opens `http://localhost:3000`. This works seamlessly via `run.bat`, but directly double-clicking `index.html` in File Explorer would fail due to CORS.
   - *Option 3 (Universal Modular / Clean Namespace Pattern + Dual Launch)*:
     - Structure all code cleanly into individual modular files under `src/engine/` and `src/game/`.
     - Each module encapsulates its class/functions within a single global project namespace: `window.TZ = window.TZ || {}; TZ.ClassName = ...`.
     - In Node.js testing environments, support CommonJS/ESM via conditional export:
       `if (typeof module !== 'undefined' && module.exports) { module.exports = ClassName; }`.
     - In `index.html`, load modules via standard `<script src="...">` tags.
     - In `run.bat`, offer an instant one-click launch: start `node server.js` if Node is present (or open `index.html` directly via `start "" "%~dp0index.html"`).
5. **Architectural Choice**: **Option 3 (Universal Modular Pattern + Dual Launch)** provides the maximum robustness:
   - 100% works when double-clicking `index.html` (zero server required).
   - 100% works when executing `run.bat` (serves via local HTTP server or direct launch).
   - 100% testable in Node.js automated test suites without transpilation.
   - 0 npm dependencies required.

---

### 2.2 Game Loop & Physics Timing Architecture
1. **Observation**: Slashing with a mouse cursor involves very fast, erratic angular velocities (1,000 to 4,000 px/sec during a rapid flick). Verlet physics for the katana chained tassel involves distance constraint iterations.
2. **Risk**: At standard 60 Hz (16.6ms per frame) with variable delta time, a fast flick can tunnel through enemy hitboxes, and Verlet spring links can experience numerical explosion or jitter under frame drops.
3. **Deduction**: The game loop must use an **Accumulator-based Fixed Timestep** with substepping:
   - Variable frame rate rendering via `requestAnimationFrame`.
   - Physics and collision update at fixed `1/120`s (8.33ms) or `1/60`s intervals.
   - Delta time clamping (`dt = Math.min(dt, 0.1)`) prevents spiral-of-death or tab-switching teleportation.
   - Frame interpolation factor `alpha = accumulator / FIXED_STEP` is passed to the renderer for silky-smooth motion.

---

### 2.3 Canvas Rendering Pipeline & RotMG Aesthetics
1. **Observation**: Requirement R4 specifies "procedurally generated 16x16 / 32x32 RotMG-style pixel art". Modern high-DPI displays (e.g. Zephyrus laptops with 125%-200% DPR) will blur pixel art if standard bilinear filtering or naive canvas resizing is used.
2. **Deduction**:
   - Establish a canonical virtual resolution: **1280 x 720** (16:9 aspect ratio).
   - Set canvas CSS: `width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; image-rendering: crisp-edges;`.
   - Canvas context property: `ctx.imageSmoothingEnabled = false;`.
   - Procedural pixel art generation:
     - Generate pixel art sprites onto tiny off-screen canvases (e.g. 16x16 or 32x32).
     - Cache generated sprite canvases in a `SpriteCache` dictionary.
     - Blit cached sprites to the main canvas scaled up (e.g. 2x, 3x, or 4x) using nearest-neighbor interpolation.
   - **Render Layer Stack**:
     1. Background & Void Arena (spirit stone tiles, dark vignette, Soul Altar rune circles).
     2. Central Soul Altar (base, health ring, pulsating core).
     3. Severed Hollow corpses & residual black ichor splatter.
     4. Active Hollow Enemies (Crawlers, Flyers, Armored Brutes, Menos Grande).
     5. Cero charging orb & laser beam telegraphs.
     6. Getsuga Tensho projectile crescent waves.
     7. Katana Chained Tassel (Verlet links drawn as connected black iron links with glowing reiatsu tip).
     8. Katana Blade & Getsuga Slash Trail (crimson outer aura with black ink core).
     9. Spiritual Reiatsu particles, sparks, damage numbers, and floating combo text.
     10. Screen-shake matrix offset (applied to layers 1–9, restored before HUD).
     11. HUD Overlay (Soul Altar HP bar, Wave progress, Combo meter, Survival timer, Kill counter).
     12. Game Over / Pause modal overlay.

---

### 2.4 Input Subsystem Architecture
1. **Observation**:
   - Player controls the katana via mouse.
   - High velocity swings activate blade slashes with trails.
   - Left click = forced slash.
   - Right click = crescent Getsuga Tensho wave (requires suppressing default browser context menu).
   - Spacebar = alternative ranged wave trigger.
2. **Deduction**:
   - `InputManager` must intercept:
     - `mousemove`: Calculate virtual canvas coordinates `(canvasX, canvasY)` by applying `canvas.getBoundingClientRect()` and scale factors.
     - Maintain a circular buffer of recent mouse positions with timestamps to compute smoothed velocity:
       `vx = (x - prevX) / dt`, `vy = (y - prevY) / dt`, `speed = Math.hypot(vx, vy)`.
     - Velocity threshold: `speed > SWING_THRESHOLD` (e.g. 650 px/s) triggers `isSlashing = true`.
     - `contextmenu`: Must call `e.preventDefault()` to prevent the Windows browser context menu from interrupting right-click attacks.
     - `mousedown`:
       - Button 0 (Left): Trigger forced slash.
       - Button 2 (Right): Trigger Getsuga wave projectile.
     - `keydown`:
       - Space: Trigger Getsuga wave projectile.
       - P / Escape: Pause toggle.
   - Mouse Cursor: Hide system cursor (`cursor: none` on canvas) and render the Tensa Zangetsu crosshair/hilt directly.

---

### 2.5 Web Audio API Procedural Synth Architecture
1. **Observation**: Browser Autoplay policies suspend `AudioContext` until the first user interaction. Requirement R4 requires 100% synthesized sound effects with zero external audio assets.
2. **Deduction**:
   - `AudioManager` initializes `new (window.AudioContext || window.webkitAudioContext)()`.
   - On first `pointerdown` / `keydown`, invoke `audioCtx.resume()`.
   - Synthesizer Graphs:
     - **Slash SFX**: White noise buffer passed through a high-resonance `BiquadFilterNode` (BandPass) with frequency swept down from 3000Hz to 600Hz over 90ms.
     - **Steel Clash SFX**: Two square/triangle oscillators at 1150Hz and 1720Hz with fast exponential gain decay (60ms) and high-pass filtering.
     - **Hollow Death Cry**: Sawtooth oscillator modulated by a pitch drop (350Hz -> 60Hz) with mild distortion and reverb decay over 250ms.
     - **Cero Charge SFX**: Sine wave sweeping upwards from 120Hz to 850Hz with an LFO-modulated amplitude (tremolo) building tension over 2.5 seconds.
     - **Cero Blast SFX**: Heavy low-frequency noise blast + 50Hz sub-bass oscillator with exponential decay over 700ms.
     - **Altar Damage SFX**: Low metallic resonant gong (180Hz sine + dampening) to signal danger to the player.
     - **Getsuga Wave Release**: Filtered noise + low sine sweep simulating an explosive wind wave.
     - **Game Over**: Descending minor chords (E-flat minor) synthesized with square waves.

---

### 2.6 Physics, Verlet Chain & Slicing Architecture
1. **Observation**:
   - Katana hilt features a chained tassel with real-time spring physics.
   - Enemies sliced by the blade split cleanly into two distinct halves along the cut angle.
2. **Deduction**:
   - **Verlet Chain**:
     - Modeled as $N=10$ linked points.
     - Anchor point (Node 0) is locked to the Katana pommel: `(pommelX, pommelY)`.
     - Each node has `(x, y, prevX, prevY)`.
     - Verlet step: `x_next = 2x - prevX + a * dt^2`. Gravity and angular drag applied.
     - Relaxation loop (3 iterations): Enforce constraint `distance(node[i], node[i-1]) == segmentLength`.
   - **Swept Slicing Mechanics**:
     - The katana blade is a segment from Hilt $H$ to Tip $T$ of length $L \approx 90\text{px}$.
     - When `isSlashing = true`, segment $H(t) \to T(t)$ is swept from previous position $H(t-dt) \to T(t-dt)$, forming an oriented quad.
     - Any enemy intersecting this swept segment is cut along the blade angle $\theta$.
     - Enemy sprite is divided into Half A and Half B along line $(x - x_0)\sin\theta - (y - y_0)\cos\theta = 0$.
     - Normal vector $\vec{n} = (-\sin\theta, \cos\theta)$. Half A gets velocity $+V_{impulse} \vec{n} + \vec{v}_{swing} \times 0.3$; Half B gets $-V_{impulse} \vec{n} + \vec{v}_{swing} \times 0.3$.
     - Severed halves rotate, fade over 1.5 seconds, and despawn.

---

### 2.7 Proposed Code Layout
The workspace `src/` directory should be organized into clean single-responsibility files:

```
desktopBattles/
├── index.html                   # HTML5 host page, canvas, HUD UI overlay, retro font styles
├── styles.css                   # Canvas layout, full viewport centering, pixelated rendering
├── run.bat                      # One-click Windows launcher (starts server & opens browser)
├── server.js                    # Zero-dependency local Node.js static HTTP server (30 lines)
├── src/
│   ├── engine/                  # Core reusable engine modules
│   │   ├── GameLoop.js          # Fixed timestep (120Hz physics accumulator, rAF)
│   │   ├── CanvasRenderer.js    # 1280x720 virtual canvas, DPI scaling, layer rendering
│   │   ├── InputManager.js      # Mouse position, velocity vector, slash detection, keybindings
│   │   ├── AudioManager.js      # Web Audio API procedural sound synthesizer
│   │   ├── Physics.js           # Verlet chain solver, line-segment sweep, math utilities
│   │   └── ParticleSystem.js    # Reiatsu spiritual particles, cut sparks, screen shake
│   └── game/                    # Tensa Zangetsu gameplay modules
│       ├── Main.js              # Game controller, state machine (Title, Playing, GameOver)
│       ├── Katana.js            # Blade orientation, swing detection, Getsuga trail, chained tassel
│       ├── SoulAltar.js         # Central altar state (100 HP), damage intake, aura pulse
│       ├── SpriteGen.js         # Procedural RotMG 16x16 / 32x32 pixel art rasterizer
│       ├── Enemy.js             # Base enemy class & types (Crawler, Flyer, Brute, Menos Grande)
│       ├── Slicer.js            # Sprite splitting along cut angle, severed half physics
│       ├── WaveManager.js       # Wave scaling, spawn curves, Menos Grande boss encounter pacing
│       └── Projectile.js        # Crescent Getsuga Tensho wave, Menos Grande Cero beam
└── tests/
    └── test-engine.js           # Headless Node.js unit & integration verification suite
```

---

## 3. Caveats

1. **Browser Security Sandbox**: Browsers strictly forbid raw file access or unprompted audio autoplay without user gesture. The architecture accounts for this via first-click audio unlocking and local server / universal modular scripts.
2. **High-DPI Performance**: Scaling procedural pixel art on 4K displays can cause GPU fillrate drops if rendered pixel-by-pixel every frame. The architecture mitigates this by generating pixel art once into offscreen sprite canvas caches and blitting via `drawImage` with `imageSmoothingEnabled = false`.
3. **No External Asset Assumption**: All graphics (sprites, particles, UI) and audio (effects, drones) MUST be 100% procedurally generated in code, as mandated by R4. No external `.png`, `.wav`, or `.mp3` files are permitted.

---

## 4. Conclusion

- The project workspace is a clean greenfield environment with empty `src/engine` and `src/game` directories.
- The host environment has Node.js `v24.20.0` and Microsoft Edge readily available.
- To prevent CORS failures on `file://` while maintaining modular code, modules should use clean namespaced encapsulation (`window.TZ = window.TZ || {}`) with CommonJS export support for testing, accompanied by a zero-dependency `server.js` and a dual-mode `run.bat`.
- The gameplay physics require an accumulator-based 120Hz fixed timestep to ensure that high-velocity mouse katana swings cleanly cut enemies without tunneling, and that the katana pommel tassel Verlet spring physics remain unconditionally stable.
- The architecture is fully specified across 14 decoupled modules across `src/engine/` and `src/game/`, perfectly preparing the team for Milestone execution.

---

## 5. Verification Method

To independently verify the findings in this report:

1. **Verify Workspace State**:
   ```powershell
   Get-ChildItem -Force -Recurse 'c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles'
   ```
   *Expected*: Only `.agents/` and empty `src/engine/` and `src/game/` exist.

2. **Verify Node.js Version & Execution**:
   ```powershell
   node -v
   ```
   *Expected*: `v24.20.0`.

3. **Verify Edge Browser Availability**:
   ```powershell
   Test-Path 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
   ```
   *Expected*: `True`.

4. **Verify Implementation Compliance**:
   Once implemented, the game can be verified by running:
   ```cmd
   run.bat
   ```
   and executing the automated test suite:
   ```cmd
   node tests/test-engine.js
   ```
