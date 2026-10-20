# Milestone 3 Handoff Report: Menos Grande Gillian Boss AI, Cero Beam & Blade Deflection Clash

**Agent**: Explorer 3 (`explorer_m3_3`)  
**Mission**: Investigate and design complete, drop-in production blueprints for Menos Grande Gillian Boss AI and Cero mechanics in `src/game/Enemy.js` (Features 18 & 19), and specify comprehensive unit tests for `test/test-combat.js`.  
**Target Files**: `src/game/Enemy.js`, `test/test-combat.js`  
**Referenced Files**: `src/game/Katana.js`, `src/game/Projectile.js`, `src/engine/SpriteGen.js`, `src/engine/Vector2.js`, `src/engine/Camera.js`, `src/engine/ParticleSystem.js`, `test/test-e2e.js`  
**Date**: 2026-10-18T16:08:00Z  

---

## 1. Observation

Direct investigation of the project requirements, codebase architecture, and test suites yielded the following facts:

1. **Test Requirements & Assertions in `test/test-e2e.js`**:
   - **Feature 18: Menos Grande Gillian Boss AI** (Lines 1058–1098):
     - Line 1062–1065: `const menos = Enemy.createMenos ? Enemy.createMenos(0, 0) : new Enemy('menos', 0, 0); assert.strictEqual(menos.hp, 550); assert.strictEqual(menos.speed, 18); assert.strictEqual(menos.radius, 45);`
     - Line 1071–1072: `const menos = Enemy.createMenos ? Enemy.createMenos(0, 360) : new Enemy('menos', 0, 360); assert.strictEqual(menos.standoffDist || 280, 280);`
     - Line 1078–1080: `menos.state = 'CHARGE'; assert.ok(menos.chargeDuration === 2.5 || menos.chargeDuration === 2.0 || true);`
     - Line 1087: `assert.strictEqual(menos.ceroDuration || 1.2, 1.2);`
     - Line 1094–1096: `menos.hp = 10; const res = menos.onHit(20, { x: 0, y: 1 }, 0, 500); assert.ok(menos.isDead || res.bisect === true);`
   - **Feature 19: Cero Deflection & Blade Clash** (Lines 1100–1142):
     - Line 1104–1106: `katana.speed = 500; assert.ok(katana.canDeflectCero ? katana.canDeflectCero() : (katana.speed >= 450));`
     - Line 1112–1114: `katana.speed = 400; assert.ok(katana.canDeflectCero ? !katana.canDeflectCero() : (katana.speed < 450));`
     - Line 1117–1120: `Kuroi Getsuga crescent projectile deflects/nullifies Cero beam`
     - Line 1126–1128: `menos.isDeflected = true; assert.strictEqual(menos.getCeroDamage ? menos.getCeroDamage() : (menos.isDeflected ? 0 : 35), 0);`
     - Line 1135–1137: `if (typeof menos.deflectCero === 'function') { menos.deflectCero(); assert.ok(menos.stunTimer >= 1.5); }`
   - **Tier 2 Boundary Tests** (Lines 1717–1732):
     - Line 1722: Swing speed 449 px/s fails to deflect (`katana.canDeflectCero() === false`).
     - Line 1730: Swing speed 450 px/s deflects Cero beam (`katana.canDeflectCero() === true`).
   - **Tier 3 Cross-Feature Integration** (Lines 1861–1885):
     - Line 1872–1884: `menos.state = 'FIRE'; katana.speed = 520; const deflected = katana.speed >= 450; if (deflected) { menos.deflectCero ? menos.deflectCero() : (menos.stunTimer = 1.5); } else { altar.takeDamage(35); } assert.strictEqual(deflected, true); assert.strictEqual(altar.hp, 100); assert.ok(menos.stunTimer >= 1.5);`
   - **Tier 4 Real-World Application Scenario C** (Lines 2006–2035):
     - Line 2020–2034: `menos.state = 'FIRE'; katana.speed = 550; menos.deflectCero(); menos.hp = 0; menos.isDead = true; score.addScore('menos'); assert.strictEqual(deflected, true); assert.strictEqual(altar.hp, 100); assert.ok(score.score >= 1500);`

2. **Existing Combat & Kinematics (`src/game/Katana.js`)**:
   - Line 76: `this.ceroDeflectThreshold = 450.0;`
   - Line 186–188: `canDeflectCero() { return this.isForcedSlashing || this.speed >= this.ceroDeflectThreshold; }`
   - Line 483–490: `getBladeSegment() { return { hilt: this.hilt, tip: this.tip, prevHilt: this.prevHilt, prevTip: this.prevTip }; }`
   - Line 496–502: `getSweptQuad() { return SweptQuad.fromBladeSegments(this.prevHilt, this.prevTip, this.hilt, this.tip); }`
   - Line 122: `this.projectiles = [];` storing active `GetsugaWave` instances.

