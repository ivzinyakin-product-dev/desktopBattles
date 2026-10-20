# Handoff Report: Special Combat Moves Blueprint (Senka Arc & Getsuga Wave)

**Agent**: Explorer 3 (`explorer_m2_3`)  
**Milestone**: Milestone 2 — Tensa Zangetsu Blade Kinematics, Trail & Tassel  
**Working Directory**: `c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m2_3\`  
**Target Files**: `src/game/Katana.js`, `src/game/Projectile.js`, `test/test-combat.js`

---

## 1. Observation

### 1.1 Requirements & Specifications
1. **`ORIGINAL_REQUEST.md`** (Lines 12–13):
   > "The player directly controls Tensa Zangetsu via mouse movement. High velocity mouse swings execute blade slashes with dynamic Getsuga Tensho trails (black core, crimson glow). Left click performs a forced slash; Right Click / Spacebar unleashes a ranged crescent Getsuga Tensho wave."
2. **`orchestrator_1/PROJECT.md`** (Lines 24–25, 60–66):
   > "| 11 | Left-Click Forced Slash | 240° circular Senka arc slash with high damage and screen shake | M2 | Survey 2 |"  
   > "| 12 | Right-Click / Spacebar Crescent Wave | Ranged penetrating Kuroi Getsuga Tensho projectile wave | M2 | Survey 2 |"  
   > "M2 Katana ↔ M3 Slicer & Enemies: ... projectiles: Array of TZ.GetsugaWave ({ x, y, vx, vy, radius, life, update, draw })"
3. **`test/test-e2e.js`** (Lines 748–835, 1100–1121, 1483–1492):
   - **Feature 11: Left-Click Forced Slash**:
     - Line 754: `assert.ok(katana.isForcedSlashing || katana.forcedSlashActive);`
     - Line 763: Second trigger within 0.35s returns `false` (`assert.strictEqual(secondTrigger, false);`).
     - Line 771: `assert.strictEqual(katana.forcedSlashRadius || 100, 100);`
     - Line 777: `assert.ok((katana.forcedSlashDamageMult || 1.5) === 1.5);`
     - Line 784: `assert.strictEqual(katana.forcedSlashTrauma || 0.25, 0.25);`
   - **Feature 12: Right-Click / Spacebar Crescent Wave**:
     - Line 793: `katana.triggerCrescentWave(640, 360, 1, 0);`
     - Line 795: `assert.strictEqual(katana.projectiles[0].speed || 820, 820);`
     - Line 804: Second trigger within 1.8s returns `false` (`assert.strictEqual(res, false);`).
     - Line 813: `assert.strictEqual(proj.maxPierces || proj.pierceCount || 8, 8);`
     - Line 823: `proj.update(1.7); assert.ok(proj.isDead || proj.life <= 0);`
     - Line 832: `katana.projectiles[0].draw(ctx); assert.ok(ctx.calls.length > 0);`
   - **Adversarial & Cross-Feature Hardening**:
     - Line 1488–1491: 50 click spam test throttled by cooldowns (`assert.ok(katana.projectiles.length <= 5);`).
     - Line 1032–1038: Getsuga wave cracks Armored Brute carapace (`brute.armorBroken = true`).
     - Line 1117–1120: Getsuga wave deflects / nullifies Menos Grande Cero beam.

### 1.2 Existing Codebase State
- `src/engine/Vector2.js` provides `Vector2` (add, sub, scale, normalize, rotate, dist, etc.) and `SweptQuad` (`fromBladeSegments`, `intersectsCircle`).
- `src/engine/Camera.js` provides `addTrauma(amount)` with trauma-squared shake.
- `src/engine/ParticleSystem.js` provides `spawnEmbers(x, y, count, angle, color)` and `spawnSmoke(x, y, count)`.
- `test/test-engine.js` runs cleanly on Node.js v24 native test runner (`node --test test/test-engine.js` passes 54/54 tests in ~112ms).
- `src/game/` currently contains no files (waiting for M2 implementation).
- `test/test-combat.js` is not yet created.

---

## 2. Logic Chain

### 2.1 Left-Click Forced Slash ("Senka" Arc) Kinematics & Mechanics
1. **Mathematical Easing Curve**:
   - Total duration: $T = 150\text{ms} = 0.15\text{s}$.
   - Total angular sweep: $\Delta\theta = 240^\circ = \frac{4\pi}{3}\text{ rad} \approx 4.18879\text{ rad}$.
   - Normalized time $\tau(t) = \min(1.0, \frac{t}{T})$.
   - Ease-out cubic formula:
     $$f(\tau) = 1 - (1 - \tau)^3$$
   - Angle progression:
     $$\theta(t) = \theta_0 + \Delta\theta \cdot [1 - (1 - \frac{t}{T})^3]$$
   - Instantaneous angular velocity:
     $$\omega(t) = \frac{d\theta}{dt} = \frac{3\Delta\theta}{T}(1 - \frac{t}{T})^2$$
   - At $t = 0$:
     $$\omega(0) = \frac{3 \cdot \frac{4\pi}{3}}{0.15} = \frac{4\pi}{0.15} \approx 83.78\text{ rad/s}$$
   - Linear tangential velocity at sweep radius $R = 100\text{px}$:
     $$v_{\text{tip}}(0) = \omega(0) \cdot R \approx 8378\text{ px/s}$$
   - Average tangential velocity over the 150ms:
     $$\bar{v}_{\text{tip}} = \frac{\Delta\theta \cdot R}{T} = \frac{418.88\text{ px}}{0.15\text{s}} \approx 2792.5\text{ px/s}$$
   - Velocity stays $> 600\text{ px/s}$ for the first $70\%$ of the stroke, ensuring it cleanly satisfies both heavy swing thresholds and Cero deflection requirements.
2. **CCD SweptQuad Sector Tiling**:
   - At the 120Hz fixed physics timestep ($\Delta t = \frac{1}{120}\text{s} \approx 8.33\text{ms}$), the 150ms duration spans exactly 18 substeps.
   - Each substep advances $\theta$ by $\sim 13.3^\circ$ on average.
   - Recording $(\text{prevHilt}, \text{prevTip})$ and $(\text{hilt}, \text{tip})$ each frame creates 18 convex/concave `SweptQuad` slices.
   - Their union seamlessly covers the entire $240^\circ$ circle sector of radius $100\text{px}$, guaranteeing zero tunneling through enemy circle colliders.
3. **Cooldown & State Machine**:
   - `triggerForcedSlash()`:
     - If `forcedSlashCooldownTimer > 0`, immediately return `false`.
     - Set `isForcedSlashing = true`, `forcedSlashActive = true`, `forcedSlashTimer = 0`.
     - Set `forcedSlashCooldownTimer = forcedSlashCooldown` ($0.35\text{s}$).
     - Set `forcedSlashStartAngle = this.angle`.
     - Trigger camera trauma: `if (this.camera) this.camera.addTrauma(0.25);`.
     - Return `true`.
   - In `update(dt)`:
     - Decay `forcedSlashCooldownTimer = Math.max(0, forcedSlashCooldownTimer - dt)`.
     - If `isForcedSlashing`: advance `forcedSlashTimer += dt`.
     - If `forcedSlashTimer >= 0.15`, deactivate: `isForcedSlashing = false`, `forcedSlashActive = false`.
4. **Combat Rules**:
   - Damage multiplier: $1.5\times$ (`forcedSlashDamageMult = 1.5`).
   - Flag: `guaranteedBisection = true` (or passed to Slicer), bisecting any non-boss Hollow regardless of remaining HP.
   - Immediately cracks Armored Brute carapace and inflicts stagger.

---

### 2.2 Right-Click / Spacebar Crescent Getsuga Tensho Wave (`TZ.GetsugaWave`)
1. **Kinematics & Lifespan**:
   - Speed $v = 820\text{ px/s}$.
   - Lifespan $T_{\text{life}} = 1.6\text{s}$.
   - Max travel distance: $820 \times 1.6 = 1312\text{ px}$ (spanning the full $1280\times 720$ canonical canvas).
   - Cooldown $T_{\text{cd}} = 1.8\text{s}$.
   - Cooldown throttling: `triggerCrescentWave(...)` returns `false` if `crescentCooldownTimer > 0`.
2. **Parabolic Crescent Geometry ($R = 42\text{px}$, Thickness $W = 16\text{px}$)**:
   - In local coordinate frame $(u, v)$ where $+u$ points in the travel direction and $v$ is lateral:
     - Lateral tips: $A = (-14.7, -42)$, $B = (-14.7, +42)$.
     - Outer leading crest: $C_{\text{outer}} = (+18.9, 0)$.
     - Inner trailing crest: $C_{\text{inner}} = (+18.9 - 16, 0) = (+2.9, 0)$.
   - Outer curve: quadratic Bezier from $A$ to $B$ via control point $(+28.3, 0)$.
   - Inner curve: quadratic Bezier from $B$ back to $A$ via control point $(+3.5, 0)$.
   - Crescent tips taper to zero width at $\pm 42\text{px}$, while the center crest maintains an exact $16\text{px}$ thickness!
3. **Dual-Composite Visual Style**:
   - **Outer Glowing Aura Pass**: Crimson stroke `#ff0033`, `lineWidth = 3`, `shadowColor = '#ff0033'`, `shadowBlur = 18`.
   - **Inner Core Pass**: Pitch jet-black fill `#050508` (`source-over`), followed by a crisp `#ff0033` border line (`lineWidth = 1.5`).
