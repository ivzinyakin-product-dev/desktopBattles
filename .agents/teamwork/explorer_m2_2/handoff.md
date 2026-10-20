# Milestone 2 Exploration Report: Getsuga Trail & Verlet Tassel

**Author**: Explorer 2 (`explorer_m2_2`)  
**Mission**: Production Blueprints for Dynamic Getsuga Tensho Trail Rendering & Katana Pommel Chained Tassel (Verlet Physics) for `src/game/Katana.js`  
**Target Milestone**: Milestone 2 (Tensa Zangetsu Blade Kinematics, Trail & Tassel)

---

## 1. Observation

### 1.1 Existing Codebase & Architecture
1. **Repository Layout and Conventions**:
   - `c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\src\engine\` contains foundation engine modules:
     * `Vector2.js`: 2D Vector math (`add`, `sub`, `scale`, `mag`, `normalize`, `lerp`, `dist`) and `SweptQuad` Continuous Collision Detection (CCD).
     * `ParticleSystem.js`: Zero-allocation pooled particle engine with `spawnEmbers(x, y, count, angle, color, speedScale)`, `spawnSmoke(x, y, count, color)`, `spawnShards(x, y, count)`.
     * `SpriteGen.js`: Procedural RotMG 16x16 / 32x32 sprite matrices with 1-pixel dark border (`SPRITE_DEFS.katana`, 32x32).
     * `CanvasRenderer.js`: 1280x720 canonical virtual viewport with `imageSmoothingEnabled = false`.
     * `GameLoop.js`: 120Hz fixed timestep accumulator loop ($dt = 1/120\text{s} \approx 0.008333\text{s}$).
2. **Current Test Suite Status**:
   - Running `node --test test/test-engine.js` executes 54 tests across 7 suites with 100% pass (0 failures, duration ~108ms).
3. **Existing E2E Test Contracts for Trail & Tassel** (`test/test-e2e.js`, lines 659–745):
   - **Feature 9: Dual-Composite Getsuga Trail**:
     * Line 660–665: `Array.isArray(katana.trailNodes) || Array.isArray(katana.trail)`. Rolling buffer capped at 16 samples.
     * Line 667–675: `katana.drawTrail ? katana.drawTrail(ctx) : (katana.draw && katana.draw(ctx))`. Renders outer crimson Reiatsu aura with screen blending (`ctx.globalCompositeOperation = 'screen'`).
     * Line 677–682: `katana.coreWidth === 4`. Renders inner pitch-black core ribbon with exact 4px stroke width.
     * Line 684–689: Emits dissipating Reiatsu embers during swings.
     * Line 691–699: `katana.speed = 0; katana.update(0.3);` Trail nodes fade completely over 240ms ($0.24\text{s}$), resulting in `(katana.trailNodes || katana.trail).length <= 1` or `0`.
   - **Feature 10: Chained Tassel Verlet Physics**:
     * Line 703–708: `(katana.tasselNodes || katana.chainNodes || []).length === 8 || katana.tasselCount === 8`. Chain contains exactly 8 Verlet nodes.
     * Line 710–722: `katana.hilt = { x: 200, y: 200 }; katana.update(0.016); const node0 = (katana.tasselNodes || katana.chainNodes || [])[0]; Math.hypot(node0.x - katana.hilt.x, node0.y - katana.hilt.y) < 30`. Node 0 is hard-locked to katana pommel anchor point.
     * Line 724–729: `katana.restLength === 5 || katana.chainRestLength === 5`. Enforces distance constraint relaxation with rest length $d_0 = 5\text{px}$.
     * Line 731–736: Applies downward gravity ($280\text{ px/s}^2$) and velocity damping ($0.05$).
     * Line 738–745: `katana.drawTassel ? katana.drawTassel(ctx) : (katana.draw && katana.draw(ctx))`. Renders pixel-art iron links with metallic glint ($3 \times 3$ RotMG pixel blocks).
4. **Katana Geometry Contracts** (`test/test-e2e.js`, lines 633–649):
   - Line 641: `katana.bladeLength = 85` ($85\text{px}$ from hilt to tip).
   - Line 648: `katana.hiltLength = 22` ($22\text{px}$ backwards from hilt to pommel anchor point). Distance from hilt to pommel is $22\text{px} < 30\text{px}$.
5. **Parallel Agent Partitioning**:
   - `explorer_m2_1`: Kinematics, Stance, Velocity Ring Buffer, SweptQuad CCD.
   - `explorer_m2_2` (Us): Getsuga Trail (Dual-Composite Shader) & Verlet Tassel Physics.
   - `explorer_m2_3`: Special Combat Moves (Senka Forced Slash & Crescent Getsuga Wave).

---

## 2. Logic Chain

### 2.1 Component 1: Dynamic Getsuga Tensho Trail Rendering

#### 2.1.1 Buffer Dynamics and Lifespan
- **Premise 1**: High-velocity blade swings sweep an area between the blade tip ($T$) and hilt ($H$).
- **Premise 2**: Test 9.1 and 9.5 require a rolling buffer of up to 16 samples that completely dissipates within $240\text{ms}$ ($0.24\text{s}$) when the blade stops moving.
- **Deduction**:
  1. Each sample in `this.trail` stores:
     $$\mathcal{S}_i = \{ \text{tipX}, \text{tipY}, \text{hiltX}, \text{hiltY}, \text{age}: 0, \text{maxAge}: 0.24, \text{speed} \}$$
  2. In `update(dt)`:
     - All active samples age: $\text{sample.age} += dt$.
     - Samples with $\text{sample.age} \ge \text{sample.maxAge}$ are evicted via filtering or swap-and-pop.
     - When blade is active ($\text{this.isSlashing}$ or $\text{this.speed} \ge 120\text{ px/s}$):
       A new sample capturing current $(\text{tip.x}, \text{tip.y})$ and $(\text{hilt.x}, \text{hilt.y})$ is prepended (`unshift`) to `this.trail`.
       If $\text{this.trail.length} > 16$, the oldest element is popped: $\text{this.trail.length} = 16$.
     - When blade is idle ($\text{this.speed} < 120$ and not slashing):
       No new samples are captured. Existing samples age until empty. After $0.3\text{s} > 0.24\text{s}$, `this.trail.length === 0`, satisfying Test 9.5 without residual artifacts.
  3. Support both `this.trail` and `this.trailNodes` via property getter/setter:
     ```javascript
     get trailNodes() { return this.trail; }
     set trailNodes(v) { this.trail = v; }
     ```

#### 2.1.2 Dual-Composite Rendering Pipeline
- **Premise 3**: Test 9.2 specifies an outer crimson Reiatsu aura rendered with screen blending.
- **Premise 4**: Test 9.3 specifies an inner jet-black core ribbon with exact 4px stroke width (`coreWidth = 4`).
- **Deduction**:
  Canvas 2D dual-composite rendering must execute sequentially in two isolated passes:

  **Pass 1: Outer Pass (Screen Blending + Dilated Crimson Aura)**
  - Composite Operation: `ctx.globalCompositeOperation = 'screen'`.
  - Aura Styling: `ctx.shadowBlur = 18; ctx.shadowColor = '#ff0033';`.
  - Geometric Ribbon Mesh:
    For each segment between sample $i$ and $i+1$:
    Construct quadrilateral polygon:
    $$\mathcal{Q}_i = (T_i \to T_{i+1} \to H_{i+1} \to H_i)$$
    Compute normalized alpha:
    $$\alpha_i = \max\left(0, 1 - \frac{\text{sample}_i.\text{age}}{0.24}\right)^{1.2}$$
    Fill with linear gradient from $T_i$ to $H_i$:
    - Stop 0.0: `rgba(255, 0, 51, alpha * 0.85)` (outer dilated crimson)
    - Stop 0.5: `rgba(200, 0, 40, alpha * 0.50)` (deep blood red)
    - Stop 1.0: `rgba(139, 0, 0, alpha * 0.15)` (dark crimson hilt fade)
    Stroke outer tip boundary with dilated glowing stroke ($6\text{px}$ to $12\text{px}$):
    `ctx.strokeStyle = rgba(255, 0, 51, alpha * 0.9); ctx.lineWidth = 6 + alpha * 6; ctx.stroke();`

  **Pass 2: Inner Pass (Source-Over + Sharp Jet-Black Core)**
  - Composite Operation: `ctx.globalCompositeOperation = 'source-over'`.
  - Core Styling: `ctx.shadowBlur = 0; ctx.lineWidth = this.coreWidth || 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';`.
  - Spline Stroke:
    For each segment from $i$ to $i+1$:
    Draw line from $T_i$ to $T_{i+1}$:
    `ctx.strokeStyle = rgba(5, 5, 5, alpha * 0.95); ctx.stroke();`
    This creates the signature Kuroi Getsuga pitch-black razor cutting edge wrapped in bleeding crimson Reiatsu.