3. **Existing Sprite Definitions (`src/engine/SpriteGen.js`)**:
   - Lines 441–486: `menos`: 32x32 RotMG sprite with dark robes, white hollow mask, red eye slits, and 1px dark border (`#0a0a0c`).
   - Lines 488–539: `menos_cero`: 32x32 RotMG sprite charging Cero with concentrated crimson/pink Reiatsu core (`#ff0033`, `#ff6b81`) radiating from mouth.
   - Pre-rasterized and cached via `SpriteGen.getSprite('menos', scale)` and `SpriteGen.getSprite('menos_cero', scale)`. At `scale = 3`, rendered dimensions are 96x96px matching the 45px collision radius (90px diameter).

4. **Existing FX & Camera Subsystems**:
   - `Camera.js` (Line 60): `camera.addTrauma(amount)` clamped to `[0.0, 1.0]`. Deflection adds `+0.35`, Cero fire adds `+0.15`, Giant Bisection adds `+0.50`.
   - `ParticleSystem.js` (Lines 146, 181, 209): `spawnEmbers(x, y, count, angle, color, speedScale)`, `spawnSmoke(x, y, count, color)`, `spawnShards(x, y, count)`.

5. **Peer Explorer Alignment**:
   - Explorer 1 (`explorer_m3_1`): Designed `Slicer.js` (clean 2D sprite bisection, `HalfA`/`HalfB` clipping, separation impulse, tumbling, alpha dissolution).
   - Explorer 2 (`explorer_m3_2`): Designed standard swarm types in `src/game/Enemy.js` (`crawler`, `flyer`, `brute`, flocking separation, spiral dive, carapace ricochet).

---

## 2. Logic Chain

1. **State Machine Architecture**:
   - Menos Grande is an imposing artillery boss that controls distance rather than swarming.
   - State transition cycle:
     $$\text{MARCH} \xrightarrow{\text{dist} \le 280\text{px}} \text{CHARGE (2.5s)} \xrightarrow{\text{timer} \le 0} \text{CERO (1.2s)} \xrightarrow{\text{timer} \le 0} \text{MARCH}$$
   - When deflected by blade or crescent wave during CERO:
     $$\text{CERO} \xrightarrow{\text{deflectCero()}} \text{STUNNED (1.5s)} \xrightarrow{\text{timer} \le 0} \text{MARCH}$$
   - The state setter must handle external test transitions safely: setting `state = 'FIRE'` or `'CERO'` must initialize `ceroTimer = 1.2` and reset `isDeflected = false`, while setting `state = 'CHARGE'` initializes `chargeTimer = 2.5`.

2. **Standoff Distance & Kinematics**:
   - Base speed is $18\text{ px/s}$.
   - Standoff distance is strictly $280\text{px}$ from Soul Altar $(640, 360)$.
   - During `MARCH`: the boss marches toward the Altar. If the advance during tick $\Delta t$ ($v \cdot \Delta t$) reaches or crosses $280\text{px}$ ($\text{dist} - v \cdot \Delta t \le 280$), the boss snaps cleanly to exactly $280\text{px}$ along the line of sight, sets $v_x = 0, v_y = 0$, and transitions to `CHARGE`. This prevents overshoot and numerical chatter.

3. **Telegraph Laser & Cero Beam Geometry**:
   - The beam originates from the Menos mouth: $\mathbf{p}_{\text{mouth}} = \mathbf{p}_{\text{boss}} + 24 \cdot (\cos \theta, \sin \theta)$.
   - Direction vector: $\mathbf{d} = (\cos \theta, \sin \theta)$, perpendicular normal: $\mathbf{n} = (-\sin \theta, \cos \theta)$.
   - Beam length: $L = 1600\text{px}$ (crosses the virtual $1280 \times 720$ canvas entirely).
   - Beam width: $W = 48\text{px}$ (half-width $h = 24\text{px}$).
   - Beam-Circle Collision Formula (Altar, Projectiles, Blade sample points):
     For circle center $\mathbf{c} = (c_x, c_y)$ with radius $R$:
     $$\mathbf{v} = \mathbf{c} - \mathbf{p}_{\text{mouth}}$$
     $$\text{proj} = \mathbf{v} \cdot \mathbf{d}$$
     $$\text{perpDist} = |\mathbf{v} \cdot \mathbf{n}|$$
     The circle collides with the beam if and only if:
     $$-R \le \text{proj} \le L + R \quad \text{AND} \quad \text{perpDist} \le h + R$$
   - This exact formula runs in $O(1)$ scalar operations with zero memory allocations.

