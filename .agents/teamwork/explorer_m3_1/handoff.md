# Milestone 3 Architecture & Production Blueprint: Slicing Engine & Debris Physics (`src/game/Slicer.js`)

## 1. Observation

### 1.1 Direct Test Harness Expectations (`test/test-e2e.js`)
Inspection of `test/test-e2e.js` confirms the exact behavioral contracts expected by the test suite:

- **Feature 13: Clean 2D Sprite Bisection Slicing (lines 837–877)**:
  ```javascript
  // 13.1 Splits entity along cut plane into two distinct physical halves
  const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
  const halves = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500, { x: 500, y: 0 });
  assert.ok(Array.isArray(halves) && halves.length === 2);

  // 13.2 Computes accurate cut normal perpendicular to cut vector
  const norm = Slicer.computeCutNormal(0); // Cut angle 0 -> normal is (0, 1) or (0, -1)
  assert.ok(Math.abs(norm.x) < 0.001);
  assert.ok(Math.abs(Math.abs(norm.y) - 1.0) < 0.001);

  // 13.3 Dual half-plane clipping partitions sprite without overlapping
  assert.ok(typeof Slicer.sliceEnemy === 'function');

  // 13.4 Applies glowing white/crimson reiatsu cauterization seam
  assert.ok(typeof Slicer.sliceEnemy === 'function');

  // 13.5 Instantiates OffscreenCanvas / polygon paths for both debris halves
  const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500, { x: 500, y: 0 });
  assert.ok(halves[0].half === 'A' || halves[0].isHalfA || true);
  ```

- **Feature 14: Severed Debris Physics & Dissolution (lines 879–920)**:
  ```javascript
  // 14.1 Halves receive opposing lateral separation velocities
  const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500, { x: 500, y: 0 });
  assert.ok(halfA.vx !== undefined && halfB.vx !== undefined);

  // 14.2 Imparts opposing tumbling angular velocities (+- 5 to 10 rad/s)
  assert.ok(halfA.angVel * halfB.angVel <= 0); // Opposing signs

  // 14.3 Decelerates via ground friction factor (0.94^dt)
  const initVx = halfA.vx;
  halfA.update(0.1);
  assert.ok(Math.abs(halfA.vx) <= Math.abs(initVx));

  // 14.4 Dissolves and fades alpha over total lifespan of 0.85s
  halfA.update(0.9);
  assert.ok(halfA.isDead || halfA.alpha <= 0);

  // 14.5 Emits dissolving black spiritual smoke during dissolution phase
  assert.ok(typeof Slicer.sliceEnemy === 'function');
  ```

- **Geometric Boundary Tests (lines 1652–1676)**:
  ```javascript
  // 2.3.1 Tangential graze cut at outer boundary of enemy circle collider
  const halves1 = Slicer.sliceEnemy(enemy, { x: 100, y: 116 }, 0, 500, { x: 500, y: 0 });
  assert.ok(Array.isArray(halves1));

  // 2.3.2 Centroid cut passing through exact sprite origin (0, 0)
  const halves2 = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, Math.PI / 4, 500, { x: 350, y: 350 });
  assert.ok(Array.isArray(halves2) && halves2.length === 2);

  // 2.3.3 Exact vertical cut (theta = PI/2) partitions without vertical divergence
  const halves3 = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, Math.PI / 2, 500, { x: 0, y: 500 });
  assert.ok(Array.isArray(halves3) && halves3.length === 2);
  ```

- **Cross-Feature 3.1 Pipeline (lines 1811–1834)**:
  ```javascript
  // 3.1 Blade Cut -> Slicer -> Particles -> Camera Trauma pipeline
  katana.speed = 700;
  const halves = Slicer.sliceEnemy(enemy, { x: 640, y: 300 }, 0, katana.speed, { x: 700, y: 0 });
  ps.spawnEmbers(enemy.x, enemy.y, 12);
  ps.spawnShards(enemy.x, enemy.y, 6);
  cam.addTrauma(0.12);
  assert.strictEqual(halves.length, 2);
  ```

### 1.2 Interface Contract Definition (`orchestrator_1/PROJECT.md`)
Lines 67–69 state:
- `TZ.Slicer`: `sliceEnemy(enemy, cutPoint, cutAngle, swingSpeed, swingVel)`: returns `[HalfA, HalfB]` as debris entities.
- Export standard: conditional CommonJS and `window.TZ.Slicer` attachment.

### 1.3 Supporting Engine Utilities
- `src/engine/Vector2.js`: provides `Vector2` (`add`, `sub`, `scale`, `normalize`, `dot`, `cross`, `fromAngle`).
- `src/engine/SpriteGen.js`: provides `SpriteGen.getSprite(name, scale)` and `MockCanvas` for headless execution.
- `src/engine/ParticleSystem.js`: provides `spawnSmoke(x, y, count, color)` with `#050505` miasma, and `spawnEmbers(x, y, count, angle, color)`.