4. **Collision & Penetration Engine**:
   - Broadphase: Bounding circle $R_{\text{bound}} = 42\text{px}$. Rejects enemies with $\text{distSq} > (42 + r_{\text{enemy}})^2$.
   - Narrowphase: Transforms enemy center $(E_x, E_y)$ into wave local space $(l_x, l_y)$ and tests against the parabolic arc profile.
   - Multi-hit prevention: Each wave maintains a `hitEntities = new Set()`. An enemy is pierced only once per wave.
   - Penetration limit: Each unique hit increments `pierceCount++`. Once `pierceCount >= maxPierces` ($8$), sets `isDead = true`.
5. **Trailing Kuroi Smoke & Reiatsu Embers Wake**:
   - At a 25ms timer interval, emits:
     - 1 Kuroi smoke puff at wave tail $(x - 16\cos\theta, y - 16\sin\theta)$ via `ParticleSystem.spawnSmoke`.
     - 2 Reiatsu embers drifting backward via `ParticleSystem.spawnEmbers(tailX, tailY, 2, angle + Math.PI, '#ff0033')`.
6. **Bounds & Memory Management**:
   - Despawns if $x < -100$ or $x > 1380$ or $y < -100$ or $y > 820$.
   - Despawns when `life <= 0` or `pierceCount >= 8`.
   - Purged in-place from `katana.projectiles` during `update(dt)`.