4. **Blade Deflection Clash Mechanics (Feature 19)**:
   - Blade intersection: Sample 5 points along the Katana blade segment from hilt to tip ($t \in \{0, 0.25, 0.5, 0.75, 1.0\}$) against the beam volume.
   - Deflection condition: `katana.canDeflectCero() === true`, which evaluates `katana.isForcedSlashing || katana.speed >= 450`.
   - On successful clash:
     1. `menos.deflectCero(clashPt, katana)` is executed.
     2. `menos.isDeflected = true;`
     3. `menos.stunTimer = 1.5;`
     4. `menos.state = 'STUNNED';`
     5. `menos.ceroDamage = 0;` (Altar damage nullified: `getCeroDamage() === 0`).
     6. Beam visual bends upward by $45^\circ$ ($\theta_{\text{deflected}} = \theta - \pi/4$).
     7. Camera trauma: `camera.addTrauma(0.35)`.
     8. Particle burst: `ps.spawnEmbers` (30 crimson, 15 white), `ps.spawnShards(8)`, `ps.spawnSmoke(8)`.
     9. Web Audio: `audio.playClash()`.
   - If `katana.speed < 450` and not forced slash: deflection fails; Cero beam continues unhindered.

5. **Getsuga Crescent Wave Nullification (Feature 19.3)**:
   - For every active `GetsugaWave` in `katana.projectiles`:
   - Test projectile circle $(x, y, R = 42)$ against beam volume.
   - Upon collision: `menos.deflectCero()`, the projectile detonates (`projectile.isDead = true`), +0.35 camera trauma, and spiritual explosion.

6. **Boss Defeat & Giant Bisection (Feature 18.5)**:
   - When Menos HP drops to $\le 0$ ($550 \to 0$):
   - `menos.isDead = true; menos.bisected = true;`
   - Massive camera trauma: `camera.addTrauma(0.50)`.
   - Fullscreen flash: `game.triggerFlash(0.85)`.
   - Massive debris explosion: 60 Reiatsu embers, 25 Kuroi smoke puffs, 20 bone mask shards.
   - Slicer bisection: partitions the 96x96px Menos sprite along the cut plane with $140\text{ px/s}$ separation velocity, $\pm 5\text{ rad/s}$ tumbling, and cauterized glowing seam lines.

---

## 3. Caveats

1. **Audio Synthesis Mocking**: In test environments (headless Node.js native test runner), Web Audio API `AudioContext` is mocked. All audio invocations (`playCeroCharge`, `playCeroBlast`, `playClash`, `playHollowDeath`) are guarded by safe null-checks (`if (this.audio && typeof this.audio.playClash === 'function')`).
2. **Integration File Boundary**: Explorer 2 has specified the base `Enemy` class and swarm types in `src/game/Enemy.js`. Our design for Menos Grande is provided as both a clean dedicated `MenosGrande` subclass and as drop-in methods for `Enemy.js` to ensure zero merge frictions.
3. **Canvas Offscreen Rendering**: In browser runtime, `SpriteGen.getSprite('menos', 3)` and `'menos_cero'` supply crisp pre-rasterized 96x96px sprites with 1px dark borders. In headless testing, fallback canvas drawing renders dark hull, white mask, and red eye slits so tests never crash.

---

## 4. Conclusion & Production Blueprint

### Blueprint Part A: `MenosGrande` Class Implementation for `src/game/Enemy.js`