#### 2.1.3 Reiatsu Spark Emissions
- **Premise 5**: Test 9.4 requires dissipating Reiatsu embers during swing.
- **Deduction**:
  When `this.speed >= 280` or `this.isSlashing`:
  1. Select random emission coordinate along the outer cutting zone of the blade ($t \in [0.65, 1.0]$):
     $$\vec{p} = \text{hilt} + (\text{tip} - \text{hilt}) \cdot t$$
  2. Compute emission angle pointing opposite to the swing velocity vector with a $\pm 0.4\text{ rad}$ dispersion cone.
  3. Emit 1–3 particles per tick via `TZ.ParticleSystem.spawnEmbers(p.x, p.y, count, angle, '#ff0033')`.

---

### 2.2 Component 2: Katana Pommel Chained Tassel (Verlet Physics)

#### 2.2.1 Kinematic Chain Topology
- **Premise 6**: Test 10.1 requires exactly 8 Verlet nodes. Test 10.3 requires rest length $d_0 = 5\text{px}$.
- **Premise 7**: Test 10.2 requires Node 0 to be pinned to the pommel anchor point within $30\text{px}$ of the hilt.
- **Premise 8**: Feature 8.4 establishes `hiltLength = 22px`.
- **Deduction**:
  1. The pommel anchor point is calculated along the inverse blade orientation vector:
     $$\vec{u} = (\cos\theta, \sin\theta)$$
     $$\vec{p}_{\text{pommel}} = \text{hilt} - \vec{u} \cdot \text{hiltLength} = (\text{hilt.x} - 22 \cos\theta, \text{hilt.y} - 22 \sin\theta)$$
     $$\|\vec{p}_{\text{pommel}} - \text{hilt}\| = 22\text{px} < 30\text{px} \quad \text{(Strictly satisfies Test 10.2)}$$
  2. Node array initialization:
     `this.tasselNodes = new Array(8);`
     `get chainNodes() { return this.tasselNodes; }`
     For $i \in [0, 7]$:
     $$\text{node}_i = \{ x: \text{pommel.x}, y: \text{pommel.y} + i \cdot 5, \text{oldX}: \text{pommel.x}, \text{oldY}: \text{pommel.y} + i \cdot 5, \text{pinned}: (i === 0) \}$$
     Total fully extended chain length: $7 \times 5 = 35\text{px}$.