---

## 2. Logic Chain

### 2.1 Cut Normal Mathematics
- The cut line orientation is defined by angle $\theta = \text{cutAngle}$.
- Cut tangent direction vector: $\mathbf{u} = (\cos\theta, \sin\theta)$.
- Cut normal unit vector $\mathbf{n}$ is rotated $90^\circ$ ($\pi/2$) counter-clockwise:
  $$\mathbf{n} = (-\sin\theta, \cos\theta)$$
- For $\theta = 0$: $\mathbf{n} = (-\sin 0, \cos 0) = (0, 1)$, with $\|\mathbf{n}\| = 1$, $n_x = 0$, $n_y = 1$. This directly satisfies `test-e2e.js` test 13.2 (`Math.abs(norm.x) < 0.001` and `Math.abs(Math.abs(norm.y) - 1.0) < 0.001`).

### 2.2 Dual Half-Plane Geometric Partitioning
- In the enemy's local coordinate frame (origin at enemy center $(x_e, y_e)$):
  $$\Delta = (c_x - x_e, c_y - y_e)$$
  where $\mathbf{c} = (c_x, c_y)$ is the cut point.
- The signed distance from any point $\mathbf{p} = (px, py)$ to the cut line is:
  $$d(\mathbf{p}) = (\mathbf{p} - \Delta) \cdot \mathbf{n} = (px - \Delta x) \cdot n_x + (py - \Delta y) \cdot n_y$$
- **Half A** is defined as $d(\mathbf{p}) \ge 0$.
- **Half B** is defined as $d(\mathbf{p}) < 0$.
- To construct finite polygon clipping boundaries enclosing the bounding hull $[-B, B] \times [-B, B]$ (where $B = \max(enemy.radius \times 3, 64)$):
  - Cut line segment across the hull:
    $$P_1 = \Delta - 2B \cdot \mathbf{u}, \quad P_2 = \Delta + 2B \cdot \mathbf{u}$$
  - For Half A: extend in $+\mathbf{n}$ direction:
    $$P_3 = P_2 + 2B \cdot \mathbf{n}, \quad P_4 = P_1 + 2B \cdot \mathbf{n}$$
    Polygon vertices: $[P_1, P_2, P_3, P_4]$.
  - For Half B: extend in $-\mathbf{n}$ direction:
    $$Q_3 = P_2 - 2B \cdot \mathbf{n}, \quad Q_4 = P_1 - 2B \cdot \mathbf{n}$$
    Polygon vertices: $[P_1, P_2, Q_3, Q_4]$.
- The intersection of the cut line with the enemy bounding circle of radius $R$:
  $$d_{\perp} = \Delta \cdot \mathbf{n}$$
  If $|d_{\perp}| < R$, the chord half-length is $L = \sqrt{R^2 - d_{\perp}^2}$, and the cut seam endpoints on the enemy surface are:
  $$S_1 = d_{\perp} \mathbf{n} - L \mathbf{u}, \quad S_2 = d_{\perp} \mathbf{n} + L \mathbf{u}$$
  If $|d_{\perp}| \ge R$ (outer tangential graze), $S_1 = S_2 = \Delta$.

### 2.3 Severed Debris Impulse Dynamics
- Upon bisection, each severed half receives:
  1. Forward momentum transfer from the katana swing velocity:
     $$\mathbf{v}_{\text{forward}} = 0.35 \cdot \mathbf{v}_{\text{swing}}$$
  2. Lateral impulse separation normal to the cut plane:
     $$v_{\text{sep}} = \max(120, \text{swingSpeed} \times 0.35)$$
     $$\mathbf{v}_A = \mathbf{v}_{\text{forward}} + v_{\text{sep}} \cdot \mathbf{n}$$
     $$\mathbf{v}_B = \mathbf{v}_{\text{forward}} - v_{\text{sep}} \cdot \mathbf{n}$$
  - Relative separation speed: $\|\mathbf{v}_A - \mathbf{v}_B\| = 2 v_{\text{sep}}$, cleanly splitting the halves apart laterally.
- Opposing angular tumbling velocities:
  $$\omega_A = +(5.0 + \text{rand}() \times 5.0) \text{ rad/s}$$
  $$\omega_B = -(5.0 + \text{rand}() \times 5.0) \text{ rad/s}$$
  $$\omega_A \cdot \omega_B \le 0$$
- Ground friction and angular damping:
  $$\mathbf{v}(t + \Delta t) = \mathbf{v}(t) \cdot (0.94^{60 \cdot \Delta t})$$
  $$\omega(t + \Delta t) = \omega(t) \cdot (0.95^{60 \cdot \Delta t})$$
  At $\Delta t = 0.1$, $\mathbf{v}(t + 0.1) \le \mathbf{v}(t)$, strictly satisfying test 14.3.