```javascript
/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/game/Enemy.js - Menos Grande Gillian Boss Subsystem (Features 18 & 19)
 */

class MenosGrande {
  /**
   * @param {number} [x=0] Spawn X coordinate
   * @param {number} [y=0] Spawn Y coordinate
   * @param {Object} [options={}] Additional options (camera, particleSystem, audio, game)
   */
  constructor(x = 0, y = 0, options = {}) {
    this.type = 'menos';
    this.isBoss = true;
    this.x = typeof x === 'number' && !Number.isNaN(x) ? x : 0;
    this.y = typeof y === 'number' && !Number.isNaN(y) ? y : 0;
    this.vx = 0;
    this.vy = 0;

    // Feature 18: Canonical Base Stats
    this.hp = 550;
    this.maxHp = 550;
    this.speed = 18;          // 18 px/s slow menacing march
    this.radius = 45;         // 45px collision radius (90px diameter)
    this.standoffDist = 280;   // 280px standoff distance from Altar
    this.altarDamage = 35;    // 35 contact or Cero damage
    this.damage = 35;         // Alias for test compatibility
    this.scoreValue = 1500;   // 1500 score upon defeat

    // State Machine: MARCH -> CHARGE (2.5s) -> CERO (1.2s) -> MARCH
    this._state = 'MARCH';
    this.chargeDuration = 2.5; // 2.5s telegraph laser charge
    this.chargeTimer = 0;
    this.ceroDuration = 1.2;   // 1.2s Cero beam firing
    this.ceroTimer = 0;
    this.ceroWidth = 48;       // 48px beam width (#ff0033 core + #ff6688 glow)
    this.ceroDamage = 35;
    this.ceroDamageDealt = false;
    this.isDeflected = false;
    this.deflectedAngle = 0;
    this.stunDuration = 1.5;   // 1.5s boss stun upon blade deflection
    this.stunTimer = 0;

    // Direction & Aiming
    this.aimAngle = 0;
    this.mouthOffset = 24;     // Mouth offset along aimAngle for laser/beam emission

    // Status flags
    this.isDead = false;
    this.bisected = false;

    // Subsystems
    this.camera = options.camera || null;
    this.particleSystem = options.particleSystem || null;
    this.audio = options.audio || options.audioSynth || null;
    this.game = options.game || null;

    // Sprite scale & size (RotMG 32x32 scaled 3x = 96x96px)
    this.spriteSize = 32;
    this.spriteScale = 3;
    this.spriteKey = 'menos';
  }

  get state() {
    return this._state;
  }

  set state(val) {
    this._state = val;
    if (val === 'CHARGE') {
      if (this.chargeTimer <= 0) this.chargeTimer = this.chargeDuration;
    } else if (val === 'CERO' || val === 'FIRE') {
      if (this.ceroTimer <= 0) this.ceroTimer = this.ceroDuration;
      this.isDeflected = false;
      this.ceroDamageDealt = false;
    } else if (val === 'STUNNED') {
      if (this.stunTimer <= 0) this.stunTimer = this.stunDuration;
    }
  }

  /**
   * Returns Cero beam damage to Altar (0 if deflected, 35 otherwise)
   * @returns {number}
   */
  getCeroDamage() {
    return this.isDeflected ? 0 : this.ceroDamage;
  }

  /**
   * Queries whether Cero beam is actively firing
   * @returns {boolean}
   */
  isCeroActive() {
    return (this._state === 'CERO' || this._state === 'FIRE') && this.ceroTimer > 0;
  }

  /**
   * Queries whether Cero beam is charging
   * @returns {boolean}
   */
  isChargingCero() {
    return this._state === 'CHARGE' && this.chargeTimer > 0;
  }

  /**
   * Deflects Cero beam away from Altar, applies 1.5s stun, camera shake and clashing sparks
   * @param {{x: number, y: number}|null} [clashPoint=null]
   * @param {Object|null} [katana=null]
   */
  deflectCero(clashPoint = null, katana = null) {
    this.isDeflected = true;
    this.stunTimer = this.stunDuration; // 1.5s boss stun
    this.state = 'STUNNED';
    this.ceroDamage = 0;

    // Deflect beam upward by 45 degrees away from Altar
    this.deflectedAngle = this.aimAngle - Math.PI / 4;

    const pt = clashPoint || {
      x: this.x + Math.cos(this.aimAngle) * (this.standoffDist * 0.5),
      y: this.y + Math.sin(this.aimAngle) * (this.standoffDist * 0.5)
    };

    // Camera trauma (+0.35)
    const cam = (katana && katana.camera) || this.camera;
    if (cam && typeof cam.addTrauma === 'function') {
      cam.addTrauma(0.35);
    }

    // Clashing sparks particle bursts
    const ps = (katana && katana.particleSystem) || this.particleSystem;
    if (ps) {
      if (typeof ps.spawnEmbers === 'function') {
        ps.spawnEmbers(pt.x, pt.y, 30, this.aimAngle + Math.PI, '#ff0033', 2.2);
        ps.spawnEmbers(pt.x, pt.y, 15, null, '#ffffff', 1.8);
      }
      if (typeof ps.spawnShards === 'function') {
        ps.spawnShards(pt.x, pt.y, 8);
      }
      if (typeof ps.spawnSmoke === 'function') {
        ps.spawnSmoke(pt.x, pt.y, 8, '#18181b');
      }
    }

    // Web Audio clash sound
    const aud = (katana && (katana.audio || katana.audioSynth)) || this.audio;
    if (aud && typeof aud.playClash === 'function') {
      aud.playClash();
    }
  }

  /**
   * Checks whether a circle (e.g. Altar or projectile) intersects the Cero beam volume
   * @param {number} cx Circle center X
   * @param {number} cy Circle center Y
   * @param {number} rad Circle radius
   * @returns {boolean}
   */
  checkBeamIntersectsCircle(cx, cy, rad) {
    const originX = this.x + Math.cos(this.aimAngle) * this.mouthOffset;
    const originY = this.y + Math.sin(this.aimAngle) * this.mouthOffset;
    const beamAngle = this.isDeflected ? this.deflectedAngle : this.aimAngle;
    const dirX = Math.cos(beamAngle);
    const dirY = Math.sin(beamAngle);
    const beamLength = 1600;
    const halfWidth = this.ceroWidth / 2; // 24px

    const vx = cx - originX;
    const vy = cy - originY;
    const proj = vx * dirX + vy * dirY;

    if (proj < -rad || proj > beamLength + rad) {
      return false;
    }

    const perpDist = Math.abs(vx * (-dirY) + vy * dirX);
    return perpDist <= halfWidth + rad;
  }

  /**
   * Checks whether Katana blade segment intersects Cero beam and executes deflection if speed >= 450 px/s
   * @param {Object} katana Katana instance
   * @returns {boolean} Whether deflection clash occurred
   */
  checkBladeDeflection(katana) {
    if (!this.isCeroActive() || this.isDeflected) return false;
    if (!katana) return false;

    const hilt = katana.hilt || { x: 0, y: 0 };
    const tip = katana.tip || { x: 0, y: 0 };

    let bladeCollided = false;
    let clashPt = { x: (hilt.x + tip.x) / 2, y: (hilt.y + tip.y) / 2 };

    // Sample 5 points along the 85px blade line segment
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const px = hilt.x + t * (tip.x - hilt.x);
      const py = hilt.y + t * (tip.y - hilt.y);
      if (this.checkBeamIntersectsCircle(px, py, 8)) {
        bladeCollided = true;
        clashPt = { x: px, y: py };
        break;
      }
    }

    if (bladeCollided) {
      // Deflect if speed >= 450 px/s or in forced slash ("Senka")
      const canDeflect = typeof katana.canDeflectCero === 'function' 
        ? katana.canDeflectCero() 
        : (katana.isForcedSlashing || (katana.speed >= 450));

      if (canDeflect) {
        this.deflectCero(clashPt, katana);
        return true;
      }
    }

    return false;
  }

  /**
   * Checks whether a Getsuga crescent wave projectile collides with Cero beam and nullifies it
   * @param {Object} projectile GetsugaWave instance
   * @returns {boolean} Whether deflection occurred
   */
  checkProjectileDeflection(projectile) {
    if (!this.isCeroActive() || this.isDeflected) return false;
    if (!projectile || projectile.isDead) return false;

    const rad = typeof projectile.radius === 'number' ? projectile.radius : 42;
    if (this.checkBeamIntersectsCircle(projectile.x, projectile.y, rad)) {
      this.deflectCero({ x: projectile.x, y: projectile.y });
      projectile.isDead = true;
      if (typeof projectile.pierceCount === 'number') {
        projectile.pierceCount = projectile.maxPierces || 8;
      }
      return true;
    }
    return false;
  }

  /**
   * Updates Menos state machine, movement, charging, beam firing, and timers
   * @param {number} dt Delta time in seconds
   * @param {{x: number, y: number}} [altarPos={x: 640, y: 360}] Altar position
   * @param {Object|null} [katana=null] Katana instance
   * @returns {Object|null} Collision or damage event if Altar hit
   */
  update(dt, altarPos = { x: 640, y: 360 }, katana = null) {
    if (this.isDead) return null;

    // Handle stun countdown
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.stunTimer = 0;
        if (this._state === 'STUNNED') {
          this.state = 'MARCH';
        }
      }
      return null;
    }

    const ax = altarPos.x || 640;
    const ay = altarPos.y || 360;
    const dx = ax - this.x;
    const dy = ay - this.y;
    const distToAltar = Math.hypot(dx, dy);

    // Aim toward altar while not locked in active Cero fire
    if (this._state !== 'CERO' && this._state !== 'FIRE') {
      if (distToAltar > 1e-4) {
        this.aimAngle = Math.atan2(dy, dx);
      }
    }

    switch (this._state) {
      case 'MARCH': {
        const moveDist = this.speed * dt;
        if (distToAltar <= this.standoffDist || (distToAltar - moveDist <= this.standoffDist)) {
          // Reached or crossing standoff distance -> snap to 280px and charge Cero
          const nx = dx / distToAltar;
          const ny = dy / distToAltar;
          this.x = ax - nx * this.standoffDist;
          this.y = ay - ny * this.standoffDist;
          this.state = 'CHARGE';
          this.vx = 0;
          this.vy = 0;
          if (this.audio && typeof this.audio.playCeroCharge === 'function') {
            this.audio.playCeroCharge();
          }
        } else {
          // March toward altar
          const nx = dx / distToAltar;
          const ny = dy / distToAltar;
          this.vx = nx * this.speed;
          this.vy = ny * this.speed;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
        }
        break;
      }

      case 'CHARGE': {
        this.vx = 0;
        this.vy = 0;
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0) {
          // Charge complete -> Unleash Cero beam!
          this.state = 'CERO';
          if (this.audio && typeof this.audio.playCeroBlast === 'function') {
            this.audio.playCeroBlast();
          }
          if (this.camera && typeof this.camera.addTrauma === 'function') {
            this.camera.addTrauma(0.15);
          }
        }
        break;
      }

      case 'FIRE':
      case 'CERO': {
        this.vx = 0;
        this.vy = 0;
        this.ceroTimer -= dt;

        // Check deflection against player blade and crescent waves
        if (katana && !this.isDeflected) {
          this.checkBladeDeflection(katana);
          if (katana.projectiles && katana.projectiles.length > 0) {
            for (let i = 0; i < katana.projectiles.length; i++) {
              if (this.checkProjectileDeflection(katana.projectiles[i])) {
                break;
              }
            }
          }
        }

        // Apply damage to Altar if not deflected
        if (!this.isDeflected && !this.ceroDamageDealt) {
          if (this.checkBeamIntersectsCircle(ax, ay, 36)) {
            this.ceroDamageDealt = true;
            return {
              type: 'cero',
              damage: this.getCeroDamage(),
              source: this
            };
          }
        }

        if (this.ceroTimer <= 0) {
          // Cero beam duration ended -> return to MARCH
          this.state = 'MARCH';
          this.isDeflected = false;
          this.ceroDamageDealt = false;
        }
        break;
      }

      case 'STUNNED': {
        break;
      }
    }

    return null;
  }

  /**
   * Handles incoming damage from Katana blade or GetsugaWave
   * @param {number} damage Damage amount
   * @param {{x: number, y: number}} cutNormal Normal perpendicular to cut angle
   * @param {number} cutAngle Cut plane angle in radians
   * @param {number} swingSpeed Blade speed in px/s
   * @param {Object} [options={}] Additional hit options (swingVel, etc.)
   * @returns {Object} Hit result { bisect, dead, damageDealt }
   */
  onHit(damage, cutNormal = { x: 0, y: 1 }, cutAngle = 0, swingSpeed = 500, options = {}) {
    if (this.isDead) {
      return { bisect: false, dead: true, damageDealt: 0 };
    }

    this.hp -= damage;

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.bisected = true;

      // Feature 18.5: Giant bisection upon 0 HP with massive screen flash and trauma (+0.5)
      const cam = options.camera || this.camera;
      if (cam && typeof cam.addTrauma === 'function') {
        cam.addTrauma(0.5);
      }

      if (this.game && typeof this.game.triggerFlash === 'function') {
        this.game.triggerFlash(0.85);
      }

      // Huge spiritual debris explosion
      const ps = options.particleSystem || this.particleSystem;
      if (ps) {
        if (typeof ps.spawnEmbers === 'function') {
          ps.spawnEmbers(this.x, this.y, 60, cutAngle, '#ff0033', 2.5);
          ps.spawnEmbers(this.x, this.y, 30, cutAngle + Math.PI, '#ffffff', 2.0);
        }
        if (typeof ps.spawnSmoke === 'function') {
          ps.spawnSmoke(this.x, this.y, 25, '#18181b');
        }
        if (typeof ps.spawnShards === 'function') {
          ps.spawnShards(this.x, this.y, 20);
        }
      }

      if (this.audio && typeof this.audio.playHollowDeath === 'function') {
        this.audio.playHollowDeath('menos');
      }

      return {
        bisect: true,
        dead: true,
        damageDealt: damage,
        isBoss: true
      };
    }

    return {
      bisect: false,
      dead: false,
      damageDealt: damage,
      isBoss: true
    };
  }

  /**
   * Renders Menos Grande, telegraph laser, Cero beam, and boss HP bar
   * @param {CanvasRenderingContext2D} ctx 
   */
  draw(ctx) {
    if (this.isDead) return;

    let drawX = this.x;
    let drawY = this.y;

    // Apply stagger jitter if stunned
    if (this.stunTimer > 0) {
      drawX += (Math.random() - 0.5) * 4;
      drawY += (Math.random() - 0.5) * 4;
    }

    // 1. Telegraph Laser during CHARGE state
    if (this._state === 'CHARGE' && this.chargeTimer > 0) {
      ctx.save();
      const progress = 1 - (this.chargeTimer / this.chargeDuration);
      const laserWidth = 1.5 + progress * 2.0;
      const alpha = 0.5 + 0.4 * Math.sin(Date.now() * 0.02);
      const originX = drawX + Math.cos(this.aimAngle) * this.mouthOffset;
      const originY = drawY + Math.sin(this.aimAngle) * this.mouthOffset;
      const endX = originX + Math.cos(this.aimAngle) * 1600;
      const endY = originY + Math.sin(this.aimAngle) * 1600;

      ctx.strokeStyle = '#ff0033';
      ctx.globalAlpha = Math.max(0.2, Math.min(1.0, alpha));
      ctx.lineWidth = laserWidth;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Targeting reticle
      ctx.beginPath();
      ctx.arc(originX + Math.cos(this.aimAngle) * 280, originY + Math.sin(this.aimAngle) * 280, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Cero Beam during CERO / FIRE state
    if (this.isCeroActive()) {
      ctx.save();
      const originX = drawX + Math.cos(this.aimAngle) * this.mouthOffset;
      const originY = drawY + Math.sin(this.aimAngle) * this.mouthOffset;
      const beamAngle = this.isDeflected ? this.deflectedAngle : this.aimAngle;
      const endX = originX + Math.cos(beamAngle) * 1600;
      const endY = originY + Math.sin(beamAngle) * 1600;

      // Pass 1: Outer crimson aura (#ff0055, 48px)
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = '#ff0055';
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = this.ceroWidth;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Pass 2: Main crimson beam (#ff0033, 32px)
      ctx.strokeStyle = '#ff0033';
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 32;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Pass 3: Concentrated core (#ff6b81, 16px)
      ctx.strokeStyle = '#ff6b81';
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Pass 4: Razor laser center (#ffffff, 4px)
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.restore();
    }

    // 3. RotMG Boss Sprite with 1px dark outline
    ctx.save();
    let spriteKey = (this._state === 'CHARGE' || this.isCeroActive()) ? 'menos_cero' : 'menos';
    let sprite = null;

    if (typeof window !== 'undefined' && window.TZ && window.TZ.SpriteGen) {
      try {
        sprite = window.TZ.SpriteGen.getSprite(spriteKey, this.spriteScale);
      } catch (e) {}
    }

    const renderSize = this.spriteSize * this.spriteScale; // 96px
    const halfRender = renderSize / 2; // 48px

    if (sprite && typeof ctx.drawImage === 'function') {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, drawX - halfRender, drawY - halfRender, renderSize, renderSize);
    } else {
      // Mock / headless fallback
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(drawX, drawY, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a0a0c';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mask
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(drawX, drawY - 12, 16, 0, Math.PI * 2);
      ctx.fill();

      // Red eye slits / mouth
      ctx.fillStyle = '#ff0033';
      ctx.fillRect(drawX - 6, drawY - 14, 3, 2);
      ctx.fillRect(drawX + 3, drawY - 14, 3, 2);
      if (spriteKey === 'menos_cero') {
        ctx.fillRect(drawX - 4, drawY - 6, 8, 4);
      }
    }

    // 4. Boss Health Bar (width 80px, height 6px)
    const barW = 80;
    const barH = 6;
    const barX = drawX - barW / 2;
    const barY = drawY - this.radius - 14;
    const hpRatio = Math.max(0, Math.min(1.0, this.hp / this.maxHp));

    // Dark background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#27272a';
    ctx.fillRect(barX, barY, barW, barH);

    // Crimson HP fill
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    ctx.restore();
  }
}
```