#### 2.2.2 Real-Time Verlet Integration
- **Premise 9**: Test 10.4 specifies downward gravity of $280\text{ px/s}^2$ and velocity damping of $0.05$.
- **Deduction**:
  In Verlet numerical integration:
  $$\vec{v}_i = (\vec{x}_i - \vec{x}_{\text{old}, i}) \cdot (1 - \text{damping})$$
  where $\text{damping} = 0.05$.
  Forces acting on each free node $i \in [1, 7]$:
  1. Downward gravitational acceleration: $\vec{g} = (0, 280)\text{ px/s}^2$.
  2. Centrifugal force generated by blade rotation at angular velocity $\omega$:
     Let relative displacement vector from pommel be $\vec{r}_i = \vec{x}_i - \vec{p}_{\text{pommel}}$.
     $$\vec{a}_{\text{cent}} = \omega^2 \cdot \vec{r}_i$$
     Where $\omega = \frac{\Delta \theta}{\Delta t}$. Clamped to $\|\vec{a}_{\text{cent}}\| \le 1200\text{ px/s}^2$ to prevent numerical instability.
  3. Total acceleration: $\vec{a}_i = \vec{g} + \vec{a}_{\text{cent}}$.
  4. Integration step:
     $$\vec{x}_{\text{next}, i} = \vec{x}_i + \vec{v}_i + \vec{a}_i \cdot \Delta t^2$$
     $$\vec{x}_{\text{old}, i} \gets \vec{x}_i$$
     $$\vec{x}_i \gets \vec{x}_{\text{next}, i}$$