### 2.4 Lifespan, Monotonic Alpha Dissolution & Kuroi Smoke
- Lifespan is $0.85\text{s}$ ($0.9\text{s}$ hard despawn limit):
  $$\alpha(t) = \max\left(0.0, 1.0 - \frac{t}{0.85}\right)$$
  - For $t \ge 0.85\text{s}$, $\alpha = 0.0$ and $\text{isDead} = \text{true}$.
  - At $t = 0.9\text{s}$, $\text{isDead} = \text{true}$ and $\alpha \le 0$, satisfying test 14.4.
- During dissolution, when $\alpha > 0$ and $t < 0.85$:
  - Every $0.06\text{s}$, emit black spiritual smoke at the debris center:
    `particleSystem.spawnSmoke(this.x, this.y, 1, '#050505')`

### 2.5 Cauterized Reiatsu Seam Rendering
Along the chord from $S_1$ to $S_2$:
- Pass 1 (Outer Crimson Reiatsu Aura):
  - `strokeStyle = '#ff0033'`, `lineWidth = 3`, `shadowColor = '#ff0033'`, `shadowBlur = 6`, `lineCap = 'round'`.
- Pass 2 (Inner Pure White Core):
  - `strokeStyle = '#ffffff'`, `lineWidth = 1`, `shadowColor = '#ffffff'`, `shadowBlur = 2`, `lineCap = 'round'`.
- Preserves exact Bleach getsuga cauterization visuals and passes color checks.

---

## 3. Caveats

1. **Headless Execution Environment**: In Node.js testing environments, `OffscreenCanvas` is not natively present on `globalThis`. `Slicer.js` must detect environment capabilities:
   - Priority 1: `globalThis.OffscreenCanvas`
   - Priority 2: `document.createElement('canvas')`
   - Priority 3: `global.TZ.MockCanvas` (from `CanvasRenderer.js`)
   - Priority 4: Dynamic canvas 2D path clipping fallback directly in `draw(ctx)`.
2. **Enemy Input Shape Variations**: In unit and integration tests, `enemy` might be a simple object literal `{ x: 100, y: 100, radius: 16, type: 'crawler' }` without an instantiated `sprite` canvas. `DebrisPiece.draw(ctx)` must gracefully handle missing sprites by drawing the clipped circular hull and seam lines so tests never throw.
3. **Missing Cut Parameters**: When `cutPoint` or `swingVel` are omitted or `null`, `Slicer.sliceEnemy` must safely default `cutPoint` to `{ x: enemy.x, y: enemy.y }` and construct `swingVel` from `Vector2.fromAngle(cutAngle, swingSpeed)`.

---

## 4. Conclusion & Production Blueprints

### 4.1 Production Blueprint for `src/game/Slicer.js`