---

### Blueprint Part B: Unit & Integration Tests to Append to `test/test-combat.js`

```javascript
// ============================================================================
// Feature 18: Menos Grande Gillian Boss AI
// ============================================================================
describe('Feature 18: Menos Grande Gillian Boss AI', () => {
  it('18.1 Base stats: HP 550, Speed 18 px/s, Radius 45px', () => {
    const menos = Enemy.createMenos(0, 0);
    assert.strictEqual(menos.hp, 550);
    assert.strictEqual(menos.speed, 18);
    assert.strictEqual(menos.radius, 45);
    assert.strictEqual(menos.isBoss, true);
  });

  it('18.2 Marches to standoff distance of 280px from Altar', () => {
    const menos = Enemy.createMenos(0, 360);
    assert.strictEqual(menos.standoffDist || 280, 280);
    assert.strictEqual(menos.state, 'MARCH');

    // Advance 1s toward Altar at (640, 360)
    menos.update(1.0, { x: 640, y: 360 });
    assert.strictEqual(menos.x, 18);

    // Position approaching standoff boundary: 640 - 280 = 360
    menos.x = 359;
    menos.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(menos.state, 'CHARGE');
    assert.strictEqual(menos.chargeTimer, 2.5);
  });

  it('18.3 Charges Cero beam for 2.5s with red telegraph targeting laser', () => {
    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CHARGE';
    assert.strictEqual(menos.chargeDuration, 2.5);
    assert.strictEqual(menos.chargeTimer, 2.5);

    menos.update(1.0, { x: 640, y: 360 });
    assert.strictEqual(menos.state, 'CHARGE');
    assert.ok(Math.abs(menos.chargeTimer - 1.5) < 1e-4);

    const ctx = new MockContext2D();
    menos.draw(ctx);
    assert.ok(ctx.calls.includes('save'));
    assert.ok(ctx.calls.includes('stroke'));
  });

  it('18.4 Fires 1.2s Cero beam dealing 35 total damage to Altar', () => {
    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CHARGE';
    menos.chargeTimer = 0.05;

    const cam = new Camera();
    menos.camera = cam;
    menos.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(menos.state, 'CERO');
    assert.strictEqual(menos.ceroDuration, 1.2);
    assert.strictEqual(menos.ceroTimer, 1.2);
    assert.ok(cam.trauma >= 0.15); // +0.15 blast trauma
  });

  it('18.5 Giant bisection upon 0 HP with massive screen flash and trauma', () => {
    const cam = new Camera();
    const ps = new ParticleSystem({ capacity: 200 });
    let flashTriggered = false;
    const game = { triggerFlash: (a) => { flashTriggered = true; } };

    const menos = Enemy.createMenos(360, 360, { camera: cam, particleSystem: ps, game });
    menos.hp = 10;
    const res = menos.onHit(20, { x: 0, y: 1 }, Math.PI / 4, 500);

    assert.strictEqual(menos.isDead, true);
    assert.strictEqual(res.bisect, true);
    assert.strictEqual(res.dead, true);
    assert.strictEqual(menos.hp, 0);
    assert.ok(cam.trauma >= 0.5); // +0.5 giant bisection trauma
    assert.strictEqual(flashTriggered, true);
    assert.ok(ps.activeCount >= 50); // Massive spiritual debris explosion
  });
});

// ============================================================================
// Feature 19: Cero Deflection & Blade Clash
// ============================================================================
describe('Feature 19: Cero Deflection & Blade Clash', () => {
  it('19.1 Blade sweep at speed >= 450 px/s deflects Cero beam', () => {
    const katana = new Katana();
    katana.speed = 500;
    assert.strictEqual(katana.canDeflectCero(), true);

    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CERO';
    menos.aimAngle = 0; // Pointing +X toward Altar at (640, 360)

    katana.hilt = { x: 450, y: 350 };
    katana.tip = { x: 450, y: 370 };

    const deflected = menos.checkBladeDeflection(katana);
    assert.strictEqual(deflected, true);
    assert.strictEqual(menos.isDeflected, true);
    assert.strictEqual(menos.stunTimer, 1.5);
    assert.strictEqual(menos.state, 'STUNNED');
  });

  it('19.2 Blade sweep at speed < 450 px/s fails to deflect Cero beam', () => {
    const katana = new Katana();
    katana.speed = 400;
    assert.strictEqual(katana.canDeflectCero(), false);

    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CERO';
    menos.aimAngle = 0;

    katana.hilt = { x: 450, y: 350 };
    katana.tip = { x: 450, y: 370 };

    const deflected = menos.checkBladeDeflection(katana);
    assert.strictEqual(deflected, false);
    assert.strictEqual(menos.isDeflected, false);
    assert.strictEqual(menos.state, 'CERO');
  });

  it('19.2b Left-Click Forced Slash (Senka arc) deflects Cero beam regardless of manual speed', () => {
    const katana = new Katana();
    katana.speed = 0;
    katana.triggerForcedSlash();
    assert.strictEqual(katana.canDeflectCero(), true);

    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CERO';
    menos.aimAngle = 0;

    katana.hilt = { x: 450, y: 350 };
    katana.tip = { x: 450, y: 370 };

    const deflected = menos.checkBladeDeflection(katana);
    assert.strictEqual(deflected, true);
    assert.strictEqual(menos.isDeflected, true);
    assert.strictEqual(menos.stunTimer, 1.5);
  });

  it('19.3 Kuroi Getsuga crescent projectile deflects/nullifies Cero beam', () => {
    const cam = new Camera();
    const ps = new ParticleSystem({ capacity: 100 });
    const wave = new GetsugaWave(450, 360, -1, 0); // Flying left toward Menos

    const menos = Enemy.createMenos(360, 360, { camera: cam, particleSystem: ps });
    menos.state = 'CERO';
    menos.aimAngle = 0;

    const deflected = menos.checkProjectileDeflection(wave);
    assert.strictEqual(deflected, true);
    assert.strictEqual(menos.isDeflected, true);
    assert.strictEqual(wave.isDead, true);
    assert.ok(cam.trauma >= 0.35); // +0.35 camera trauma
  });

  it('19.4 Cero deflection nullifies all Altar damage during beam duration', () => {
    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CERO';
    assert.strictEqual(menos.getCeroDamage(), 35);

    menos.deflectCero();
    assert.strictEqual(menos.isDeflected, true);
    assert.strictEqual(menos.getCeroDamage(), 0);

    const event = menos.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(event, null); // No damage dispatched to Altar
  });

  it('19.5 Deflection applies 1.5s stun to Menos Grande boss', () => {
    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CERO';
    menos.deflectCero();

    assert.strictEqual(menos.stunTimer, 1.5);
    assert.strictEqual(menos.state, 'STUNNED');

    menos.update(1.0);
    assert.ok(Math.abs(menos.stunTimer - 0.5) < 1e-4);
    assert.strictEqual(menos.state, 'STUNNED');

    menos.update(0.6);
    assert.strictEqual(menos.stunTimer, 0);
    assert.strictEqual(menos.state, 'MARCH'); // Resumes march after stun expires
  });
});
```

