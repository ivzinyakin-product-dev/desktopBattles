# Milestone 3 Handoff Report: Standard Enemy Swarm Ecosystem (Crawlers, Flyers, Armored Brutes)

**Agent**: Explorer 2 (`explorer_m3_2`)  
**Mission**: Investigate and design complete, drop-in production blueprints for `src/game/Enemy.js` covering standard swarm types (Crawlers, Flyers, Armored Brutes) and unit test specifications for `test/test-combat.js`.  
**Target File**: `src/game/Enemy.js`  
**Test File**: `test/test-combat.js` & `test/test-e2e.js` (Features 15, 16, 17)  
**Date**: 2026-10-18T16:05:00Z  

---

## 1. Observation

Direct investigation of the codebase, engine files, and test suites yielded the following facts:

1. **Test Requirements & Invariants (`test/test-e2e.js`)**:
   - **Feature 15: Hollow Crawler Swarm AI** (Lines 922–966):
     - Line 927–929: `assert.strictEqual(crawler.hp, 25); assert.strictEqual(crawler.speed, 95); assert.strictEqual(crawler.radius, 12);`
     - Line 936–937: `crawler.update(0.1, { x: 640, y: 360 }); assert.ok(crawler.x > 0);`
     - Line 945–948: `c1.applySeparation([c2]); assert.ok(c1.vx < 0);`
     - Line 957: `assert.ok(crawler.skitterPhase !== undefined || crawler.phase !== undefined || true);`
     - Line 964: `assert.strictEqual(crawler.altarDamage || crawler.damage || 8, 8);`
   - **Feature 16: Hollow Flyer Harasser AI** (Lines 968–1011):
     - Line 973–975: `assert.strictEqual(flyer.hp, 20); assert.strictEqual(flyer.speed, 185); assert.strictEqual(flyer.radius, 10);`
     - Line 982: `assert.ok(flyer.state !== undefined || flyer.mode !== undefined || true);`
     - Line 989–990: `flyer.update(0.1, { x: 640, y: 360 }); assert.ok(flyer.diveSpeed === 270 || flyer.speed >= 185);`
     - Line 998–999: `flyer.evadeBlade({ x: 120, y: 100 }, 400); assert.ok(flyer.isEvading || flyer.evadeTimer > 0);`
     - Line 1009: `assert.strictEqual(flyer.altarDamage || flyer.damage || 12, 12);`
   - **Feature 17: Armored Brute Vanguard AI** (Lines 1013–1056):
     - Line 1018–1020: `assert.strictEqual(brute.hp, 90); assert.strictEqual(brute.speed, 48); assert.strictEqual(brute.radius, 20);`
     - Line 1027–1029: `const res = brute.onHit(25, { x: 0, y: 1 }, 0, 450); assert.strictEqual(brute.armorBroken, false); assert.ok(brute.hp === 75 || res.ricochet === true);`
     - Line 1036–1037: `brute.onHit(50, { x: 0, y: 1 }, 0, 750); assert.strictEqual(brute.armorBroken, true);`
     - Line 1044–1045: `brute.onHit(50, { x: 0, y: 1 }, 0, 750); assert.ok(brute.stunTimer >= 1.0);`
     - Line 1052–1054: `brute.armorBroken = true; const res = brute.onHit(50, { x: 0, y: 1 }, 0, 500); assert.ok(res.bisect === true || brute.isDead);`
   - **Boundary Conditions (`test/test-e2e.js` Lines 1701–1715)**:
     - Line 1705–1706: `brute.onHit(25, { x: 0, y: 1 }, 0, 599); assert.strictEqual(brute.armorBroken, false);`
     - Line 1713–1714: `brute.onHit(25, { x: 0, y: 1 }, 0, 600); assert.strictEqual(brute.armorBroken, true);`
   - **Cross-Feature Combat Combinations (`test/test-e2e.js` Lines 1887–1908)**:
     - Line 1897: Hit 1 (speed 400 < 600) ricochets, `armorBroken = false`.
     - Line 1902: Hit 2 (speed 700 >= 600) cracks carapace, `armorBroken = true`.
     - Line 1906: Hit 3 (speed 500 on broken armor) bisects, `res.bisect = true || brute.isDead`.

2. **Existing Sprite Definitions (`src/engine/SpriteGen.js`)**:
   - `crawler`: 16x16 pixel matrix with RotMG dark outline (Lines 261–290).
   - `crawler_walk`: 16x16 alternate walk cycle frame (Lines 293–322).
   - `flyer_0`: 16x16 wings-up frame (Lines 325–355).
   - `flyer_1`: 16x16 wings-down frame (Lines 358–388).
   - `brute`: 32x32 heavily armored vanguard with horns and carapace (Lines 391–439).
   - Helper methods: `SpriteGen.getSprite(name, scale)` and `SpriteGen.getCrawlerSprite(scale)`.

3. **Existing Combat & Kinematics (`src/game/Katana.js`)**:
   - `getBladeSegment()`: returns `{ hilt, tip, prevHilt, prevTip }`.
   - `getSweptQuad()`: returns `SweptQuad` continuous collision detection volume.
   - `isSlashing()`: true when mouse speed $\ge 280\text{ px/s}$ or Senka is active.
   - `canDeflectCero()`: true when mouse speed $\ge 450\text{ px/s}$ or Senka is active.
   - `projectiles`: array of `GetsugaWave` instances.

4. **Existing FX Engine (`src/engine/ParticleSystem.js`)**:
   - `spawnEmbers(x, y, count, angle, color)`: Reiatsu embers.
   - `spawnSmoke(x, y, count, color)`: Kuroi dark spiritual smoke.
   - `spawnShards(x, y, count, angle)`: Mask bone fragments with bounce physics.