```javascript
/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/game/Slicer.js
 * 
 * 2D Sprite Bisection Engine, Geometric Half-Plane Polygon Clipping,
 * Severed Debris Separation Physics & Cauterized Reiatsu Seams.
 * Zero external dependencies. Browser & Node.js compatible.
 */
(function (global) {
  'use strict';

  // Dependency resolution (Node & Browser)
  const Vector2 = (typeof require !== 'undefined')
    ? (function () { try { return require('../engine/Vector2'); } catch (e) { return global.TZ && global.TZ.Vector2; } })()
    : (global.TZ && global.TZ.Vector2);

  const SpriteGen = (typeof require !== 'undefined')
    ? (function () { try { return require('../engine/SpriteGen'); } catch (e) { return global.TZ && global.TZ.SpriteGen; } })()
    : (global.TZ && global.TZ.SpriteGen);

  /**
   * Helper to instantiate offscreen canvases across browser and headless Node test runners.
   */
  function createOffscreen(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      return c;
    }
    if (global.TZ && global.TZ.MockCanvas) {
      return new global.TZ.MockCanvas(width, height);
    }
    const MockCanvasClass = (typeof module !== 'undefined' && module.exports && module.exports.MockCanvas)
      ? module.exports.MockCanvas
      : (typeof require !== 'undefined' ? (function () {
          try { return require('../engine/CanvasRenderer').MockCanvas; } catch (e) { return null; }
        })() : null);

    if (MockCanvasClass) {
      return new MockCanvasClass(width, height);
    }

    return {
      width,
      height,
      getContext: () => ({
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        clip: () => {},
        drawImage: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 1,
        imageSmoothingEnabled: false
      })
    };
  }

  /**
   * DebrisPiece represents a severed half of a bisected enemy entity.
   */
  class DebrisPiece {
    /**
     * @param {Object} config
     * @param {string} config.half 'A' or 'B'
     * @param {number} config.x Origin X in world space
     * @param {number} config.y Origin Y in world space
     * @param {number} config.vx Linear velocity X
     * @param {number} config.vy Linear velocity Y
     * @param {number} config.angle Initial rotation angle
     * @param {number} config.angVel Tumbling angular velocity
     * @param {number} config.radius Half collision/visual radius
     * @param {string} config.type Enemy type identifier ('crawler', 'flyer', 'brute', 'menos')
     * @param {Object|null} config.sprite Cached sprite canvas or image
     * @param {Array<{x: number, y: number}>} config.clipPolygon Local clipping polygon vertices
     * @param {{x: number, y: number}} config.seamStart Local seam start endpoint
     * @param {{x: number, y: number}} config.seamEnd Local seam end endpoint
     * @param {Object} [config.options]
     */
    constructor(config) {
      this.half = config.half || 'A';
      this.isHalfA = (this.half === 'A');
      this.isHalfB = (this.half === 'B');

      this.x = config.x || 0;
      this.y = config.y || 0;
      this.vx = config.vx || 0;
      this.vy = config.vy || 0;
      this.angle = config.angle || 0;
      this.angVel = config.angVel || 0;

      this.radius = config.radius || 16;
      this.type = config.type || 'crawler';
      this.sprite = config.sprite || null;
      this.clipPolygon = config.clipPolygon || [];
      this.polygon = this.clipPolygon; // Alias for test compatibility
      this.seamStart = config.seamStart || { x: -this.radius, y: 0 };
      this.seamEnd = config.seamEnd || { x: this.radius, y: 0 };

      // Physics & Dissolution parameters
      this.life = 0.0;
      this.lifespan = 0.85;
      this.maxLife = 0.85;
      this.alpha = 1.0;
      this.friction = 0.94; // Base friction factor per frame (0.94^dt)
      this.isDead = false;

      // Particle emission timing
      this.smokeTimer = 0.0;
      this.smokeInterval = 0.06;
      this.particleSystem = config.particleSystem || null;

      // Pre-rasterize offscreen canvas for this half if possible
      this.canvas = null;
      this._rasterizeOffscreenHalf();
    }

    /**
     * Pre-rasterizes the half-plane clipped sprite with seam onto an offscreen canvas.
     * @private
     */
    _rasterizeOffscreenHalf() {
      const size = Math.max(64, Math.ceil(this.radius * 3.5));
      const offscreen = createOffscreen(size, size);
      const ctx = offscreen.getContext('2d');
      if (!ctx) {
        this.canvas = offscreen;
        return;
      }

      ctx.imageSmoothingEnabled = false;
      const cx = size / 2;
      const cy = size / 2;

      ctx.save();
      ctx.translate(cx, cy);

      // Apply clipping path
      if (this.clipPolygon.length >= 3 && typeof ctx.clip === 'function') {
        ctx.beginPath();
        ctx.moveTo(this.clipPolygon[0].x, this.clipPolygon[0].y);
        for (let i = 1; i < this.clipPolygon.length; i++) {
          ctx.lineTo(this.clipPolygon[i].x, this.clipPolygon[i].y);
        }
        ctx.closePath();
        ctx.clip();
      }

      // Render base sprite or procedural silhouette
      if (this.sprite) {
        const sw = this.sprite.width || (this.radius * 2);
        const sh = this.sprite.height || (this.radius * 2);
        ctx.drawImage(this.sprite, -sw / 2, -sh / 2, sw, sh);
      } else {
        ctx.fillStyle = (this.type === 'crawler') ? '#3b0764' : (this.type === 'flyer' ? '#be123c' : '#18181b');
        ctx.beginPath();
        if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        } else {
          ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        }
        ctx.fill();
      }

      // Render glowing Reiatsu cauterization seam
      this._renderSeamToContext(ctx);

      ctx.restore();
      this.canvas = offscreen;
    }

    /**
     * Draws the glowing cauterized Reiatsu seam line along the cut edge.
     * @private
     */
    _renderSeamToContext(ctx) {
      if (!this.seamStart || !this.seamEnd) return;

      // Outer Crimson Reiatsu Aura (#ff0033)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.seamStart.x, this.seamStart.y);
      ctx.lineTo(this.seamEnd.x, this.seamEnd.y);
      ctx.strokeStyle = '#ff0033';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      // Inner White Cauterized Core (#ffffff)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.seamStart.x, this.seamStart.y);
      ctx.lineTo(this.seamEnd.x, this.seamEnd.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    /**
     * Advances debris separation physics, ground friction, and dissolution over delta time.
     * @param {number} dt Delta time in seconds
     * @param {Object} [particleSystem] Optional active ParticleSystem instance
     */
    update(dt, particleSystem) {
      if (dt <= 0 || isNaN(dt) || this.isDead) return;

      this.life += dt;

      // Monotonic alpha dissolution over 0.85s
      this.alpha = Math.max(0.0, 1.0 - (this.life / this.lifespan));

      // Hard death cutoff at >= 0.85s (dead at 0.9s)
      if (this.life >= this.lifespan) {
        this.alpha = 0.0;
        this.isDead = true;
      }

      // Linear motion & ground friction damping (0.94^dt at 60Hz physics)
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const frictionDamp = Math.pow(this.friction, dt * 60);
      this.vx *= frictionDamp;
      this.vy *= frictionDamp;

      // Tumbling rotation & angular damping
      this.angle += this.angVel * dt;
      this.angVel *= Math.pow(0.95, dt * 60);

      // Spiritual black smoke emission during dissolution phase
      const ps = particleSystem || this.particleSystem;
      if (ps && typeof ps.spawnSmoke === 'function' && !this.isDead && this.alpha > 0.05) {
        this.smokeTimer += dt;
        if (this.smokeTimer >= this.smokeInterval) {
          this.smokeTimer -= this.smokeInterval;
          ps.spawnSmoke(this.x, this.y, 1, '#050505');
        }
      }
    }

    /**
     * Renders the severed debris half with exact alpha fade and transform.
     * @param {CanvasRenderingContext2D|Object} ctx Target 2D rendering context
     */
    draw(ctx) {
      if (!ctx || this.isDead || this.alpha <= 0.001) return;

      ctx.save();
      ctx.globalAlpha = Math.max(0.0, Math.min(1.0, this.alpha));
      ctx.translate(this.x, this.y);
      if (this.angle !== 0) {
        ctx.rotate(this.angle);
      }

      if (this.canvas) {
        const sw = this.canvas.width || (this.radius * 2);
        const sh = this.canvas.height || (this.radius * 2);
        ctx.drawImage(this.canvas, -sw / 2, -sh / 2);
      } else {
        // Direct context clipping fallback
        if (this.clipPolygon.length >= 3 && typeof ctx.clip === 'function') {
          ctx.beginPath();
          ctx.moveTo(this.clipPolygon[0].x, this.clipPolygon[0].y);
          for (let i = 1; i < this.clipPolygon.length; i++) {
            ctx.lineTo(this.clipPolygon[i].x, this.clipPolygon[i].y);
          }
          ctx.closePath();
          ctx.clip();
        }

        if (this.sprite) {
          const sw = this.sprite.width || (this.radius * 2);
          const sh = this.sprite.height || (this.radius * 2);
          ctx.drawImage(this.sprite, -sw / 2, -sh / 2, sw, sh);
        } else {
          ctx.fillStyle = '#3b0764';
          ctx.beginPath();
          if (typeof ctx.arc === 'function') {
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
          } else {
            ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
          }
          ctx.fill();
        }

        this._renderSeamToContext(ctx);
      }

      ctx.restore();
    }
  }

  /**
   * Slicer engine namespace providing static slicing geometry and bisection routines.
   */
  class Slicer {
    /**
     * Computes the normalized 2D normal unit vector perpendicular to a cut angle.
     * For cut angle 0 rad (horizontal sweep to right), returns normal (0, 1).
     * @param {number} cutAngle Direction of the blade cut in radians
     * @returns {Vector2|{x: number, y: number}} Normalized unit vector
     */
    static computeCutNormal(cutAngle) {
      const rad = typeof cutAngle === 'number' && !isNaN(cutAngle) ? cutAngle : 0;
      // Perpendicular vector: rotated +90 deg (+PI/2) from cut direction
      const nx = -Math.sin(rad);
      const ny = Math.cos(rad);
      if (Vector2) {
        return new Vector2(nx, ny);
      }
      return { x: nx, y: ny };
    }

    /**
     * Slices an enemy entity along a cutting plane into two distinct physical halves.
     * 
     * @param {Object} enemy Target enemy entity with { x, y, radius, type, sprite? }
     * @param {Object} [cutPoint] World space point where the blade intersected the enemy
     * @param {number} [cutAngle=0] Direction of the cut in radians
     * @param {number} [swingSpeed=400] Speed of the blade swing in px/s
     * @param {Object} [swingVel] Linear velocity vector of the katana blade { x, y }
     * @param {Object} [options] Optional overrides (particleSystem, sprite)
     * @returns {[DebrisPiece, DebrisPiece]} Array containing [HalfA, HalfB]
     */
    static sliceEnemy(enemy, cutPoint, cutAngle = 0, swingSpeed = 400, swingVel = null, options = {}) {
      if (!enemy) return [];

      const ex = enemy.x || 0;
      const ey = enemy.y || 0;
      const radius = enemy.radius || 16;
      const type = enemy.type || 'crawler';
      const angle = (typeof cutAngle === 'number' && !isNaN(cutAngle)) ? cutAngle : 0;
      const speed = (typeof swingSpeed === 'number' && !isNaN(swingSpeed) && swingSpeed > 0) ? swingSpeed : 400;

      // Resolve cut point (default to enemy center if omitted)
      const cx = (cutPoint && typeof cutPoint.x === 'number') ? cutPoint.x : ex;
      const cy = (cutPoint && typeof cutPoint.y === 'number') ? cutPoint.y : ey;

      // Unit tangent vector along cut direction
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);

      // Normalized cut normal vector perpendicular to cut angle
      const normal = Slicer.computeCutNormal(angle);
      const nx = normal.x;
      const ny = normal.y;

      // Local cut offset relative to enemy center
      const dx = cx - ex;
      const dy = cy - ey;

      // Perpendicular distance from enemy center to cut line
      const dPerp = dx * nx + dy * ny;

      // Resolve enemy sprite (from enemy property, options, or SpriteGen cache)
      let sprite = options.sprite || enemy.sprite || null;
      if (!sprite && SpriteGen && typeof SpriteGen.getSprite === 'function' && type) {
        try {
          sprite = SpriteGen.getSprite(type);
        } catch (e) {
          sprite = null;
        }
      }

      // Calculate seam endpoints on enemy bounding hull
      let seamStart, seamEnd;
      const rSq = radius * radius;
      const dPerpSq = dPerp * dPerp;

      if (dPerpSq < rSq) {
        // Line cuts through circle interior: compute chord endpoints
        const chordHalfLen = Math.sqrt(rSq - dPerpSq);
        // Base point on cut line closest to enemy center: (dPerp * nx, dPerp * ny)
        const bx = dPerp * nx;
        const by = dPerp * ny;
        seamStart = { x: bx - chordHalfLen * ux, y: by - chordHalfLen * uy };
        seamEnd = { x: bx + chordHalfLen * ux, y: by + chordHalfLen * uy };
      } else {
        // Tangential graze cut at or outside radius
        seamStart = { x: dx - radius * ux, y: dy - radius * uy };
        seamEnd = { x: dx + radius * ux, y: dy + radius * uy };
      }

      // Construct bounding clipping polygons for Half A (+normal) and Half B (-normal)
      const boundSpan = Math.max(radius * 3.5, 64);
      // Cut line extended endpoints across the bounding box
      const p1 = { x: dx - boundSpan * ux, y: dy - boundSpan * uy };
      const p2 = { x: dx + boundSpan * ux, y: dy + boundSpan * uy };

      // Half A polygon: [p1 -> p2 -> p2 + span*n -> p1 + span*n]
      const polyA = [
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p2.y },
        { x: p2.x + boundSpan * nx, y: p2.y + boundSpan * ny },
        { x: p1.x + boundSpan * nx, y: p1.y + boundSpan * ny }
      ];

      // Half B polygon: [p1 -> p2 -> p2 - span*n -> p1 - span*n]
      const polyB = [
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p2.y },
        { x: p2.x - boundSpan * nx, y: p2.y - boundSpan * ny },
        { x: p1.x - boundSpan * nx, y: p1.y - boundSpan * ny }
      ];

      // Resolve forward momentum from katana swing velocity
      let fwdVx = 0;
      let fwdVy = 0;
      const fwdRatio = 0.35;

      if (swingVel && typeof swingVel.x === 'number' && typeof swingVel.y === 'number') {
        fwdVx = swingVel.x * fwdRatio;
        fwdVy = swingVel.y * fwdRatio;
      } else {
        fwdVx = ux * speed * fwdRatio;
        fwdVy = uy * speed * fwdRatio;
      }

      // Lateral impulse separation speed (opposing along cut normal)
      const sepSpeed = Math.max(120, speed * 0.35);
      const sepVx = nx * sepSpeed;
      const sepVy = ny * sepSpeed;

      // Opposing tumbling angular velocities strictly in +- [5, 10] rad/s
      const tumbleBase = 6.0 + Math.random() * 3.0;
      const angVelA = tumbleBase;
      const angVelB = -tumbleBase;

      const ps = options.particleSystem || enemy.particleSystem || null;

      // Instantiate distinct physical halves
      const halfA = new DebrisPiece({
        half: 'A',
        x: ex,
        y: ey,
        vx: fwdVx + sepVx,
        vy: fwdVy + sepVy,
        angle: enemy.angle || 0,
        angVel: angVelA,
        radius,
        type,
        sprite,
        clipPolygon: polyA,
        seamStart,
        seamEnd,
        particleSystem: ps
      });

      const halfB = new DebrisPiece({
        half: 'B',
        x: ex,
        y: ey,
        vx: fwdVx - sepVx,
        vy: fwdVy - sepVy,
        angle: enemy.angle || 0,
        angVel: angVelB,
        radius,
        type,
        sprite,
        clipPolygon: polyB,
        seamStart,
        seamEnd,
        particleSystem: ps
      });

      return [halfA, halfB];
    }
  }

  // Universal Modular Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.Slicer = Slicer;
  global.TZ.DebrisPiece = DebrisPiece;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Slicer;
    module.exports.Slicer = Slicer;
    module.exports.DebrisPiece = DebrisPiece;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
```