---

## 5. Verification Method

1. **Standalone Verification Test Suite**:
   Execute the verification test created in this investigation:
   ```powershell
   node --test .agents/teamwork/explorer_m3_3/verify_menos.js
   ```
   *Expected Result*: 13 tests pass, 0 failures, 0 skipped, duration < 100ms.

2. **Existing Combat Suite Baseline**:
   Ensure existing Milestone 2 combat tests continue to pass without regressions:
   ```powershell
   node --test test/test-combat.js
   ```
   *Expected Result*: 41 tests pass, 0 failures.

3. **E2E Suite Verification**:
   When worker creates `src/game/Enemy.js` containing this blueprint:
   ```powershell
   node --test test/test-e2e.js
   ```
   *Expected Result*: All 10 tests under Feature 18, Feature 19, Test 3.3, and Scenario C unskip and pass 100%.

4. **Invalidation Conditions**:
   - `menos.hp !== 550` or `menos.speed !== 18` or `menos.radius !== 45` or `menos.standoffDist !== 280`.
   - Cero deflection triggers at speeds $< 450\text{ px/s}$ without forced slash.
   - Cero beam continues damaging Soul Altar while `isDeflected === true`.
   - Camera trauma added on deflection is $< 0.35$ or giant bisection trauma is $< 0.50$.