---

## 2. Logic Chain

1. **Unified Archetype Architecture**:
   - The test suite allows either factory methods (`Enemy.createCrawler`, `Enemy.createFlyer`, `Enemy.createBrute`, `Enemy.createMenos`) or direct instantiation (`new Enemy('crawler', x, y)`). A single canonical `class Enemy` with static factory helpers provides 100% polymorphic behavior while avoiding redundant class boilerplate.
   - In addition, providing `Enemy.createMenos(x, y)` inside `Enemy.js` ensures seamless coexistence with Explorer 3's Menos Grande boss AI.

2. **Crawler Swarm AI (Feature 15)**:
   - **Steering toward Altar**: From $(x, y)$ to $(A_x, A_y)$, unit direction is $\hat{u} = \frac{(A_x - x, A_y - y)}{\sqrt{(A_x - x)^2 + (A_y - y)^2}}$.
   - **Sinusoidal Skitter Gait**: Perpendicular lateral unit vector is $\hat{p} = (-u_y, u_x)$. The skittering noise $v_{lat} = \hat{p} \cdot (\sin(\text{skitterPhase}) \cdot A_{skitter})$ is superimposed onto forward velocity, producing the characteristic organic insectoid skitter.
   - **Flocking Separation**: When `applySeparation(neighbors)` is invoked, for each neighbor $N$ within separation radius $R_{sep} \approx 30\text{px}$, a repulsive force $\vec{F}_{rep} = \frac{\vec{x} - \vec{x}_N}{\|\vec{x} - \vec{x}_N\|} \cdot (1 - \frac{d}{R_{sep}}) \cdot F_{strength}$ is directly accumulated into $(v_x, v_y)$. For $c_1(100, 100)$ and $c_2(105, 100)$, $dx = -5$, creating an immediate negative impulse $v_x < 0$ satisfying test 15.3.

3. **Flyer Harasser AI (Feature 16)**:
   - **Logarithmic Spiral Approach**: In polar coordinates centered on Altar $(A_x, A_y)$, radius $r = \sqrt{dx^2 + dy^2}$, $\theta = \text{atan2}(dy, dx)$. Velocity has an inward radial component $v_r = -115\text{ px/s}$ and an orbital tangential component $v_\theta = \pm 145\text{ px/s}$, giving a net speed of $\sqrt{115^2 + 145^2} \approx 185\text{ px/s}$.
   - **Dive Acceleration**: When radial distance drops below $180\text{ px}$, state transitions to `'DIVE'`. Flyer locks onto Altar center and surges forward at `diveSpeed = 270 px/s`.
   - **Reactive Evasion**: When `evadeBlade(bladeTip, bladeSpeed)` is called with $d < 95\text{ px}$ and $v_{blade} \ge 250\text{ px/s}$, `isEvading` is set to `true` with `evadeTimer = 0.22s`. A strong lateral impulse (perpendicular to blade vector) deflects the flyer sideways away from the blade path, evading incoming cuts.

4. **Armored Brute Vanguard AI (Feature 17)**:
   - **Armor Ricochet (Hit Speed $< 600\text{ px/s}$)**:
     When $v_{swing} < 600$ and armor is intact (`!armorBroken`), frontal carapace ricochets the katana. Armor absorbs the impact: `armorBroken` remains `false`, brute sustains exactly $15$ chip damage ($90 \to 75$), `res.ricochet = true`, metallic clash sound (`audioSynth.playClash()`) triggers, and bright white sparks emit.
   - **Armor Crack (Hit Speed $\ge 600\text{ px/s}$ or Getsuga / Senka)**:
     When $v_{swing} \ge 600$ (or Getsuga projectile or forced Senka slash), the kinetic shock cracks the carapace: `armorBroken = true`, `stunTimer = 1.2s` (stagger stun halts brute movement), and bone shard particles burst outward.
   - **Subsequent Slash Clean Bisection**:
     Once `armorBroken === true`, any subsequent slash penetrates the unarmored fleshy core, immediately triggering clean bisection: `res.bisect = true`, `isDead = true`, yielding debris halves for `Slicer`.

---

## 3. Caveats

1. **Menos Grande Gillian Boss**: Explorer 3 is authoring the Cero beam deflection mechanics and Gillian AI. The `Enemy` blueprint below includes the canonical `createMenos` factory and standard attributes so that Explorer 3's boss implementation merges cleanly into `Enemy.js` without refactoring.
2. **Slicer Integration**: When an enemy is bisected, `Enemy` marks `isDead = true` and returns `{ bisect: true }`. The actual generation of debris halves is executed by `Slicer.sliceEnemy(enemy, cutPoint, cutAngle, swingSpeed, swingVel)` designed by Explorer 1.

---

## 4. Conclusion & Production Blueprints

### 4.1 Production Blueprint: `src/game/Enemy.js`

Here is the complete, drop-in, zero-dependency source code for `src/game/Enemy.js`:

```javascript
/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/game/Enemy.js
 * 
 * Standard Enemy Swarm Ecosystem & Boss AI:
 * - Feature 15: Hollow Crawler Swarm AI (skittering gait noise, flocking separation, 1-hit cut)
 * - Feature 16: Hollow Flyer Harasser AI (logarithmic spiral approach, 270 px/s dive, blade evasion)
 * - Feature 17: Armored Brute Vanguard AI (carapace ricochet < 600 px/s, crack >= 600 px/s, 1.2s stun, bisection)
 * - Feature 18 & 19: Menos Grande Gillian Boss AI foundation & Cero state hooks
 * 
 * Universal Modular Pattern (Browser window.TZ & Node.js CommonJS).
 * Zero external dependencies.
 */
(function (global) {
  'use strict';

  // Defensive dependency acquisition
  const Vector2 = (global.TZ && global.TZ.Vector2) || 
    (typeof require === 'function' ? (function () { try { return require('../engine/Vector2.js'); } catch (e) { return null; } })() : null);
  const SpriteGen = (global.TZ && global.TZ.SpriteGen) || 
    (typeof require === 'function' ? (function () { try { return require('../engine/SpriteGen.js'); } catch (e) { return null; } })() : null);

  const ENEMY_TYPES = {
    CRAWLER: 'crawler',
    FLYER: 'flyer',
    BRUTE: 'brute',
    MENOS: 'menos'
  };

  const ENEMY_CONFIGS = {
    crawler: {
      hp: 25,
      speed: 95,
      radius: 12,
      altarDamage: 8,
      scoreValue: 100,
      spriteKey: 'crawler',
      walkSpriteKey: 'crawler_walk',
      spriteSize: 16
    },
    flyer: {
      hp: 20,
      speed: 185,
      diveSpeed: 270,
      diveThreshold: 180,
      radius: 10,
      altarDamage: 12,
      scoreValue: 150,
      spriteKey: 'flyer_0',
      flapSpriteKey: 'flyer_1',
      spriteSize: 16
    },
    brute: {
      hp: 90,
      speed: 48,
      radius: 20,
      altarDamage: 25,
      scoreValue: 300,
      ricochetSpeedThreshold: 600,
      chipDamage: 15,
      spriteKey: 'brute',
      spriteSize: 32
    },
    menos: {
      hp: 550,
      speed: 18,
      radius: 45,
      altarDamage: 35,
      standoffDist: 280,
      chargeDuration: 2.5,
      ceroDuration: 1.2,
      scoreValue: 1500,
      spriteKey: 'menos',
      spriteSize: 32
    }
  };

  class Enemy {
    /**
     * @param {string} type - 'crawler' | 'flyer' | 'brute' | 'menos'
     * @param {number} [x=0] - World X spawn coordinate
     * @param {number} [y=0] - World Y spawn coordinate
     * @param {Object} [options={}] - Additional options (particleSystem, audioSynth, camera, etc.)
     */
    constructor(type = 'crawler', x = 0, y = 0, options = {}) {
      this.type = type.toLowerCase();
      const cfg = ENEMY_CONFIGS[this.type] || ENEMY_CONFIGS.crawler;

      // Position & Spatial Orientation
      this.x = Number.isFinite(x) ? x : 0;
      this.y = Number.isFinite(y) ? y : 0;
      this.vx = 0;
      this.vy = 0;
      this.angle = 0;

      // Hitbox & Physical Dimensions
      this.radius = cfg.radius;
      this.spriteSize = cfg.spriteSize || 16;
      this.spriteKey = cfg.spriteKey;

      // Health & Combat Metrics
      this.hp = cfg.hp;
      this.maxHp = cfg.hp;
      this.speed = cfg.speed;
      this.baseSpeed = cfg.speed;
      this.altarDamage = cfg.altarDamage;
      this.damage = cfg.altarDamage; // Test alias compatibility
      this.scoreValue = cfg.scoreValue;
      this.isDead = false;

      // Status Timers & FX
      this.stunTimer = 0;
      this.hitFlashTimer = 0;
      this.animTimer = 0;
      this.animFrame = 0;

      // Optional Subsystems
      this.particleSystem = options.particleSystem || (global.TZ && global.TZ.defaultParticleSystem) || null;
      this.audioSynth = options.audioSynth || (global.TZ && global.TZ.defaultAudioSynth) || null;
      this.camera = options.camera || null;

      // Type-Specific Initializations
      if (this.type === ENEMY_TYPES.CRAWLER) {
        // Feature 15: Sinusoidal skittering noise
        this.skitterPhase = (typeof options.skitterPhase === 'number') 
          ? options.skitterPhase 
          : Math.random() * Math.PI * 2;
        this.phase = this.skitterPhase; // Alias for test 15.4
        this.skitterFreq = 7.5; // rad/s
        this.skitterAmp = 28.0; // px/s lateral oscillation
        this.walkSpriteKey = cfg.walkSpriteKey;
      } else if (this.type === ENEMY_TYPES.FLYER) {
        // Feature 16: Logarithmic spiral & dive harasser
        this.diveSpeed = cfg.diveSpeed || 270;
        this.diveThreshold = cfg.diveThreshold || 180;
        this.state = 'SPIRAL';
        this.mode = 'SPIRAL'; // Alias for test 16.2
        this.orbitDir = (typeof options.orbitDir === 'number') ? options.orbitDir : (Math.random() < 0.5 ? 1 : -1);
        this.isEvading = false;
        this.evadeTimer = 0;
        this.evadeCooldown = 0;
        this.flapSpriteKey = cfg.flapSpriteKey;
      } else if (this.type === ENEMY_TYPES.BRUTE) {
        // Feature 17: Frontal carapace armor vanguard
        this.armorBroken = false;
        this.ricochetSpeedThreshold = cfg.ricochetSpeedThreshold || 600;
        this.chipDamage = cfg.chipDamage || 15;
      } else if (this.type === ENEMY_TYPES.MENOS) {
        // Feature 18 & 19: Gillian Boss
        this.standoffDist = cfg.standoffDist || 280;
        this.chargeDuration = cfg.chargeDuration || 2.5;
        this.ceroDuration = cfg.ceroDuration || 1.2;
        this.state = 'MARCH';
        this.mode = 'MARCH';
        this.stateTimer = 0;
        this.isDeflected = false;
      }
    }

    // Static Factory Helpers
    static createCrawler(x, y, options) {
      return new Enemy(ENEMY_TYPES.CRAWLER, x, y, options);
    }

    static createFlyer(x, y, options) {
      return new Enemy(ENEMY_TYPES.FLYER, x, y, options);
    }

    static createBrute(x, y, options) {
      return new Enemy(ENEMY_TYPES.BRUTE, x, y, options);
    }

    static createMenos(x, y, options) {
      return new Enemy(ENEMY_TYPES.MENOS, x, y, options);
    }

    static get TYPES() {
      return ENEMY_TYPES;
    }

    static get CONFIGS() {
      return ENEMY_CONFIGS;
    }

    /**
     * Feature 15: Flocking separation repulsion against neighboring swarm entities.
     * Pushes this enemy away from nearby neighbors within separation radius.
     * @param {Enemy[]} neighbors 
     * @param {number} [sepRadius=32] 
     * @param {number} [sepForce=120] 
     * @returns {{pushX: number, pushY: number}}
     */
    applySeparation(neighbors, sepRadius = 32, sepForce = 120) {
      if (!Array.isArray(neighbors) || neighbors.length === 0) {
        return { pushX: 0, pushY: 0 };
      }

      let pushX = 0;
      let pushY = 0;

      for (let i = 0; i < neighbors.length; i++) {
        const other = neighbors[i];
        if (!other || other === this || other.isDead) continue;

        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < sepRadius * sepRadius && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const factor = (1.0 - dist / sepRadius) * sepForce;
          pushX += (dx / dist) * factor;
          pushY += (dy / dist) * factor;
        }
      }

      this.vx += pushX;
      this.vy += pushY;
      return { pushX, pushY };
    }

    /**
     * Feature 16: Reactive evasive lateral twitch when blade approaches at high speed.
     * @param {{x: number, y: number}} bladeTip 
     * @param {number} [bladeSpeed=0] 
     * @returns {boolean}
     */
    evadeBlade(bladeTip, bladeSpeed = 0) {
      if (!bladeTip || typeof bladeTip.x !== 'number' || typeof bladeTip.y !== 'number') {
        return false;
      }
      if (this.evadeCooldown > 0) return false;

      const threatRadius = 95;
      const dx = this.x - bladeTip.x;
      const dy = this.y - bladeTip.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < threatRadius * threatRadius) {
        this.isEvading = true;
        this.evadeTimer = 0.22; // 220ms evasive dodge
        this.evadeCooldown = 0.65; // 650ms cooldown between dodges

        const dist = Math.sqrt(distSq) || 1.0;
        const awayX = dx / dist;
        const awayY = dy / dist;

        // Apply sudden lateral dodge impulse perpendicular to threat vector
        const latSign = (Math.random() < 0.5 ? 1 : -1);
        const latX = -awayY * latSign;
        const latY = awayX * latSign;

        this.vx += (awayX * 180 + latX * 220);
        this.vy += (awayY * 180 + latY * 220);

        if (this.particleSystem && typeof this.particleSystem.spawnSmoke === 'function') {
          this.particleSystem.spawnSmoke(this.x, this.y, 3);
        }
        return true;
      }
      return false;
    }

    /**
     * Feature 17 & Combat: Slash hit resolution.
     * Handles carapace ricochet, armor breaking, and bisection.
     * @param {number} [damage=25] 
     * @param {{x: number, y: number}} [cutNormal={x:0, y:1}] 
     * @param {number} [cutAngle=0] 
     * @param {number} [swingSpeed=500] 
     * @param {Object} [options={}] 
     * @returns {{ricochet: boolean, cracked: boolean, bisect: boolean, damage: number, armorBroken?: boolean, hp: number}}
     */
    onHit(damage = 25, cutNormal = { x: 0, y: 1 }, cutAngle = 0, swingSpeed = 500, options = {}) {
      if (this.isDead) {
        return { ricochet: false, cracked: false, bisect: false, damage: 0, hp: 0 };
      }

      // 1. Armored Brute Vanguard Specific Armor Mechanics (Feature 17)
      if (this.type === ENEMY_TYPES.BRUTE) {
        if (!this.armorBroken) {
          // Ricochet Check: Swing speed strictly below 600 px/s ricochets (armor intact)
          if (swingSpeed < this.ricochetSpeedThreshold && !options.isGetsugaWave && !options.isForcedSlash) {
            this.hp -= this.chipDamage;
            this.hitFlashTimer = 0.08;

            if (this.audioSynth && typeof this.audioSynth.playClash === 'function') {
              this.audioSynth.playClash();
            }
            if (this.particleSystem && typeof this.particleSystem.spawnEmbers === 'function') {
              this.particleSystem.spawnEmbers(this.x, this.y, 8, cutAngle, '#ffffff');
            }

            return {
              ricochet: true,
              cracked: false,
              bisect: false,
              damage: this.chipDamage,
              armorBroken: false,
              hp: this.hp
            };
          } else {
            // Heavy Hit (>= 600 px/s or Getsuga Wave or Senka forced slash): Cracks carapace!
            this.armorBroken = true;
            this.stunTimer = 1.2; // 1.2s stagger stun
            this.hp -= damage;
            this.hitFlashTimer = 0.15;

            if (this.audioSynth && typeof this.audioSynth.playClash === 'function') {
              this.audioSynth.playClash();
            }
            if (this.particleSystem && typeof this.particleSystem.spawnShards === 'function') {
              this.particleSystem.spawnShards(this.x, this.y, 10, cutAngle);
              this.particleSystem.spawnSmoke(this.x, this.y, 6);
            }

            if (this.hp <= 0) {
              this.isDead = true;
              return {
                ricochet: false,
                cracked: true,
                bisect: true,
                damage: damage,
                armorBroken: true,
                hp: this.hp
              };
            }

            return {
              ricochet: false,
              cracked: true,
              bisect: false,
              damage: damage,
              armorBroken: true,
              hp: this.hp
            };
          }
        } else {
          // Armor is already broken: Subsequent slash triggers clean bisection!
          this.hp -= damage;
          this.isDead = true;
          this.hitFlashTimer = 0.12;

          if (this.particleSystem && typeof this.particleSystem.spawnEmbers === 'function') {
            this.particleSystem.spawnEmbers(this.x, this.y, 12, cutAngle, '#ff0033');
            this.particleSystem.spawnShards(this.x, this.y, 6);
          }

          return {
            ricochet: false,
            cracked: false,
            bisect: true,
            damage: damage,
            armorBroken: true,
            hp: this.hp
          };
        }
      }

      // 2. Menos Grande Boss Hit Resolution (Feature 18)
      if (this.type === ENEMY_TYPES.MENOS) {
        this.hp -= damage;
        this.hitFlashTimer = 0.12;

        if (this.particleSystem && typeof this.particleSystem.spawnEmbers === 'function') {
          this.particleSystem.spawnEmbers(this.x, this.y, 14, cutAngle, '#ff0033');
        }

        if (this.hp <= 0) {
          this.isDead = true;
          return {
            ricochet: false,
            cracked: false,
            bisect: true,
            damage: damage,
            hp: this.hp
          };
        }

        return {
          ricochet: false,
          cracked: false,
          bisect: false,
          damage: damage,
          hp: this.hp
        };
      }

      // 3. Standard Swarm Types (Crawler & Flyer): 1-Hit Clean Cut / Bisection
      this.hp -= damage;
      this.isDead = true;
      this.hitFlashTimer = 0.10;

      if (this.particleSystem && typeof this.particleSystem.spawnEmbers === 'function') {
        this.particleSystem.spawnEmbers(this.x, this.y, 10, cutAngle, '#ff0033');
        this.particleSystem.spawnShards(this.x, this.y, 4);
      }

      return {
        ricochet: false,
        cracked: false,
        bisect: true,
        damage: damage,
        hp: this.hp
      };
    }

    /**
     * Menos Cero Deflection hook (Feature 19 compatibility).
     */
    deflectCero() {
      this.isDeflected = true;
      this.stunTimer = 1.5;
    }

    /**
     * Retrieves Cero beam damage delivered to Altar (Feature 19 compatibility).
     * @returns {number}
     */
    getCeroDamage() {
      if (this.isDeflected) return 0;
      return (this.state === 'CERO' || this.state === 'FIRE') ? 35 : 0;
    }

    /**
     * Main Physics & AI Step.
     * @param {number} dt Delta time in seconds
     * @param {{x: number, y: number, radius?: number}} [altarPos={x:640, y:360, radius:36}] 
     * @param {Object|null} [katana=null] Player katana instance for evasion / deflection
     * @returns {Object|null} Collision event with Altar if breached, else null
     */
    update(dt, altarPos = { x: 640, y: 360, radius: 36 }, katana = null) {
      if (this.isDead) return null;

      const ax = (altarPos && typeof altarPos.x === 'number') ? altarPos.x : 640;
      const ay = (altarPos && typeof altarPos.y === 'number') ? altarPos.y : 360;
      const ar = (altarPos && typeof altarPos.radius === 'number') ? altarPos.radius : 36;

      // Decrement timers
      if (this.hitFlashTimer > 0) {
        this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
      }
      if (this.evadeCooldown > 0) {
        this.evadeCooldown = Math.max(0, this.evadeCooldown - dt);
      }
      if (this.evadeTimer > 0) {
        this.evadeTimer = Math.max(0, this.evadeTimer - dt);
        if (this.evadeTimer === 0) {
          this.isEvading = false;
        }
      }

      // Handle Stagger / Stun (e.g. Brute armor cracked)
      if (this.stunTimer > 0) {
        this.stunTimer = Math.max(0, this.stunTimer - dt);
        this.vx = 0;
        this.vy = 0;
        return null;
      }

      // Check reactive evasion for flyers against approaching katana blade
      if (this.type === ENEMY_TYPES.FLYER && katana && katana.tip && katana.speed >= 250) {
        this.evadeBlade(katana.tip, katana.speed);
      }

      // Execute Archetype AI Steering
      switch (this.type) {
        case ENEMY_TYPES.CRAWLER: {
          // Feature 15: Skittering gait noise steering toward Altar
          this.skitterPhase += dt * this.skitterFreq;
          this.phase = this.skitterPhase;

          const dx = ax - this.x;
          const dy = ay - this.y;
          const dist = Math.hypot(dx, dy) || 1.0;

          const uX = dx / dist;
          const uY = dy / dist;
          const pX = -uY;
          const pY = uX;

          const lateralNoise = Math.sin(this.skitterPhase) * this.skitterAmp;
          this.vx = uX * this.speed + pX * lateralNoise;
          this.vy = uY * this.speed + pY * lateralNoise;
          break;
        }

        case ENEMY_TYPES.FLYER: {
          // Feature 16: Logarithmic spiral & high-speed dive
          const dx = this.x - ax;
          const dy = this.y - ay;
          const r = Math.hypot(dx, dy) || 1.0;

          if (r < this.diveThreshold) {
            // Close range dive (r < 180px)
            this.state = 'DIVE';
            this.mode = 'DIVE';
            this.speed = this.diveSpeed;

            const toAx = ax - this.x;
            const toAy = ay - this.y;
            const toDist = Math.hypot(toAx, toAy) || 1.0;

            this.vx = (toAx / toDist) * this.diveSpeed;
            this.vy = (toAy / toDist) * this.diveSpeed;
          } else if (!this.isEvading) {
            // Logarithmic spiral approach
            this.state = 'SPIRAL';
            this.mode = 'SPIRAL';
            this.speed = this.baseSpeed;

            const theta = Math.atan2(dy, dx);
            const vRadial = -this.speed * 0.62;
            const vTangential = this.speed * 0.78 * this.orbitDir;

            this.vx = Math.cos(theta) * vRadial - Math.sin(theta) * vTangential;
            this.vy = Math.sin(theta) * vRadial + Math.cos(theta) * vTangential;
          }
          break;
        }

        case ENEMY_TYPES.BRUTE: {
          // Feature 17: Relentless direct march toward Altar
          const dx = ax - this.x;
          const dy = ay - this.y;
          const dist = Math.hypot(dx, dy) || 1.0;

          this.vx = (dx / dist) * this.speed;
          this.vy = (dy / dist) * this.speed;
          break;
        }

        case ENEMY_TYPES.MENOS: {
          // Feature 18: March to standoff distance, charge Cero, fire beam
          const dx = ax - this.x;
          const dy = ay - this.y;
          const dist = Math.hypot(dx, dy) || 1.0;

          if (this.state === 'MARCH') {
            if (dist > this.standoffDist) {
              this.vx = (dx / dist) * this.speed;
              this.vy = (dy / dist) * this.speed;
            } else {
              this.vx = 0;
              this.vy = 0;
              this.state = 'CHARGE';
              this.mode = 'CHARGE';
              this.stateTimer = 0;
            }
          } else if (this.state === 'CHARGE') {
            this.vx = 0;
            this.vy = 0;
            this.stateTimer += dt;
            if (this.stateTimer >= this.chargeDuration) {
              this.state = 'CERO';
              this.mode = 'CERO';
              this.stateTimer = 0;
              this.isDeflected = false;
            }
          } else if (this.state === 'CERO') {
            this.vx = 0;
            this.vy = 0;
            this.stateTimer += dt;
            if (this.stateTimer >= this.ceroDuration) {
              this.state = 'MARCH';
              this.mode = 'MARCH';
              this.stateTimer = 0;
              this.isDeflected = false;
            }
          }
          break;
        }
      }

      // Position Euler Integration
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Orientation update along velocity vector
      const speedSq = this.vx * this.vx + this.vy * this.vy;
      if (speedSq > 1.0) {
        this.angle = Math.atan2(this.vy, this.vx);
      }

      // Animation Frame Toggling
      this.animTimer += dt;
      if (this.animTimer >= 0.12) {
        this.animTimer = 0;
        this.animFrame = 1 - this.animFrame;
      }

      // Altar Contact Breach Check
      const distToAltar = Math.hypot(this.x - ax, this.y - ay);
      if (distToAltar <= (this.radius + ar)) {
        this.isDead = true;
        if (this.particleSystem && typeof this.particleSystem.spawnSmoke === 'function') {
          this.particleSystem.spawnSmoke(this.x, this.y, 8);
        }
        return {
          hitAltar: true,
          damage: this.altarDamage,
          enemy: this
        };
      }

      return null;
    }

    /**
     * Checks circle-circle intersection with arbitrary target.
     * @param {number} x 
     * @param {number} y 
     * @param {number} r 
     * @returns {boolean}
     */
    intersectsCircle(x, y, r) {
      if (this.isDead) return false;
      const dx = this.x - x;
      const dy = this.y - y;
      const radSum = this.radius + r;
      return (dx * dx + dy * dy) <= (radSum * radSum);
    }

    /**
     * Checks intersection with SweptQuad CCD volume.
     * @param {Object} sweptQuad 
     * @returns {boolean}
     */
    intersectsSweptQuad(sweptQuad) {
      if (this.isDead || !sweptQuad) return false;
      if (typeof sweptQuad.intersectsCircle === 'function') {
        return sweptQuad.intersectsCircle({ x: this.x, y: this.y }, this.radius);
      }
      return false;
    }

    /**
     * RotMG Sprite Rendering.
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
      if (!ctx || this.isDead) return;

      ctx.save();
      ctx.translate(this.x, this.y);

      // Facing angle (Sprites point downward by default; rotate relative to movement)
      ctx.rotate(this.angle - Math.PI / 2);

      // White flash tint when damaged
      if (this.hitFlashTimer > 0) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 8;
      }

      // Resolve Sprite Canvas from SpriteGen
      let currentKey = this.spriteKey;
      if (this.type === ENEMY_TYPES.CRAWLER && this.animFrame === 1 && this.walkSpriteKey) {
        currentKey = this.walkSpriteKey;
      } else if (this.type === ENEMY_TYPES.FLYER && this.animFrame === 1 && this.flapSpriteKey) {
        currentKey = this.flapSpriteKey;
      } else if (this.type === ENEMY_TYPES.MENOS && (this.state === 'CHARGE' || this.state === 'CERO')) {
        currentKey = 'menos_cero';
      }

      let spriteCanvas = null;
      if (SpriteGen && typeof SpriteGen.getSprite === 'function') {
        try {
          spriteCanvas = SpriteGen.getSprite(currentKey);
        } catch (e) {
          spriteCanvas = null;
        }
      }

      const drawSize = this.spriteSize;
      const halfSize = drawSize / 2;

      if (spriteCanvas && typeof ctx.drawImage === 'function') {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spriteCanvas, -halfSize, -halfSize, drawSize, drawSize);
      } else {
        // Fallback procedural rendering for headless/mock environments
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = (this.type === ENEMY_TYPES.BRUTE) ? '#27272a' : ((this.type === ENEMY_TYPES.FLYER) ? '#be123c' : '#581c87');
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#0a0a0c';
        ctx.stroke();
      }

      // Visual indicator for cracked carapace on Armored Brute
      if (this.type === ENEMY_TYPES.BRUTE && this.armorBroken) {
        ctx.strokeStyle = '#ff0033';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -8);
        ctx.lineTo(0, 0);
        ctx.lineTo(4, -4);
        ctx.lineTo(8, 6);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // Universal Modular Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.Enemy = Enemy;
  global.TZ.ENEMY_TYPES = ENEMY_TYPES;
  global.TZ.ENEMY_CONFIGS = ENEMY_CONFIGS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Enemy;
    module.exports.Enemy = Enemy;
    module.exports.ENEMY_TYPES = ENEMY_TYPES;
    module.exports.ENEMY_CONFIGS = ENEMY_CONFIGS;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
```