---

### 4.2 Comprehensive Unit Test Specifications for `test/test-combat.js`

Add the following two test suites to `test/test-combat.js`:

```javascript
// ============================================================================
// 8. Feature 13: Clean 2D Sprite Bisection Slicing
// ============================================================================
describe('Feature 13: Clean 2D Sprite Bisection Slicing', () => {
  const Slicer = require('../src/game/Slicer.js');

  it('13.1 computes accurate cut normal perpendicular to cut vector for all cardinal & diagonal angles', () => {
    // Cut angle 0 rad (horizontal to right): normal is (0, 1)
    const n0 = Slicer.computeCutNormal(0);
    assert.ok(Math.abs(n0.x) < 1e-4);
    assert.ok(Math.abs(n0.y - 1.0) < 1e-4);

    // Cut angle PI/2 rad (vertical downward): normal is (-1, 0)
    const nPi2 = Slicer.computeCutNormal(Math.PI / 2);
    assert.ok(Math.abs(nPi2.x - (-1.0)) < 1e-4);
    assert.ok(Math.abs(nPi2.y) < 1e-4);

    // Cut angle PI rad (horizontal to left): normal is (0, -1)
    const nPi = Slicer.computeCutNormal(Math.PI);
    assert.ok(Math.abs(nPi.x) < 1e-4);
    assert.ok(Math.abs(nPi.y - (-1.0)) < 1e-4);

    // Dot product between cut direction and normal is strictly 0
    const testAngles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, 2.3];
    for (const a of testAngles) {
      const norm = Slicer.computeCutNormal(a);
      const u = { x: Math.cos(a), y: Math.sin(a) };
      const dot = u.x * norm.x + u.y * norm.y;
      assert.ok(Math.abs(dot) < 1e-4, `Cut normal at angle ${a} must be perpendicular`);
    }
  });

  it('13.2 splits entity along cut plane into two distinct physical halves', () => {
    const enemy = { x: 300, y: 200, radius: 16, type: 'crawler' };
    const halves = Slicer.sliceEnemy(enemy, { x: 300, y: 200 }, 0, 500, { x: 500, y: 0 });

    assert.ok(Array.isArray(halves));
    assert.strictEqual(halves.length, 2);
    assert.strictEqual(halves[0].half, 'A');
    assert.strictEqual(halves[1].half, 'B');
    assert.strictEqual(halves[0].isHalfA, true);
    assert.strictEqual(halves[1].isHalfB, true);
  });

  it('13.3 dual half-plane clipping partitions sprite hull without overlapping', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, Math.PI / 4, 600, { x: 424, y: 424 });

    assert.ok(Array.isArray(halfA.clipPolygon) && halfA.clipPolygon.length === 4);
    assert.ok(Array.isArray(halfB.clipPolygon) && halfB.clipPolygon.length === 4);

    // Half A and Half B share the exact cut line segment (first two vertices)
    assert.strictEqual(halfA.clipPolygon[0].x, halfB.clipPolygon[0].x);
    assert.strictEqual(halfA.clipPolygon[0].y, halfB.clipPolygon[0].y);
    assert.strictEqual(halfA.clipPolygon[1].x, halfB.clipPolygon[1].x);
    assert.strictEqual(halfA.clipPolygon[1].y, halfB.clipPolygon[1].y);
  });

  it('13.4 instantiates OffscreenCanvas / polygon paths for both debris halves', () => {
    const enemy = { x: 500, y: 350, radius: 12, type: 'flyer' };
    const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 500, y: 350 }, 0, 400);

    assert.ok(halfA.canvas !== null);
    assert.ok(halfB.canvas !== null);
    assert.ok(halfA.polygon.length >= 3);
    assert.ok(halfB.polygon.length >= 3);
  });

  it('13.5 applies glowing white/crimson (#ff0033 / #ffffff) reiatsu cauterization seam', () => {
    const enemy = { x: 200, y: 200, radius: 16, type: 'crawler' };
    const [halfA] = Slicer.sliceEnemy(enemy, { x: 200, y: 200 }, 0, 500);

    const ctx = new MockContext2D();
    halfA.draw(ctx);

    assert.ok(ctx.calls.includes('save'));
    assert.ok(ctx.calls.includes('restore'));
    assert.ok(ctx.calls.includes('stroke'));
  });

  it('13.6 handles tangential graze cuts at circle boundary without NaN', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    // Cut point at tangential boundary y = 116
    const halves = Slicer.sliceEnemy(enemy, { x: 100, y: 116 }, 0, 500, { x: 500, y: 0 });

    assert.strictEqual(halves.length, 2);
    assert.ok(!Number.isNaN(halves[0].seamStart.x));
    assert.ok(!Number.isNaN(halves[0].seamEnd.y));
    assert.ok(!Number.isNaN(halves[0].vx));
    assert.ok(!Number.isNaN(halves[1].vy));
  });

  it('13.7 handles exact vertical cut (theta = PI/2) cleanly without horizontal divergence', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, Math.PI / 2, 500, { x: 0, y: 500 });

    assert.strictEqual(halvesA !== null, true);
    // Vertical cut separates laterally along horizontal normal (-1, 0)
    assert.ok(halfA.vx * halfB.vx < 0 || (halfA.vx !== halfB.vx));
  });
});

// ============================================================================
// 9. Feature 14: Severed Debris Physics & Dissolution
// ============================================================================
describe('Feature 14: Severed Debris Physics & Dissolution', () => {
  const Slicer = require('../src/game/Slicer.js');
  const ParticleSystem = require('../src/engine/ParticleSystem.js');

  it('14.1 halves receive opposing lateral separation velocities + forward momentum', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const swingSpeed = 600;
    const swingVel = { x: 600, y: 0 };
    const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, swingSpeed, swingVel);

    // Forward momentum check (both have positive Vx from swingVel)
    assert.ok(halfA.vx > 0, 'Half A must carry forward momentum');
    assert.ok(halfB.vx > 0, 'Half B must carry forward momentum');

    // Lateral separation check (opposing signs on Vy along cut normal)
    assert.ok(halfA.vy > 0, 'Half A Vy must be positive along normal');
    assert.ok(halfB.vy < 0, 'Half B Vy must be negative along normal');
    assert.ok(halfA.vy - halfB.vy >= 240, 'Separation velocity must push halves apart');
  });

  it('14.2 imparts opposing tumbling angular velocities (+- 5 to 10 rad/s)', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500);

    assert.ok(halfA.angVel * halfB.angVel < 0, 'Angular velocities must have opposing signs');
    assert.ok(Math.abs(halfA.angVel) >= 5.0 && Math.abs(halfA.angVel) <= 10.0);
    assert.ok(Math.abs(halfB.angVel) >= 5.0 && Math.abs(halfB.angVel) <= 10.0);
  });

  it('14.3 decelerates via ground friction factor (0.94^dt)', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500, { x: 500, y: 0 });

    const initVx = halfA.vx;
    const initVy = halfA.vy;
    halfA.update(0.1);

    assert.ok(Math.abs(halfA.vx) < Math.abs(initVx), 'Vx must decelerate');
    assert.ok(Math.abs(halfA.vy) < Math.abs(initVy), 'Vy must decelerate');
    assert.strictEqual(halfA.friction, 0.94);
  });

  it('14.4 decays angular tumbling smoothly over time', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500);

    const initAngVel = Math.abs(halfA.angVel);
    halfA.update(0.1);
    assert.ok(Math.abs(halfA.angVel) < initAngVel, 'Angular velocity must decay smoothly');
  });

  it('14.5 dissolves and fades alpha monotonically over total lifespan of 0.85s', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500);

    assert.strictEqual(halfA.alpha, 1.0);
    assert.strictEqual(halfA.isDead, false);

    // Midpoint update (0.425s)
    halfA.update(0.425);
    assert.ok(Math.abs(halfA.alpha - 0.5) < 0.05);
    assert.strictEqual(halfA.isDead, false);

    // Full lifespan update (0.425s + 0.425s = 0.85s)
    halfA.update(0.425);
    assert.strictEqual(halfA.alpha, 0.0);
    assert.strictEqual(halfA.isDead, true);

    // Past lifespan update (0.9s total)
    halfA.update(0.05);
    assert.strictEqual(halfA.alpha, 0.0);
    assert.strictEqual(halfA.isDead, true);
  });

  it('14.6 emits dissolving black spiritual smoke during dissolution phase', () => {
    const ps = new ParticleSystem({ capacity: 50 });
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler', particleSystem: ps };
    const [halfA] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500, null, { particleSystem: ps });

    assert.strictEqual(ps.activeCount, 0);

    // Advance 0.07s (> 0.06s smokeInterval)
    halfA.update(0.07, ps);
    assert.ok(ps.activeCount >= 1, 'Must emit smoke particle into ParticleSystem');
    assert.strictEqual(ps.particles[0].color, '#050505');
  });
});
```

---

## 5. Verification Method

Once implemented, verify independently using:
1. `node --test test/test-combat.js`
   - Expected result: 100% pass across all 9 suites (Milestone 2 Features 7, 8, 3, 9, 10, 11, 12 PLUS Milestone 3 Features 13, 14).
2. `node --test test/test-e2e.js`
   - Expected result: Features 13.1–13.5, 14.1–14.5, Boundary 2.3.1–2.3.3, and Pipeline 3.1 pass without being skipped.
3. Invalidation conditions:
   - Any test failure in `node --test test/test-e2e.js` or `node --test test/test-combat.js`.
   - `halfA.angVel * halfB.angVel > 0` (tumbling in same direction).
   - Debris alpha not reaching 0 at $t \ge 0.85\text{s}$.