#### 2.2.3 3-Iteration Distance Constraint Relaxation (Gauss-Seidel)
- **Premise 10**: Physical chains must be inextensible and resist stretching under high-speed mouse sweeps.
- **Deduction**:
  Run $K = 3$ constraint relaxation iterations per physics substep:
  For iteration $k \in \{0, 1, 2\}$:
  1. Hard pin Node 0:
     $$\vec{x}_0 = \vec{p}_{\text{pommel}}, \quad \vec{x}_{\text{old}, 0} = \vec{p}_{\text{pommel}}$$
  2. For each link $j \in [0, 6]$ connecting Node $j$ and Node $j+1$:
     $$\Delta \vec{p} = \vec{x}_{j+1} - \vec{x}_j$$
     $$d = \sqrt{\Delta p_x^2 + \Delta p_y^2}$$
     If $d > 10^{-6}$:
     $$\text{diff} = \frac{d - d_0}{d} = \frac{d - 5}{d}$$
     - If Node $j$ is pinned ($j = 0$):
       Node 0 cannot move. Node 1 absorbs 100% of the displacement error:
       $$\vec{x}_{j+1} \gets \vec{x}_{j+1} - \Delta \vec{p} \cdot \text{diff}$$
     - If neither node is pinned ($j \ge 1$):
       Both nodes share correction symmetrically (50/50):
       $$\vec{x}_j \gets \vec{x}_j + \Delta \vec{p} \cdot (0.5 \cdot \text{diff})$$
       $$\vec{x}_{j+1} \gets \vec{x}_{j+1} - \Delta \vec{p} \cdot (0.5 \cdot \text{diff})$$
  3. Re-pin Node 0 to guarantee pommel attachment invariance.

#### 2.2.4 RotMG Pixel Art Rendering & Metallic Glint
- **Premise 11**: Test 10.5 requires RotMG pixel-art iron links with metallic glint.
- **Deduction**:
  1. Chain Links: Render a 1px dark iron connector between successive nodes:
     `ctx.strokeStyle = '#18181b'; ctx.lineWidth = 1;`
  2. Chain Nodes ($i \in [0, 6]$):
     Render each node as a chunky $3 \times 3$ metallic block aligned to virtual pixel grid:
     $$px = \lfloor x_i + 0.5 \rfloor, \quad py = \lfloor y_i + 0.5 \rfloor$$
     - Layer A (Dark Iron Border): $3 \times 3$ block at $(px - 1, py - 1)$ in `#0f172a`.
     - Layer B (Steel Midtone Body): $2 \times 2$ block at $(px - 1, py - 1)$ in `#94a3b8`.
     - Layer C (Specular Metallic Highlight): $1 \times 1$ pixel at $(px - 1, py - 1)$ in `#ffffff`.
  3. Terminal Charm (Node 7 - Bankai Broken Chain Soul Bead):
     Render Node 7 as a $4 \times 4$ RotMG crimson spiritual seal bead:
     - Border: $4 \times 4$ at $(px - 2, py - 2)$ in `#450a0a`.
     - Soul Bead: $3 \times 3$ at $(px - 1, py - 1)$ in `#ff0033`.
     - Highlight: $1 \times 1$ at $(px - 1, py - 1)$ in `#ffffff`.

---

## 3. Caveats