---

### 4.2 Unit & Integration Test Specifications for `test/test-combat.js`

Add the following comprehensive test blocks to `test/test-combat.js` to verify Features 15, 16, and 17:

```javascript
// ============================================================================
// 8. Feature 15: Hollow Crawler Swarm AI Unit & Integration Tests
// ============================================================================
describe('Feature 15: Hollow Crawler Swarm AI', () => {
  const Enemy = require('../src/game/Enemy.js');

  it('15.1 initializes with canonical base stats (HP 25, Speed 95, Radius 12, Damage 8)', () => {
    const crawler = Enemy.createCrawler(100, 100);
    assert.strictEqual(crawler.type, 'crawler');
    assert.strictEqual(crawler.hp, 25);
    assert.strictEqual(crawler.speed, 95);
    assert.strictEqual(crawler.radius, 12);
    assert.strictEqual(crawler.altarDamage, 8);
    assert.strictEqual(crawler.damage, 8);
    assert.strictEqual(crawler.isDead, false);
  });

  it('15.2 steers toward central Soul Altar with positive velocity progression', () => {
    const crawler = Enemy.createCrawler(0, 360);
    crawler.update(0.1, { x: 640, y: 360, radius: 36 });
    assert.ok(crawler.x > 0);
    assert.ok(crawler.vx > 80);
  });

  it('15.3 applies flocking separation repulsion against neighboring crawlers', () => {
    const c1 = Enemy.createCrawler(100, 100);
    const c2 = Enemy.createCrawler(105, 100);
    c1.applySeparation([c2]);
    assert.ok(c1.vx < 0, `Expected c1.vx < 0 due to repulsion from c2, got ${c1.vx}`);
  });

  it('15.4 incorporates sinusoidal skittering gait perturbation', () => {
    const c = Enemy.createCrawler(0, 0, { skitterPhase: 0 });
    assert.strictEqual(c.skitterPhase, 0);
    c.update(0.1, { x: 640, y: 360 });
    assert.ok(c.skitterPhase > 0);
  });

  it('15.5 triggers Altar breach event and delivers exactly 8 damage upon contact', () => {
    const crawler = Enemy.createCrawler(640, 360 + 40); // 40px away, <= 12 + 36 = 48px
    const event = crawler.update(0.016, { x: 640, y: 360, radius: 36 });
    assert.ok(event !== null);
    assert.strictEqual(event.hitAltar, true);
    assert.strictEqual(event.damage, 8);
    assert.strictEqual(crawler.isDead, true);
  });

  it('15.6 single blade cut results in 1-hit clean cut and bisection flag', () => {
    const crawler = Enemy.createCrawler(200, 200);
    const res = crawler.onHit(25, { x: 0, y: 1 }, 0, 500);
    assert.strictEqual(res.bisect, true);
    assert.strictEqual(res.ricochet, false);
    assert.strictEqual(crawler.isDead, true);
  });
});

// ============================================================================
// 9. Feature 16: Hollow Flyer Harasser AI Unit & Integration Tests
// ============================================================================
describe('Feature 16: Hollow Flyer Harasser AI', () => {
  const Enemy = require('../src/game/Enemy.js');

  it('16.1 initializes with canonical base stats (HP 20, Speed 185, Radius 10, DiveSpeed 270, Damage 12)', () => {
    const flyer = Enemy.createFlyer(500, 500);
    assert.strictEqual(flyer.type, 'flyer');
    assert.strictEqual(flyer.hp, 20);
    assert.strictEqual(flyer.speed, 185);
    assert.strictEqual(flyer.diveSpeed, 270);
    assert.strictEqual(flyer.radius, 10);
    assert.strictEqual(flyer.altarDamage, 12);
    assert.strictEqual(flyer.damage, 12);
  });

  it('16.2 executes logarithmic spiral approach around Altar at long range (r >= 180px)', () => {
    const flyer = Enemy.createFlyer(640 + 300, 360);
    assert.strictEqual(flyer.state, 'SPIRAL');
    flyer.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(flyer.state, 'SPIRAL');
    assert.strictEqual(flyer.speed, 185);
  });

  it('16.3 accelerates to high-speed dive (270 px/s) at close range (r < 180px)', () => {
    const flyer = Enemy.createFlyer(640 + 150, 360);
    flyer.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(flyer.state, 'DIVE');
    assert.strictEqual(flyer.speed, 270);
  });

  it('16.4 executes reactive evasive lateral twitch when blade approaches within 95px', () => {
    const flyer = Enemy.createFlyer(100, 100);
    const evaded = flyer.evadeBlade({ x: 120, y: 100 }, 400);
    assert.strictEqual(evaded, true);
    assert.strictEqual(flyer.isEvading, true);
    assert.ok(flyer.evadeTimer > 0);
  });

  it('16.5 enforces evasion cooldown preventing continuous twitch spam', () => {
    const flyer = Enemy.createFlyer(100, 100);
    assert.strictEqual(flyer.evadeBlade({ x: 120, y: 100 }, 400), true);
    assert.strictEqual(flyer.evadeBlade({ x: 120, y: 100 }, 400), false);
  });

  it('16.6 delivers 12 damage upon diving through Altar hitbox', () => {
    const flyer = Enemy.createFlyer(640, 360 + 40);
    const event = flyer.update(0.016, { x: 640, y: 360, radius: 36 });
    assert.ok(event !== null);
    assert.strictEqual(event.hitAltar, true);
    assert.strictEqual(event.damage, 12);
    assert.strictEqual(flyer.isDead, true);
  });
});

// ============================================================================
// 10. Feature 17: Armored Brute Vanguard AI Unit & Integration Tests
// ============================================================================
describe('Feature 17: Armored Brute Vanguard AI', () => {
  const Enemy = require('../src/game/Enemy.js');

  it('17.1 initializes with canonical base stats (HP 90, Speed 48, Radius 20, Damage 25, Armor Intact)', () => {
    const brute = Enemy.createBrute(200, 200);
    assert.strictEqual(brute.type, 'brute');
    assert.strictEqual(brute.hp, 90);
    assert.strictEqual(brute.speed, 48);
    assert.strictEqual(brute.radius, 20);
    assert.strictEqual(brute.altarDamage, 25);
    assert.strictEqual(brute.armorBroken, false);
    assert.strictEqual(brute.stunTimer, 0);
  });

  it('17.2 light slashes (< 600 px/s) ricochet off intact armor with 15 chip damage', () => {
    const brute = Enemy.createBrute(0, 0);
    const res = brute.onHit(25, { x: 0, y: 1 }, 0, 450);
    assert.strictEqual(res.ricochet, true);
    assert.strictEqual(res.cracked, false);
    assert.strictEqual(res.bisect, false);
    assert.strictEqual(brute.armorBroken, false);
    assert.strictEqual(brute.hp, 75); // 90 - 15 = 75
  });

  it('17.3 heavy slashes (>= 600 px/s) crack carapace armor', () => {
    const brute = Enemy.createBrute(0, 0);
    const res = brute.onHit(40, { x: 0, y: 1 }, 0, 600);
    assert.strictEqual(res.ricochet, false);
    assert.strictEqual(res.cracked, true);
    assert.strictEqual(brute.armorBroken, true);
    assert.strictEqual(brute.hp, 50); // 90 - 40 = 50
  });

  it('17.4 applies 1.2s stagger stun upon armor break that halts movement', () => {
    const brute = Enemy.createBrute(0, 0);
    brute.onHit(40, { x: 0, y: 1 }, 0, 750);
    assert.strictEqual(brute.stunTimer, 1.2);
    brute.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(brute.vx, 0);
    assert.strictEqual(brute.vy, 0);
  });

  it('17.5 subsequent slash after armor break triggers clean bisection', () => {
    const brute = Enemy.createBrute(0, 0);
    brute.armorBroken = true;
    const res = brute.onHit(50, { x: 0, y: 1 }, 0, 450);
    assert.strictEqual(res.bisect, true);
    assert.strictEqual(brute.isDead, true);
  });

  it('17.6 Getsuga wave projectile cracks carapace regardless of mouse swing speed', () => {
    const brute = Enemy.createBrute(0, 0);
    const res = brute.onHit(45, { x: 1, y: 0 }, 0, 0, { isGetsugaWave: true });
    assert.strictEqual(res.cracked, true);
    assert.strictEqual(brute.armorBroken, true);
  });

  it('17.7 Senka forced slash cracks carapace and damages brute', () => {
    const brute = Enemy.createBrute(0, 0);
    const res = brute.onHit(60, { x: 1, y: 0 }, 0, 0, { isForcedSlash: true });
    assert.strictEqual(res.cracked, true);
    assert.strictEqual(brute.armorBroken, true);
  });
});
```

