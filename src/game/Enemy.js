/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/game/Enemy.js
 * 
 * Standard Enemy Swarm Ecosystem & Boss AI:
 * - Feature 15: Hollow Crawler Swarm AI (skittering gait noise, flocking separation, 1-hit cut)
 * - Feature 16: Hollow Flyer Harasser AI (logarithmic spiral approach, 270 px/s dive, blade evasion)
 * - Feature 17: Armored Brute Vanguard AI (carapace ricochet < 600 px/s, crack >= 600 px/s, 1.2s stun, bisection)
 * - Feature 18 & 19: Menos Grande Gillian Boss AI (standoff march, telegraph laser, Cero beam, blade deflection clash)
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

  /**
   * Base / Standard Enemy entity (Crawlers, Flyers, Armored Brutes)
   */
  class Enemy {
    /**
     * @param {string} type - 'crawler' | 'flyer' | 'brute' | 'menos'
     * @param {number} [x=0] - World X spawn coordinate
     * @param {number} [y=0] - World Y spawn coordinate
     * @param {Object} [options={}] - Additional options (particleSystem, audioSynth, camera, etc.)
     */
    constructor(type = 'crawler', x = 0, y = 0, options = {}) {
      if (type.toLowerCase() === ENEMY_TYPES.MENOS) {
        return new MenosGrande(x, y, options);
      }

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
      this.audioSynth = options.audioSynth || options.audio || (global.TZ && global.TZ.defaultAudioSynth) || null;
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
      return new MenosGrande(x, y, options);
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

      // 2. Standard Swarm Types (Crawler & Flyer): 1-Hit Clean Cut / Bisection
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
     * Main Physics & AI Step for standard swarm types.
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
     * RotMG Sprite Rendering for standard swarm entities.
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
        if (typeof ctx.arc === 'function') {
          ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        } else if (typeof ctx.rect === 'function') {
          ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        }
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

  /**
   * MenosGrande Gillian Boss Subsystem (Features 18 & 19)
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
      this.particleSystem = options.particleSystem || (global.TZ && global.TZ.defaultParticleSystem) || null;
      this.audio = options.audio || options.audioSynth || (global.TZ && global.TZ.defaultAudioSynth) || null;
      this.audioSynth = this.audio;
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

    get mode() {
      return this._state;
    }

    set mode(val) {
      this.state = val;
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
      const aud = (katana && (katana.audio || katana.audioSynth)) || this.audio || this.audioSynth;
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
            const aud = this.audio || this.audioSynth;
            if (aud && typeof aud.playCeroCharge === 'function') {
              aud.playCeroCharge();
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
            const aud = this.audio || this.audioSynth;
            if (aud && typeof aud.playCeroBlast === 'function') {
              aud.playCeroBlast();
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
     * @param {{x: number, y: number}} [cutNormal={x:0, y:1}] Normal perpendicular to cut angle
     * @param {number} [cutAngle=0] Cut plane angle in radians
     * @param {number} [swingSpeed=500] Blade speed in px/s
     * @param {Object} [options={}] Additional hit options (camera, particleSystem, etc.)
     * @returns {Object} Hit result { bisect, dead, damageDealt, isBoss }
     */
    onHit(damage, cutNormal = { x: 0, y: 1 }, cutAngle = 0, swingSpeed = 500, options = {}) {
      if (this.isDead) {
        return { bisect: false, dead: true, damageDealt: 0, isBoss: true };
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

        const aud = this.audio || this.audioSynth;
        if (aud && typeof aud.playHollowDeath === 'function') {
          aud.playHollowDeath('menos');
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
     * Renders Menos Grande, telegraph laser, Cero beam, and boss HP bar
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
      if (!ctx || this.isDead) return;

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
        if (typeof ctx.arc === 'function') {
          ctx.arc(originX + Math.cos(this.aimAngle) * 280, originY + Math.sin(this.aimAngle) * 280, 8, 0, Math.PI * 2);
        }
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
      const spriteKey = (this._state === 'CHARGE' || this.isCeroActive()) ? 'menos_cero' : 'menos';
      let sprite = null;

      if (SpriteGen && typeof SpriteGen.getSprite === 'function') {
        try {
          sprite = SpriteGen.getSprite(spriteKey, this.spriteScale);
        } catch (e) {
          sprite = null;
        }
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
        if (typeof ctx.arc === 'function') {
          ctx.arc(drawX, drawY, this.radius, 0, Math.PI * 2);
        } else if (typeof ctx.rect === 'function') {
          ctx.rect(drawX - this.radius, drawY - this.radius, this.radius * 2, this.radius * 2);
        }
        ctx.fill();
        ctx.strokeStyle = '#0a0a0c';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Mask
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (typeof ctx.arc === 'function') {
          ctx.arc(drawX, drawY - 12, 16, 0, Math.PI * 2);
        }
        ctx.fill();

        // Red eye slits / mouth
        ctx.fillStyle = '#ff0033';
        if (typeof ctx.fillRect === 'function') {
          ctx.fillRect(drawX - 6, drawY - 14, 3, 2);
          ctx.fillRect(drawX + 3, drawY - 14, 3, 2);
          if (spriteKey === 'menos_cero') {
            ctx.fillRect(drawX - 4, drawY - 6, 8, 4);
          }
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
      if (typeof ctx.fillRect === 'function') {
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#27272a';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#ff0033';
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
      }

      ctx.restore();
    }
  }

  // Universal Modular Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.Enemy = Enemy;
  global.TZ.MenosGrande = MenosGrande;
  global.TZ.ENEMY_TYPES = ENEMY_TYPES;
  global.TZ.ENEMY_CONFIGS = ENEMY_CONFIGS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Enemy;
    module.exports.Enemy = Enemy;
    module.exports.MenosGrande = MenosGrande;
    module.exports.ENEMY_TYPES = ENEMY_TYPES;
    module.exports.ENEMY_CONFIGS = ENEMY_CONFIGS;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