1. **ParticleSystem Availability**: When `Katana.update(dt)` is invoked without an active `ParticleSystem` instance (such as in headless unit tests), spark emissions must safely no-op without throwing errors.
2. **Context Save/Restore Discipline**: The dual-composite trail shader modifies `globalCompositeOperation`, `shadowBlur`, `shadowColor`, and `globalAlpha`. All changes must be enclosed in `ctx.save()` / `ctx.restore()` blocks so they do not contaminate downstream sprite and HUD rendering.
3. **Framerate Independence**: While the fixed accumulator loop runs at 120Hz ($dt \approx 0.00833\text{s}$), variable step calls during testing (e.g. `katana.update(0.3)`) must smoothly advance sample ages and expire nodes without division-by-zero or array corruption.
4. **No other caveats**.

---

## 4. Conclusion & Production Blueprint

### 4.1 Interface Specification for `src/game/Katana.js`

```javascript
/**
 * Tensa Zangetsu: Soul Altar Defense
 * Trail & Tassel Module Blueprint
 */

// Property Contracts:
this.trail = [];                        // Rolling ribbon buffer (max 16 samples)
this.coreWidth = 4;                     // Sharp pitch-black core ribbon (4px)
this.trailLifespan = 0.24;              // 240ms trail lifespan
this.tasselNodes = [];                  // 8 Verlet nodes
this.tasselCount = 8;                   // Exactly 8 nodes
this.restLength = 5;                    // 5px rest distance
this.chainRestLength = 5;               // Alias
this.gravity = 280;                     // 280 px/s^2 downward gravity
this.damping = 0.05;                    // Velocity damping (air drag)
this.constraintIterations = 3;          // 3-pass distance relaxation
this.bladeLength = 85;                  // 85px hilt-to-tip
this.hiltLength = 22;                   // 22px pommel anchor behind hilt

// Getters / Setters:
get trailNodes() { return this.trail; }
set trailNodes(val) { this.trail = val; }
get chainNodes() { return this.tasselNodes; }
set chainNodes(val) { this.tasselNodes = val; }
```

### 4.2 Exact Implementation Routines

#### A. Tassel Initialization Routine
```javascript
function initTassel(pommelPos) {
  this.tasselNodes = [];
  const startX = pommelPos ? pommelPos.x : this.hilt.x;
  const startY = pommelPos ? pommelPos.y : this.hilt.y;
  for (let i = 0; i < 8; i++) {
    this.tasselNodes.push({
      x: startX,
      y: startY + i * this.restLength,
      oldX: startX,
      oldY: startY + i * this.restLength,
      pinned: (i === 0)
    });
  }
}
```

#### B. Trail Update Routine
```javascript
function updateTrail(dt, isMovingOrSlashing) {
  // 1. Age existing trail samples
  for (let i = 0; i < this.trail.length; i++) {
    this.trail[i].age += dt;
  }
  // 2. Evict expired samples (> 240ms)
  this.trail = this.trail.filter(s => s.age < s.maxAge);

  // 3. Capture new sample if moving or slashing
  if (isMovingOrSlashing) {
    this.trail.unshift({
      tipX: this.tip.x,
      tipY: this.tip.y,
      hiltX: this.hilt.x,
      hiltY: this.hilt.y,
      age: 0,
      maxAge: this.trailLifespan || 0.24,
      speed: this.speed
    });
    if (this.trail.length > 16) {
      this.trail.length = 16;
    }
  }
}
```