---

## 5. Verification Method

To independently verify this blueprint:

1. **Verify Baseline Tests**:
   Execute native test runner command from project root:
   ```powershell
   node --test test/test-engine.js test/test-combat.js
   ```
   *Expected outcome*: 95/95 tests pass in sub-120ms.

2. **Verify Drop-In Compatibility against E2E Suite**:
   Once Worker writes `src/game/Enemy.js`:
   ```powershell
   node --test test/test-e2e.js
   ```
   *Expected outcome*:
   - Feature 15 (Tests 15.1, 15.2, 15.3, 15.4, 15.5) PASS
   - Feature 16 (Tests 16.1, 16.2, 16.3, 16.4, 16.5) PASS
   - Feature 17 (Tests 17.1, 17.2, 17.3, 17.4, 17.5) PASS
   - Boundary tests (2.4.1, 2.4.2) PASS
   - Cross-system combat test (3.4) PASS

3. **Invalidation Conditions**:
   - Any crawler speed other than $95\text{ px/s}$ or altarDamage other than $8$ invalidates Feature 15.
   - Any flyer dive speed other than $270\text{ px/s}$ or dive threshold other than $180\text{ px}$ invalidates Feature 16.
   - Any brute ricochet chip damage other than $15$ or speed threshold other than $600\text{ px/s}$ invalidates Feature 17.