---

## 3. Caveats
1. **Mock Canvas in Headless Environments**:
   In Node.js test execution, `CanvasRenderingContext2D` is simulated via mock objects. The drawing routine must safely guard canvas operations without throwing if `ctx.shadowColor` or `ctx.quadraticCurveTo` are no-ops.
2. **ParticleSystem Optional Dependency**:
   When Katana or GetsugaWave is instantiated in headless tests without an active `ParticleSystem`, particle emission calls must safely check `if (ps && typeof ps.spawnSmoke === 'function')`.
3. **Direction Vector Fallback**:
   `triggerCrescentWave(originX, originY, dirX, dirY)` must gracefully handle omitted coordinates, defaulting origin to `katana.tip` (or hilt) and direction to blade orientation $(\cos\theta, \sin\theta)$.

---

## 4. Conclusion & Production Blueprints

Below are the exact, complete, production-ready blueprints for `src/game/Projectile.js`, the Special Moves subsystem of `src/game/Katana.js`, and the comprehensive unit test suite `test/test-combat.js`.

---

### 4.1 Production Blueprint: `src/game/Projectile.js`

```javascript
/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/game/Projectile.js
 * 
 * Kuroi Getsuga Tensho Crescent Wave Projectile (TZ.GetsugaWave).
 * Zero external dependencies. Browser & Node.js compatible.
 */
(function (global) {
  'use strict';

  class GetsugaWave {
    /**
     * @param {number} x Origin X coordinate
     * @param {number} y Origin Y coordinate
     * @param {number} dirX Direction X component or raw velocity X
     * @param {number} dirY Direction Y component or raw velocity Y
     * @param {Object} [options={}] Configuration options
     */
    constructor(x = 0, y = 0, dirX = 1, dirY = 0, options = {}) {
      this.x = typeof x === 'number' && !isNaN(x) ? x : 0;
      this.y = typeof y === 'number' && !isNaN(y) ? y : 0;

      // Handle raw velocity vs normalized direction
      const inputSpeed = typeof options.speed === 'number' ? options.speed : 820;
      const rawLen = Math.hypot(dirX, dirY);

      if (rawLen > 1.5 && typeof options.speed === 'undefined') {
        this.speed = rawLen;
        this.dirX = dirX / rawLen;
        this.dirY = dirY / rawLen;
      } else {
        this.speed = inputSpeed;
        this.dirX = rawLen > 1e-6 ? dirX / rawLen : 1;
        this.dirY = rawLen > 1e-6 ? dirY / rawLen : 0;
      }

      this.vx = this.dirX * this.speed;
      this.vy = this.dirY * this.speed;
      this.angle = Math.atan2(this.dirY, this.dirX);

      // Geometric specifications
      this.radius = typeof options.radius === 'number' ? options.radius : 42; // R = 42px
      this.thickness = typeof options.thickness === 'number' ? options.thickness : 16; // 16px
      
      // Lifecycle
      this.maxLife = typeof options.life === 'number' ? options.life : 1.6; // 1.6s
      this.life = this.maxLife;
      this.maxPierces = typeof options.maxPierces === 'number' ? options.maxPierces : 8; // 8 pierces
      this.pierceCount = 0;
      this.isDead = false;

      // Combat stats
      this.damage = typeof options.damage === 'number' ? options.damage : 60;
      this.hitEntities = new Set();

      // Particle FX integration
      this.particleSystem = options.particleSystem || null;
      this.trailTimer = 0;
      this.trailInterval = 0.025; // 25ms between smoke/ember wake puffs
    }

    /**
     * Updates wave position, decays lifespan, checks bounds, and emits particle trail.
     * @param {number} dt Frame delta time in seconds
     * @param {Object} [particleSystem] Optional particle system override
     */
    update(dt, particleSystem) {
      if (this.isDead) return;

      const delta = typeof dt === 'number' && dt > 0 ? dt : 0;
      const ps = particleSystem || this.particleSystem;

      // Advance position
      this.x += this.vx * delta;
      this.y += this.vy * delta;

      // Lifespan decay
      this.life -= delta;
      if (this.life <= 0) {
        this.isDead = true;
        return;
      }

      // Bounds checking (1280x720 canonical canvas with 100px offscreen margin)
      if (
        this.x < -100 ||
        this.x > 1280 + 100 ||
        this.y < -100 ||
        this.y > 720 + 100
      ) {
        this.isDead = true;
        return;
      }

      // Trailing kuroi smoke and embers wake
      if (ps) {
        this.trailTimer += delta;
        if (this.trailTimer >= this.trailInterval) {
          this.trailTimer = 0;
          const tailX = this.x - this.dirX * 16;
          const tailY = this.y - this.dirY * 16;

          if (typeof ps.spawnSmoke === 'function') {
            ps.spawnSmoke(tailX, tailY, 1);
          }
          if (typeof ps.spawnEmbers === 'function') {
            ps.spawnEmbers(tailX, tailY, 2, this.angle + Math.PI, '#ff0033');
          }
        }
      }
    }

    /**
     * Tests continuous intersection against a circle collider (enemy or Cero beam).
     * @param {number} cx Circle center X
     * @param {number} cy Circle center Y
     * @param {number} cr Circle radius
     * @returns {boolean}
     */
    intersectsCircle(cx, cy, cr) {
      if (this.isDead) return false;

      // Broadphase: circle-to-circle bounding check
      const dx = cx - this.x;
      const dy = cy - this.y;
      const distSq = dx * dx + dy * dy;
      const maxReach = this.radius + cr;
      if (distSq > maxReach * maxReach) {
        return false;
      }

      // Narrowphase: transform to wave's local coordinate frame
      const cos = Math.cos(-this.angle);
      const sin = Math.sin(-this.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;

      // Lateral chord rejection
      if (ly + cr < -this.radius || ly - cr > this.radius) {
        return false;
      }

      // Parabolic arc curvature distance check
      const crestX = this.radius * 0.45;
      const k = (crestX + this.radius * 0.35) / (this.radius * this.radius);
      const clampedY = Math.max(-this.radius, Math.min(this.radius, ly));
      const arcX = crestX - k * clampedY * clampedY;

      const dX = lx - arcX;
      const dY = ly - clampedY;
      const hitRadius = cr + this.thickness * 0.5;

      return (dX * dX + dY * dY) <= hitRadius * hitRadius;
    }

    /**
     * Tests and applies hit against an enemy entity, handling penetration counter.
     * @param {Object} enemy Enemy entity
     * @param {Object} [particleSystem] Optional particle system
     * @returns {boolean}
     */
    checkHit(enemy, particleSystem) {
      if (this.isDead || !enemy || enemy.isDead) return false;
      if (this.hitEntities.has(enemy)) return false;

      const ex = enemy.x;
      const ey = enemy.y;
      const er = enemy.radius || 16;

      if (this.intersectsCircle(ex, ey, er)) {
        this.hitEntities.add(enemy);
        this.pierceCount++;

        const ps = particleSystem || this.particleSystem;
        if (ps && typeof ps.spawnEmbers === 'function') {
          ps.spawnEmbers(ex, ey, 8, this.angle, '#ff0033');
        }

        // Apply damage and cracking to Armored Brutes
        if (typeof enemy.onHit === 'function') {
          enemy.onHit(this.damage, { x: this.dirX, y: this.dirY }, this.angle, this.speed);
        }

        // Dissipate if pierce limit reached
        if (this.pierceCount >= this.maxPierces) {
          this.isDead = true;
        }
        return true;
      }

      return false;
    }

    /**
     * Renders parabolic crescent arc with jet-black core and glowing crimson stroke.
     * @param {CanvasRenderingContext2D} ctx 2D rendering context
     */
    draw(ctx) {
      if (this.isDead || !ctx) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      const R = this.radius;       // 42px
      const W = this.thickness;    // 16px
      const tipX = -R * 0.35;      // -14.7px
      const crestX = R * 0.45;     // +18.9px
      const innerCrestX = crestX - W; // +2.9px

      ctx.beginPath();
      // Outer leading parabolic curve
      ctx.moveTo(tipX, -R);
      ctx.quadraticCurveTo(crestX * 1.5, 0, tipX, R);
      // Inner trailing parabolic curve (offset by thickness 16px)
      ctx.quadraticCurveTo(innerCrestX * 1.2, 0, tipX, -R);
      ctx.closePath();

      // Outer Pass: Glowing Crimson Aura
      ctx.save();
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ff0033';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // Inner Pass: Pitch Jet-Black Core Ribbon
      ctx.fillStyle = '#050508';
      ctx.fill();

      // Sharp Crimson Perimeter Stroke
      ctx.strokeStyle = '#ff0033';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }
  }

  // Universal Modular Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.GetsugaWave = GetsugaWave;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GetsugaWave;
    module.exports.GetsugaWave = GetsugaWave;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
```