#### C. Verlet Tassel Physics Routine
```javascript
function updateTasselPhysics(dt, pommelPos, angularVelocity = 0) {
  if (!this.tasselNodes || this.tasselNodes.length === 0) {
    this.initTassel(pommelPos);
  }

  const nodes = this.tasselNodes;
  const dtSq = dt * dt;
  const dragFactor = Math.max(0, 1 - (this.damping || 0.05));
  const gravityY = this.gravity || 280;

  // 1. Verlet Integration on Free Nodes (1 to 7)
  for (let i = 1; i < nodes.length; i++) {
    const node = nodes[i];
    const vx = (node.x - node.oldX) * dragFactor;
    const vy = (node.y - node.oldY) * dragFactor;

    // Centrifugal acceleration from blade rotation
    const rx = node.x - pommelPos.x;
    const ry = node.y - pommelPos.y;
    const wSq = Math.min(angularVelocity * angularVelocity, 400);
    const ax = rx * wSq;
    const ay = gravityY + ry * wSq;

    node.oldX = node.x;
    node.oldY = node.y;
    node.x += vx + ax * dtSq;
    node.y += vy + ay * dtSq;
  }

  // 2. Pinned Anchor Update
  nodes[0].x = pommelPos.x;
  nodes[0].y = pommelPos.y;
  nodes[0].oldX = pommelPos.x;
  nodes[0].oldY = pommelPos.y;

  // 3. 3-Iteration Distance Constraint Relaxation (Gauss-Seidel)
  const restLen = this.restLength || 5;
  const iterations = this.constraintIterations || 3;

  for (let it = 0; it < iterations; it++) {
    // Re-pin Node 0
    nodes[0].x = pommelPos.x;
    nodes[0].y = pommelPos.y;

    for (let i = 0; i < nodes.length - 1; i++) {
      const nA = nodes[i];
      const nB = nodes[i + 1];
      const dx = nB.x - nA.x;
      const dy = nB.y - nA.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 1e-6) {
        const diff = (dist - restLen) / dist;
        if (nA.pinned) {
          // Node 0 is pinned: Node 1 absorbs 100% of correction
          nB.x -= dx * diff;
          nB.y -= dy * diff;
        } else {
          // Shared 50/50 relaxation
          const offsetX = dx * diff * 0.5;
          const offsetY = dy * diff * 0.5;
          nA.x += offsetX;
          nA.y += offsetY;
          nB.x -= offsetX;
          nB.y -= offsetY;
        }
      }
    }
  }

  // Final Anchor Lock
  nodes[0].x = pommelPos.x;
  nodes[0].y = pommelPos.y;
}
```

#### D. Dual-Composite Trail Rendering Routine (`drawTrail`)
```javascript
function drawTrail(ctx) {
  if (!ctx || !this.trail || this.trail.length < 2) return;

  // PASS 1: Outer Dilated Crimson Aura (Screen Blend)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#ff0033';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < this.trail.length - 1; i++) {
    const s0 = this.trail[i];
    const s1 = this.trail[i + 1];
    const alpha = Math.max(0, 1 - s0.age / s0.maxAge);
    if (alpha <= 0.01) continue;

    // Filled Quad Strip
    ctx.beginPath();
    ctx.moveTo(s0.tipX, s0.tipY);
    ctx.lineTo(s1.tipX, s1.tipY);
    ctx.lineTo(s1.hiltX, s1.hiltY);
    ctx.lineTo(s0.hiltX, s0.hiltY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(s0.tipX, s0.tipY, s0.hiltX, s0.hiltY);
    grad.addColorStop(0, `rgba(255, 0, 51, ${alpha * 0.85})`);
    grad.addColorStop(0.5, `rgba(180, 0, 30, ${alpha * 0.45})`);
    grad.addColorStop(1, `rgba(139, 0, 0, ${alpha * 0.15})`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Dilated Outer Tip Glow Stroke
    ctx.strokeStyle = `rgba(255, 0, 51, ${alpha * 0.9})`;
    ctx.lineWidth = 6 + alpha * 6;
    ctx.beginPath();
    ctx.moveTo(s0.tipX, s0.tipY);
    ctx.lineTo(s1.tipX, s1.tipY);
    ctx.stroke();
  }
  ctx.restore();

  // PASS 2: Inner Jet-Black Razor Core (Source-Over)
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.lineWidth = this.coreWidth || 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < this.trail.length - 1; i++) {
    const s0 = this.trail[i];
    const s1 = this.trail[i + 1];
    const alpha = Math.max(0, 1 - s0.age / s0.maxAge);
    if (alpha <= 0.01) continue;

    ctx.strokeStyle = `rgba(5, 5, 5, ${alpha * 0.95})`;
    ctx.beginPath();
    ctx.moveTo(s0.tipX, s0.tipY);
    ctx.lineTo(s1.tipX, s1.tipY);
    ctx.stroke();
  }
  ctx.restore();
}
```

#### E. RotMG Pixel Tassel Rendering Routine (`drawTassel`)
```javascript
function drawTassel(ctx) {
  if (!ctx || !this.tasselNodes || this.tasselNodes.length < 2) return;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 1. Dark Iron Connecting Link Line
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(this.tasselNodes[0].x, this.tasselNodes[0].y);
  for (let i = 1; i < this.tasselNodes.length; i++) {
    ctx.lineTo(this.tasselNodes[i].x, this.tasselNodes[i].y);
  }
  ctx.stroke();

  // 2. Metallic 3x3 Pixel Links (Nodes 0 to 6)
  for (let i = 0; i < this.tasselNodes.length - 1; i++) {
    const node = this.tasselNodes[i];
    const px = Math.round(node.x);
    const py = Math.round(node.y);

    // Dark iron border (3x3)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 1, py - 1, 3, 3);

    // Steel body (2x2)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(px - 1, py - 1, 2, 2);

    // Specular glint highlight (1x1)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - 1, py - 1, 1, 1);
  }

  // 3. Terminal Crimson Soul Bead Charm (Node 7)
  const tipNode = this.tasselNodes[this.tasselNodes.length - 1];
  const tpx = Math.round(tipNode.x);
  const tpy = Math.round(tipNode.y);

  // Charm border (4x4)
  ctx.fillStyle = '#450a0a';
  ctx.fillRect(tpx - 2, tpy - 2, 4, 4);

  // Crimson soul gem (3x3)
  ctx.fillStyle = '#ff0033';
  ctx.fillRect(tpx - 1, tpy - 1, 3, 3);

  // Gem glint (1x1)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(tpx - 1, tpy - 1, 1, 1);

  ctx.restore();
}
```

---

## 5. Verification Method

### 5.1 Standalone Unit Test Suite (`test/test-combat.js`)
The implementer will add the following executable test cases to `test/test-combat.js`:

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const Katana = require('../src/game/Katana.js');