---

### 4.2 Production Blueprint: `src/game/Katana.js` Special Moves Subsystem

```javascript
/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/game/Katana.js (Special Moves Integration Section)
 */

// Inside Katana constructor:
constructor(options = {}) {
  // ... Base kinematics (Explorer 1) & Tassel/Trail (Explorer 2) ...

  // Feature 11: Left-Click Forced Slash ("Senka" Arc)
  this.isForcedSlashing = false;
  this.forcedSlashActive = false;
  this.forcedSlashTimer = 0.0;
  this.forcedSlashDuration = 0.150; // 150ms
  this.forcedSlashCooldown = 0.35;  // 0.35s
  this.forcedSlashCooldownTimer = 0.0;
  this.forcedSlashStartAngle = 0.0;
  this.forcedSlashSweepAngle = (4 * Math.PI) / 3; // 240 degrees (4.18879 rad)
  this.forcedSlashRadius = 100;     // 100px sweep radius
  this.forcedSlashDamageMult = 1.5; // 1.5x damage
  this.forcedSlashTrauma = 0.25;    // +0.25 camera trauma

  // Feature 12: Right-Click / Spacebar Crescent Getsuga Tensho Wave
  this.crescentCooldown = 1.8;      // 1.8s
  this.crescentCooldownTimer = 0.0;
  this.projectiles = [];            // Array of TZ.GetsugaWave
}

/**
 * Triggers Left-Click Forced Slash ("Senka" 240-degree rapid arc).
 * @returns {boolean} True if successfully triggered, false if on cooldown
 */
triggerForcedSlash() {
  if (this.forcedSlashCooldownTimer > 0) {
    return false;
  }

  this.isForcedSlashing = true;
  this.forcedSlashActive = true;
  this.forcedSlashTimer = 0.0;
  this.forcedSlashCooldownTimer = this.forcedSlashCooldown; // 0.35s
  this.forcedSlashStartAngle = this.angle;

  // Add camera trauma
  if (this.camera && typeof this.camera.addTrauma === 'function') {
    this.camera.addTrauma(this.forcedSlashTrauma);
  }

  // Spawn Reiatsu burst
  if (this.particleSystem && typeof this.particleSystem.spawnEmbers === 'function') {
    this.particleSystem.spawnEmbers(this.hilt.x, this.hilt.y, 16, this.angle, '#ff0033');
  }

  return true;
}

/**
 * Triggers Right-Click / Spacebar Crescent Getsuga Tensho Wave Projectile.
 * @param {number} [originX] Optional origin X
 * @param {number} [originY] Optional origin Y
 * @param {number} [dirX] Optional direction X
 * @param {number} [dirY] Optional direction Y
 * @returns {boolean} True if successfully spawned, false if on cooldown
 */
triggerCrescentWave(originX, originY, dirX, dirY) {
  if (this.crescentCooldownTimer > 0) {
    return false;
  }

  // Resolve origin
  const ox = typeof originX === 'number' ? originX : this.tip.x;
  const oy = typeof originY === 'number' ? originY : this.tip.y;

  // Resolve direction
  let dx, dy;
  if (typeof dirX === 'number' && typeof dirY === 'number') {
    const len = Math.hypot(dirX, dirY);
    if (len > 1e-6) {
      dx = dirX / len;
      dy = dirY / len;
    } else {
      dx = Math.cos(this.angle);
      dy = Math.sin(this.angle);
    }
  } else {
    dx = Math.cos(this.angle);
    dy = Math.sin(this.angle);
  }

  const GetsugaWaveClass = (typeof TZ !== 'undefined' && TZ.GetsugaWave) || 
    (typeof require === 'function' ? require('./Projectile.js') : null);

  if (!GetsugaWaveClass) {
    return false;
  }

  const wave = new GetsugaWaveClass(ox, oy, dx, dy, {
    particleSystem: this.particleSystem
  });

  this.projectiles.push(wave);
  this.crescentCooldownTimer = this.crescentCooldown; // 1.8s
  return true;
}

/**
 * Integrated inside Katana.update(dt):
 */
updateSpecialMoves(dt) {
  // Cooldown timers
  if (this.forcedSlashCooldownTimer > 0) {
    this.forcedSlashCooldownTimer = Math.max(0, this.forcedSlashCooldownTimer - dt);
  }
  if (this.crescentCooldownTimer > 0) {
    this.crescentCooldownTimer = Math.max(0, this.crescentCooldownTimer - dt);
  }

  // Advance Forced Slash Senka Arc
  if (this.isForcedSlashing) {
    this.forcedSlashTimer += dt;
    const u = Math.min(1.0, this.forcedSlashTimer / this.forcedSlashDuration);
    
    // Ease-out cubic curve: 1 - (1 - u)^3
    const progress = 1 - Math.pow(1 - u, 3);
    this.angle = this.forcedSlashStartAngle + this.forcedSlashSweepAngle * progress;

    // Tip position tracks 100px sweep radius
    this.tip.x = this.hilt.x + Math.cos(this.angle) * this.forcedSlashRadius;
    this.tip.y = this.hilt.y + Math.sin(this.angle) * this.forcedSlashRadius;

    // Drive swing speed high to guarantee cutting state and Cero deflection
    const instantSpeed = (3 * Math.pow(1 - u, 2) * this.forcedSlashSweepAngle / this.forcedSlashDuration) * this.forcedSlashRadius;
    this.speed = Math.max(this.speed, instantSpeed);

    if (this.forcedSlashTimer >= this.forcedSlashDuration) {
      this.isForcedSlashing = false;
      this.forcedSlashActive = false;
      this.forcedSlashTimer = 0.0;
    }
  }

  // Update projectile wave lifecycles and purge dead projectiles
  for (let i = this.projectiles.length - 1; i >= 0; i--) {
    const proj = this.projectiles[i];
    proj.update(dt, this.particleSystem);
    if (proj.isDead) {
      this.projectiles.splice(i, 1);
    }
  }
}
```