describe('Milestone 2: Getsuga Trail & Verlet Tassel Physics', () => {
  it('initializes rolling trail buffer with capacity 16 and 240ms lifespan', () => {
    const katana = new Katana();
    assert.ok(Array.isArray(katana.trail));
    assert.ok(Array.isArray(katana.trailNodes));
    assert.strictEqual(katana.coreWidth, 4);
    assert.strictEqual(katana.trailLifespan, 0.24);
  });

  it('records tip/hilt samples during active swing and caps at 16', () => {
    const katana = new Katana();
    katana.speed = 500;
    for (let i = 0; i < 25; i++) {
      katana.hilt = { x: 100 + i * 10, y: 200 };
      katana.tip = { x: 185 + i * 10, y: 200 };
      katana.update(0.008);
    }
    assert.strictEqual(katana.trail.length, 16);
    assert.strictEqual(typeof katana.trail[0].tipX, 'number');
    assert.strictEqual(typeof katana.trail[0].hiltX, 'number');
  });

  it('evicts trail samples and completely clears buffer when speed drops to 0 over 240ms', () => {
    const katana = new Katana();
    katana.speed = 500;
    katana.update(0.016);
    assert.ok(katana.trail.length > 0);

    katana.speed = 0;
    katana.update(0.3); // Exceeds 240ms
    assert.strictEqual(katana.trail.length, 0);
  });

  it('executes dual-composite trail draw with screen aura and 4px source-over core', () => {
    const katana = new Katana();
    katana.speed = 600;
    katana.hilt = { x: 200, y: 200 };
    katana.tip = { x: 285, y: 200 };
    katana.update(0.016);
    katana.hilt = { x: 220, y: 210 };
    katana.tip = { x: 305, y: 210 };
    katana.update(0.016);

    const ops = [];
    const mockCtx = {
      save() {},
      restore() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      fill() {},
      stroke() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      shadowBlur: 0,
      shadowColor: '',
      lineWidth: 0,
      set globalCompositeOperation(v) { ops.push(v); },
      get globalCompositeOperation() { return ops[ops.length - 1] || 'source-over'; }
    };

    katana.drawTrail(mockCtx);
    assert.ok(ops.includes('screen'), 'Outer aura must use screen blending');
    assert.ok(ops.includes('source-over'), 'Inner core must use source-over blending');
  });

  it('initializes 8-node Verlet tassel pinned at pommel anchor point (22px behind hilt)', () => {
    const katana = new Katana();
    assert.strictEqual(katana.tasselNodes.length, 8);
    assert.strictEqual(katana.chainNodes.length, 8);
    assert.strictEqual(katana.tasselCount, 8);
    assert.strictEqual(katana.restLength, 5);
    assert.strictEqual(katana.gravity, 280);
    assert.strictEqual(katana.damping, 0.05);

    katana.hilt = { x: 300, y: 300 };
    katana.angle = 0; // Blade points along +X, pommel at (278, 300)
    katana.update(0.016);

    const node0 = katana.tasselNodes[0];
    const distToHilt = Math.hypot(node0.x - katana.hilt.x, node0.y - katana.hilt.y);
    assert.ok(Math.abs(distToHilt - 22) < 1.0, `Expected pommel dist 22px, got ${distToHilt}`);
    assert.ok(distToHilt < 30, 'Satisfies test-e2e test 10.2 constraint (< 30px)');
  });

  it('maintains 5px distance relaxation across all links without chain explosion under 10,000 px/s flick', () => {
    const katana = new Katana();
    // Simulate violent mouse flick
    katana.hilt = { x: 800, y: 100 };
    katana.speed = 10000;
    katana.update(0.008);

    for (let i = 0; i < katana.tasselNodes.length - 1; i++) {
      const nA = katana.tasselNodes[i];
      const nB = katana.tasselNodes[i + 1];
      const linkDist = Math.hypot(nB.x - nA.x, nB.y - nA.y);
      assert.ok(!Number.isNaN(linkDist), `Link ${i} must not be NaN`);
      assert.ok(linkDist <= 7.0, `Link ${i} dist must remain tightly constrained (got ${linkDist})`);
    }

    const totalLen = Math.hypot(
      katana.tasselNodes[7].x - katana.tasselNodes[0].x,
      katana.tasselNodes[7].y - katana.tasselNodes[0].y
    );
    assert.ok(totalLen <= 38.0, `Total chain length must not stretch beyond ~35px (got ${totalLen})`);
  });

  it('renders RotMG 3x3 metallic pixels and terminal crimson charm bead', () => {
    const katana = new Katana();
    katana.hilt = { x: 400, y: 400 };
    katana.update(0.016);

    const rects = [];
    const mockCtx = {
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fillRect: (x, y, w, h) => rects.push({ x, y, w, h, fillStyle: mockCtx.fillStyle }),
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      imageSmoothingEnabled: true
    };

    katana.drawTassel(mockCtx);
    assert.strictEqual(mockCtx.imageSmoothingEnabled, false);
    assert.ok(rects.some(r => r.w === 3 && r.h === 3), 'Must render 3x3 pixel blocks');
    assert.ok(rects.some(r => r.w === 4 && r.h === 4), 'Must render 4x4 charm bead border');
    assert.ok(rects.some(r => r.fillStyle === '#ff0033'), 'Must render crimson charm jewel');
  });
});
```

### 5.2 Verification Commands
1. Run engine tests:
   `node --test test/test-engine.js`
2. Run combat unit tests (once implementer writes `src/game/Katana.js` and `test/test-combat.js`):
   `node --test test/test-combat.js`
3. Run full E2E test suite:
   `node --test test/test-e2e.js`

### 5.3 Invalidation Conditions
- Any NaN values generated during Verlet integration or normalization.
- Trail nodes failing to expire when `speed = 0` after 240ms.
- Tassel chain stretching beyond 40px under violent mouse flicks.
- Missing `globalCompositeOperation = 'screen'` on outer aura pass or `coreWidth !== 4`.