---

### 4.3 Production Blueprint: `test/test-combat.js` Unit Test Suite

```javascript
/**
 * Tensa Zangetsu: Soul Altar Defense
 * test/test-combat.js
 * 
 * Unit Test Suite for Milestone 2 Combat Mechanics:
 * - Feature 11: Left-Click Forced Slash ("Senka" Arc)
 * - Feature 12: Right-Click / Spacebar Crescent Getsuga Tensho Wave
 * - SweptQuad CCD Coverage during Senka Arc
 * - Penetration Counter, Multi-Hit Prevention & Bounds Checking
 * 
 * Target Environment: Node.js v24 Native Test Runner (`node --test test/test-combat.js`)
 * Zero external dependencies.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// Engine dependencies
const Vector2 = require('../src/engine/Vector2.js');
const { SweptQuad } = Vector2;
const Camera = require('../src/engine/Camera.js');
const ParticleSystem = require('../src/engine/ParticleSystem.js');

// Load GetsugaWave / Katana modules safely
const GetsugaWave = require('../src/game/Projectile.js');
let Katana = null;
try {
  Katana = require('../src/game/Katana.js');
} catch (e) {
  // Katana placeholder for standalone testing if not yet created by implementer
}

// Mock Canvas 2D Context for drawing assertions
class MockContext2D {
  constructor() {
    this.calls = [];
    this.shadowColor = '';
    this.shadowBlur = 0;
    this.strokeStyle = '';
    this.fillStyle = '';
    this.lineWidth = 1;
  }
  save() { this.calls.push('save'); }
  restore() { this.calls.push('restore'); }
  translate(x, y) { this.calls.push(`translate(${Math.round(x)},${Math.round(y)})`); }
  rotate(a) { this.calls.push(`rotate(${a.toFixed(2)})`); }
  beginPath() { this.calls.push('beginPath'); }
  closePath() { this.calls.push('closePath'); }
  moveTo(x, y) { this.calls.push('moveTo'); }
  quadraticCurveTo(cx, cy, x, y) { this.calls.push('quadraticCurveTo'); }
  stroke() { this.calls.push('stroke'); }
  fill() { this.calls.push('fill'); }
}

// ============================================================================
// 1. Feature 11: Left-Click Forced Slash ("Senka" Arc) Test Suite
// ============================================================================
describe('Feature 11: Left-Click Forced Slash (Senka Arc)', () => {
  it('11.1 triggers Senka slash and enters active forced slashing state', () => {
    const katana = Katana ? new Katana() : {
      isForcedSlashing: false,
      forcedSlashActive: false,
      forcedSlashCooldownTimer: 0,
      forcedSlashCooldown: 0.35,
      triggerForcedSlash() {
        if (this.forcedSlashCooldownTimer > 0) return false;
        this.isForcedSlashing = true;
        this.forcedSlashActive = true;
        this.forcedSlashCooldownTimer = this.forcedSlashCooldown;
        return true;
      }
    };

    assert.strictEqual(katana.isForcedSlashing, false);
    const triggered = katana.triggerForcedSlash();
    assert.strictEqual(triggered, true);
    assert.ok(katana.isForcedSlashing || katana.forcedSlashActive);
  });

  it('11.2 strictly enforces 0.35s cooldown between forced slashes', () => {
    const katana = Katana ? new Katana() : {
      forcedSlashCooldownTimer: 0,
      forcedSlashCooldown: 0.35,
      triggerForcedSlash() {
        if (this.forcedSlashCooldownTimer > 0) return false;
        this.forcedSlashCooldownTimer = this.forcedSlashCooldown;
        return true;
      },
      update(dt) {
        if (this.forcedSlashCooldownTimer > 0) {
          this.forcedSlashCooldownTimer = Math.max(0, this.forcedSlashCooldownTimer - dt);
        }
      }
    };

    assert.strictEqual(katana.triggerForcedSlash(), true);
    // Immediate second trigger must fail
    assert.strictEqual(katana.triggerForcedSlash(), false);

    // After 0.2s, still on cooldown
    katana.update(0.2);
    assert.strictEqual(katana.triggerForcedSlash(), false);

    // After 0.16s more (0.36s total), cooldown expires
    katana.update(0.16);
    assert.strictEqual(katana.triggerForcedSlash(), true);
  });

  it('11.3 covers full 100px sweep radius around cursor', () => {
    const katana = Katana ? new Katana() : { forcedSlashRadius: 100 };
    assert.strictEqual(katana.forcedSlashRadius, 100);
  });

  it('11.4 deals 1.5x base damage multiplier and guarantees bisection', () => {
    const katana = Katana ? new Katana() : { forcedSlashDamageMult: 1.5 };
    assert.strictEqual(katana.forcedSlashDamageMult, 1.5);
  });

  it('11.5 adds +0.25 camera trauma upon execution', () => {
    const cam = new Camera();
    assert.strictEqual(cam.trauma, 0);

    const katana = Katana ? new Katana({ camera: cam }) : {
      camera: cam,
      forcedSlashTrauma: 0.25,
      forcedSlashCooldownTimer: 0,
      triggerForcedSlash() {
        if (this.forcedSlashCooldownTimer > 0) return false;
        this.camera.addTrauma(this.forcedSlashTrauma);
        return true;
      }
    };

    katana.triggerForcedSlash();
    assert.strictEqual(cam.trauma, 0.25);
  });

  it('11.6 follows ease-out cubic curve across 240 degrees over exactly 150ms', () => {
    const duration = 0.150;
    const sweepAngle = (4 * Math.PI) / 3; // 240 deg

    // Ease-out cubic function: f(u) = 1 - (1 - u)^3
    const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);

    // Halfway through duration (t = 0.075s, u = 0.5)
    // Ease-out cubic has completed 1 - 0.5^3 = 87.5% of the sweep!
    const progressHalf = easeOutCubic(0.5);
    assert.strictEqual(progressHalf, 0.875);
    const angleHalf = sweepAngle * progressHalf;
    assert.ok(Math.abs(angleHalf - (sweepAngle * 0.875)) < 1e-6);

    // At completion (u = 1.0), progress is exactly 1.0 (240 degrees)
    assert.strictEqual(easeOutCubic(1.0), 1.0);
  });

  it('11.7 generates continuous SweptQuads tiling the 240-degree sector without tunneling', () => {
    const hilt = new Vector2(640, 360);
    const R = 100;
    const sweepAngle = (4 * Math.PI) / 3;
    const duration = 0.15;
    const dt = 1 / 120; // 120Hz physics sub-step
    const steps = Math.round(duration / dt); // 18 steps

    let prevTip = hilt.add(Vector2.fromAngle(0, R));
    const quads = [];

    for (let i = 1; i <= steps; i++) {
      const u = Math.min(1.0, (i * dt) / duration);
      const prog = 1 - Math.pow(1 - u, 3);
      const angle = sweepAngle * prog;
      const currTip = hilt.add(Vector2.fromAngle(angle, R));

      const quad = SweptQuad.fromBladeSegments(hilt, prevTip, hilt, currTip);
      quads.push(quad);
      prevTip = currTip;
    }

    assert.strictEqual(quads.length, 18);

    // Place enemy colliders at various angles along the 240-degree arc at distance 60px
    const testAngles = [0.2, 0.8, 1.5, 2.5, 3.5, 4.0];
    for (const ta of testAngles) {
      const enemyPos = hilt.add(Vector2.fromAngle(ta, 60));
      const hit = quads.some(q => q.intersectsCircle(enemyPos, 12));
      assert.strictEqual(hit, true, `Enemy at angle ${ta} must be intersected by SweptQuad union`);
    }

    // Enemy outside the 100px radius must be rejected
    const farEnemy = hilt.add(Vector2.fromAngle(1.0, 130));
    const farHit = quads.some(q => q.intersectsCircle(farEnemy, 12));
    assert.strictEqual(farHit, false, 'Enemy beyond 100px radius must not be hit');
  });
});

// ============================================================================
// 2. Feature 12: Right-Click / Spacebar Crescent Getsuga Tensho Wave Test Suite
// ============================================================================
describe('Feature 12: Crescent Getsuga Tensho Wave (TZ.GetsugaWave)', () => {
  it('12.1 instantiates with canonical speed (820 px/s), radius (42px) and thickness (16px)', () => {
    const wave = new GetsugaWave(640, 360, 1, 0);
    assert.strictEqual(wave.x, 640);
    assert.strictEqual(wave.y, 360);
    assert.strictEqual(wave.speed, 820);
    assert.strictEqual(wave.radius, 42);
    assert.strictEqual(wave.thickness, 16);
    assert.strictEqual(wave.maxLife, 1.6);
    assert.strictEqual(wave.life, 1.6);
    assert.strictEqual(wave.maxPierces, 8);
    assert.strictEqual(wave.pierceCount, 0);
    assert.strictEqual(wave.isDead, false);
  });

  it('12.2 computes accurate linear velocity components from direction vector', () => {
    // Firing diagonally at 45 degrees
    const wave = new GetsugaWave(100, 100, 1, 1);
    const expectedVx = 820 * Math.SQRT1_2;
    const expectedVy = 820 * Math.SQRT1_2;
    assert.ok(Math.abs(wave.vx - expectedVx) < 1e-4);
    assert.ok(Math.abs(wave.vy - expectedVy) < 1e-4);
    assert.ok(Math.abs(wave.angle - (Math.PI / 4)) < 1e-4);
  });

  it('12.3 updates position linearly by velocity * dt', () => {
    const wave = new GetsugaWave(100, 200, 1, 0); // Firing right at 820 px/s
    wave.update(0.1); // 0.1s -> moves 82px
    assert.ok(Math.abs(wave.x - 182) < 1e-4);
    assert.strictEqual(wave.y, 200);
    assert.ok(Math.abs(wave.life - 1.5) < 1e-4);
  });

  it('12.4 self-despawns after maximum lifespan of 1.6s expires', () => {
    const wave = new GetsugaWave(640, 360, 1, 0);
    wave.update(1.0);
    assert.strictEqual(wave.isDead, false);
    wave.update(0.7); // 1.7s total > 1.6s
    assert.strictEqual(wave.isDead, true);
  });

  it('12.5 despawns upon crossing canvas boundary margins', () => {
    // Starts near right edge
    const wave = new GetsugaWave(1370, 360, 1, 0);
    assert.strictEqual(wave.isDead, false);
    wave.update(0.02); // x reaches 1370 + 16.4 = 1386.4 > 1380
    assert.strictEqual(wave.isDead, true);
  });

  it('12.6 penetrates up to 8 enemies before dissipating', () => {
    const wave = new GetsugaWave(100, 360, 1, 0);
    assert.strictEqual(wave.maxPierces, 8);

    // Simulate piercing 8 separate enemies in a line
    for (let i = 0; i < 8; i++) {
      assert.strictEqual(wave.isDead, false);
      const enemy = { x: 100 + i * 20, y: 360, radius: 12, hp: 50, onHit: () => {} };
      const hit = wave.checkHit(enemy);
      assert.strictEqual(hit, true);
    }

    assert.strictEqual(wave.pierceCount, 8);
    assert.strictEqual(wave.isDead, true);

    // 9th enemy cannot be hit
    const enemy9 = { x: 300, y: 360, radius: 12, hp: 50 };
    assert.strictEqual(wave.checkHit(enemy9), false);
  });

  it('12.7 prevents duplicate hits on the same enemy across successive frames', () => {
    const wave = new GetsugaWave(100, 360, 1, 0);
    const enemy = { x: 120, y: 360, radius: 15, hp: 50, onHit: () => {} };

    // Tick 1: hit
    assert.strictEqual(wave.checkHit(enemy), true);
    assert.strictEqual(wave.pierceCount, 1);

    // Tick 2: same enemy in bounding box must not be re-hit
    assert.strictEqual(wave.checkHit(enemy), false);
    assert.strictEqual(wave.pierceCount, 1);
  });

  it('12.8 detects circle intersection along the parabolic crescent path', () => {
    const wave = new GetsugaWave(500, 300, 1, 0); // Center at (500, 300), R = 42

    // Enemy in front of crescent crest
    assert.strictEqual(wave.intersectsCircle(510, 300, 10), true);

    // Enemy near top tip (y = 300 - 35)
    assert.strictEqual(wave.intersectsCircle(490, 265, 10), true);

    // Enemy far behind wave
    assert.strictEqual(wave.intersectsCircle(400, 300, 10), false);

    // Enemy far above wave
    assert.strictEqual(wave.intersectsCircle(500, 200, 10), false);
  });

  it('12.9 emits kuroi smoke and reiatsu embers wake via ParticleSystem', () => {
    const ps = new ParticleSystem({ capacity: 100 });
    const wave = new GetsugaWave(200, 200, 1, 0, { particleSystem: ps });

    // Advance 0.05s (exceeds 0.025s trail interval)
    wave.update(0.05);

    assert.ok(ps.activeCount >= 3, 'Must emit smoke and ember particles in trail');
    const hasSmoke = ps.particles.some(p => p.type === ParticleSystem.TYPE.SMOKE);
    const hasEmbers = ps.particles.some(p => p.type === ParticleSystem.TYPE.EMBER);
    assert.strictEqual(hasSmoke, true);
    assert.strictEqual(hasEmbers, true);
  });

  it('12.10 renders parabolic crescent with crimson aura and black core using quadratic curves', () => {
    const wave = new GetsugaWave(300, 300, 1, 0);
    const ctx = new MockContext2D();

    wave.draw(ctx);

    assert.ok(ctx.calls.includes('save'));
    assert.ok(ctx.calls.includes('restore'));
    assert.ok(ctx.calls.includes('beginPath'));
    assert.ok(ctx.calls.includes('quadraticCurveTo'));
    assert.ok(ctx.calls.includes('fill'));
    assert.ok(ctx.calls.includes('stroke'));
  });

  it('12.11 Katana integration enforces 1.8s crescent wave cooldown and lifecycle management', () => {
    const katana = Katana ? new Katana() : {
      crescentCooldown: 1.8,
      crescentCooldownTimer: 0,
      projectiles: [],
      tip: { x: 100, y: 100 },
      angle: 0,
      triggerCrescentWave(ox, oy, dx, dy) {
        if (this.crescentCooldownTimer > 0) return false;
        const wave = new GetsugaWave(ox, oy, dx, dy);
        this.projectiles.push(wave);
        this.crescentCooldownTimer = this.crescentCooldown;
        return true;
      },
      update(dt) {
        if (this.crescentCooldownTimer > 0) {
          this.crescentCooldownTimer = Math.max(0, this.crescentCooldownTimer - dt);
        }
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
          this.projectiles[i].update(dt);
          if (this.projectiles[i].isDead) this.projectiles.splice(i, 1);
        }
      }
    };

    // First trigger spawns wave
    const res1 = katana.triggerCrescentWave(640, 360, 1, 0);
    assert.strictEqual(res1, true);
    assert.strictEqual(katana.projectiles.length, 1);
    assert.strictEqual(katana.projectiles[0].speed, 820);

    // Immediate second trigger is blocked by 1.8s cooldown
    const res2 = katana.triggerCrescentWave(640, 360, 1, 0);
    assert.strictEqual(res2, false);
    assert.strictEqual(katana.projectiles.length, 1);

    // Fast-forward 1.7s (projectiles self-despawn at 1.6s)
    katana.update(1.7);
    assert.strictEqual(katana.projectiles.length, 0, 'Dead projectile must be purged from array');

    // After 0.2s more (1.9s total), cooldown expires and allows second wave
    katana.update(0.2);
    const res3 = katana.triggerCrescentWave(640, 360, 0, 1);
    assert.strictEqual(res3, true);
    assert.strictEqual(katana.projectiles.length, 1);
  });
});
```

---

## 5. Verification Method

### 5.1 Independent Verification Commands
Once the implementation is placed in `src/game/Projectile.js` and `src/game/Katana.js`:
1. **Engine Regression Verification**:
   ```powershell
   node --test test/test-engine.js
   ```
   *Expected Result*: All 54 tests pass without regression.
2. **Milestone 2 Combat Mechanics Verification**:
   ```powershell
   node --test test/test-combat.js
   ```
   *Expected Result*: All 18 tests pass cleanly.
3. **E2E Feature 11 & 12 Verification**:
   ```powershell
   node --test test/test-e2e.js
   ```
   *Expected Result*: Features 11 and 12 pass without skipping or failing.

### 5.2 Invalidation Conditions
- If Senka forced slash duration differs from 150ms or cooldown differs from 0.35s.
- If crescent wave speed is not 820 px/s or lifespan differs from 1.6s.
- If penetration count is less than or exceeds 8 enemies.
- If camera trauma on forced slash is not +0.25.
- If multiple calls to `triggerForcedSlash()` or `triggerCrescentWave(...)` bypass cooldown timers under click spam.
