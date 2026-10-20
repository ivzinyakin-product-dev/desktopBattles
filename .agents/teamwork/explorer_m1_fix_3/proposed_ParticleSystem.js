/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/engine/ParticleSystem.js (Proposed Remediation)
 * 
 * Zero-Allocation Pooled Particle Engine for Spiritual FX (Embers, Kuroi Smoke, Bone Shards).
 * Features Rolling Circular Buffer Recycling Head Pointer to prevent saturation starvation.
 * Zero external dependencies. Browser & Node.js compatible.
 */
(function (global) {
  'use strict';

  const PARTICLE_TYPE = {
    EMBER: 0,
    SMOKE: 1,
    SHARD: 2
  };

  /**
   * Internal reusable particle instance.
   */
  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.active = false;
      this.type = PARTICLE_TYPE.EMBER;
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.drag = 1.0;
      this.gravity = 0;
      this.life = 0;
      this.maxLife = 1.0;
      this.radius = 2.0;
      this.startRadius = 2.0;
      this.endRadius = 0.5;
      this.alpha = 1.0;
      this.startAlpha = 1.0;
      this.endAlpha = 0.0;
      this.color = '#ff1744';
      this.angle = 0;
      this.angularVelocity = 0;
      this.size = 3.0;
      this.floorY = 700;
      this.restitution = 0.45;
      this.friction = 0.65;
    }
  }

  class ParticleSystem {
    /**
     * @param {Object} [options]
     * @param {number} [options.capacity=800] Maximum pre-allocated particle pool size
     * @param {number} [options.maxParticles] Alias for capacity
     * @param {number} [options.floorY=700] Arena floor boundary Y in pixels
     */
    constructor(options = {}) {
      this.capacity = options.capacity || options.maxParticles || 800;
      // Hard cap pool capacity at 1000 to prevent memory blowup under stress
      if (this.capacity > 1000) this.capacity = 1000;
      this.floorY = typeof options.floorY === 'number' ? options.floorY : 700;

      // Pre-allocate fixed pool buffer
      this.pool = new Array(this.capacity);
      for (let i = 0; i < this.capacity; i++) {
        this.pool[i] = new Particle();
      }
      this.activeCount = 0;
      // Rolling circular recycling head pointer
      this.oldestIndex = 0;

      // Authentic Bleach color palettes
      this.emberColors = ['#ff1744', '#ff0033', '#ff5252', '#ff8a80', '#ffffff'];
      this.smokeColors = ['#050505', '#110508', '#1a0a0f', '#0d0202'];
    }

    /**
     * Expose particle types enum.
     */
    static get TYPE() {
      return PARTICLE_TYPE;
    }

    /**
     * Maximum capacity alias for compatibility with options.maxParticles / tests.
     */
    get maxParticles() {
      return this.capacity;
    }
    set maxParticles(val) {
      this.capacity = val;
    }

    /**
     * Recycling head pointer alias for inspector/reviewer compatibility.
     */
    get _recycleHead() {
      return this.oldestIndex;
    }
    set _recycleHead(val) {
      this.oldestIndex = val;
    }

    /**
     * Returns array of active particles for testing / inspector compatibility.
     * @returns {Particle[]}
     */
    get particles() {
      return this.pool.slice(0, this.activeCount);
    }

    /**
     * Acquires an idle particle from pool in O(1) time without heap allocation.
     * When pool is saturated, steals oldest active particle via rolling circular head pointer.
     * @private
     */
    _acquire() {
      if (this.activeCount < this.capacity) {
        const p = this.pool[this.activeCount];
        this.activeCount++;
        p.reset();
        p.active = true;
        p.floorY = this.floorY;
        return p;
      }
      // Pool saturated: rolling circular buffer recycling prevents slot-0 starvation
      const oldest = this.pool[this.oldestIndex];
      this.oldestIndex = (this.oldestIndex + 1) % this.capacity;
      oldest.reset();
      oldest.active = true;
      oldest.floorY = this.floorY;
      return oldest;
    }

    /**
     * Spawns high-velocity crimson Reiatsu embers.
     * @param {number} x Origin X
     * @param {number} y Origin Y
     * @param {number} [count=10] Number of particles to spawn
     * @param {number|null} [angle=null] Direction in radians (null = isotropic 360 burst)
     * @param {string|null} [color=null] Custom hex color (null = random crimson palette)
     * @param {number} [speedScale=1.0] Multiplier for initial velocity
     */
    spawnEmbers(x, y, count = 10, angle = null, color = null, speedScale = 1.0) {
      for (let i = 0; i < count; i++) {
        const p = this._acquire();
        p.type = PARTICLE_TYPE.EMBER;
        p.x = x + (Math.random() - 0.5) * 6;
        p.y = y + (Math.random() - 0.5) * 6;

        const baseAngle = (angle !== null && angle !== undefined)
          ? angle + (Math.random() - 0.5) * 0.9
          : Math.random() * Math.PI * 2;

        const speed = (180 + Math.random() * 240) * speedScale;
        p.vx = Math.cos(baseAngle) * speed;
        p.vy = Math.sin(baseAngle) * speed;
        p.drag = 0.92;
        p.gravity = 40; // Subtle downward drift
        p.life = 0;
        p.maxLife = 0.22 + Math.random() * 0.22;
        p.startRadius = 2.0 + Math.random() * 1.5;
        p.endRadius = 0.4;
        p.radius = p.startRadius;
        p.startAlpha = 1.0;
        p.endAlpha = 0.0;
        p.alpha = 1.0;
        p.color = color || this.emberColors[Math.floor(Math.random() * this.emberColors.length)];
      }
    }

    /**
     * Spawns expanding Kuroi dark spiritual smoke miasma.
     * @param {number} x Origin X
     * @param {number} y Origin Y
     * @param {number} [count=6] Number of particles to spawn
     * @param {string|null} [color=null] Custom hex color
     */
    spawnSmoke(x, y, count = 6, color = null) {
      for (let i = 0; i < count; i++) {
        const p = this._acquire();
        p.type = PARTICLE_TYPE.SMOKE;
        p.x = x + (Math.random() - 0.5) * 12;
        p.y = y + (Math.random() - 0.5) * 12;
        p.vx = (Math.random() - 0.5) * 50;
        p.vy = -40 - Math.random() * 60; // Thermal upward drift
        p.drag = 0.95;
        p.gravity = -15; // Natural spiritual buoyancy
        p.life = 0;
        p.maxLife = 0.50 + Math.random() * 0.35;
        p.startRadius = 2.5 + Math.random() * 2.0;
        p.endRadius = 8.0 + Math.random() * 6.0;
        p.radius = p.startRadius;
        p.startAlpha = 0.85;
        p.endAlpha = 0.0;
        p.alpha = p.startAlpha;
        p.color = color || this.smokeColors[Math.floor(Math.random() * this.smokeColors.length)];
      }
    }

    /**
     * Spawns shattered Hollow mask bone fragments with ballistic gravity and floor bouncing.
     * @param {number} x Origin X
     * @param {number} y Origin Y
     * @param {number} [count=6] Number of shards to spawn
     */
    spawnShards(x, y, count = 6) {
      for (let i = 0; i < count; i++) {
        const p = this._acquire();
        p.type = PARTICLE_TYPE.SHARD;
        p.x = x + (Math.random() - 0.5) * 8;
        p.y = y + (Math.random() - 0.5) * 8;
        p.vx = (Math.random() - 0.5) * 360;
        p.vy = -120 - Math.random() * 160; // Explosive upward launch
        p.drag = 0.98;
        p.gravity = 520; // Heavy ballistic gravity
        p.life = 0;
        p.maxLife = 0.70 + Math.random() * 0.40;
        p.size = 2.5 + Math.random() * 2.5; // RotMG bone block
        p.angle = Math.random() * Math.PI * 2;
        p.angularVelocity = (Math.random() - 0.5) * 16.0;
        p.startAlpha = 1.0;
        p.endAlpha = 0.0;
        p.alpha = 1.0;
        p.color = '#f8fafc'; // Ivory bone white
        p.restitution = 0.45;
        p.friction = 0.65;
      }
    }

    /**
     * Updates all active particles and recycles expired particles in O(1).
     * @param {number} dt Delta time in seconds
     */
    update(dt) {
      if (dt <= 0 || isNaN(dt)) return;

      let i = 0;
      while (i < this.activeCount) {
        const p = this.pool[i];
        p.life += dt;

        if (p.life >= p.maxLife) {
          // Expired: swap with last active particle and decrement activeCount
          p.active = false;
          this.activeCount--;
          const lastActive = this.pool[this.activeCount];
          this.pool[i] = lastActive;
          this.pool[this.activeCount] = p;
          // Do not increment i; next iteration tests the swapped-in particle
          continue;
        }

        const progress = p.life / p.maxLife;

        // Kinematics: drag and gravity
        const dragFactor = Math.pow(p.drag, dt * 60);
        p.vx *= dragFactor;
        p.vy = (p.vy + p.gravity * dt) * dragFactor;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Archetype specific updates
        if (p.type === PARTICLE_TYPE.EMBER) {
          p.radius = p.startRadius + (p.endRadius - p.startRadius) * progress;
          p.alpha = p.startAlpha + (p.endAlpha - p.startAlpha) * progress;
        } else if (p.type === PARTICLE_TYPE.SMOKE) {
          p.radius = p.startRadius + (p.endRadius - p.startRadius) * Math.sqrt(progress);
          p.alpha = p.startAlpha * (1.0 - progress);
        } else if (p.type === PARTICLE_TYPE.SHARD) {
          p.angle += p.angularVelocity * dt;

          // Floor collision and bounce
          if (p.y >= p.floorY) {
            p.y = p.floorY;
            if (p.vy > 0) {
              p.vy = -p.vy * p.restitution;
              p.vx *= p.friction;
              p.angularVelocity = -p.angularVelocity * 0.5;

              // Settled rest condition
              if (Math.abs(p.vy) < 25) {
                p.vy = 0;
                p.gravity = 0;
              }
            }
          }

          // Bone shard alpha stays opaque until 70% life, then fades out
          if (progress > 0.7) {
            p.alpha = 1.0 - (progress - 0.7) / 0.3;
          } else {
            p.alpha = 1.0;
          }
        }

        i++;
      }

      if (this.activeCount === 0) {
        this.oldestIndex = 0;
      }
    }

    /**
     * Renders all active particles using batched blend operations.
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
      if (!ctx || this.activeCount === 0) return;

      ctx.save();

      // Pass 1: Shards & Smoke (normal source-over)
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < this.activeCount; i++) {
        const p = this.pool[i];
        if (p.type === PARTICLE_TYPE.SMOKE) {
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === PARTICLE_TYPE.SHARD) {
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          // 1px RotMG dark border + ivory bone face
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-p.size / 2 - 0.5, -p.size / 2 - 0.5, p.size + 1, p.size + 1);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      }

      // Pass 2: Embers (additive screen blend for glowing Reiatsu)
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < this.activeCount; i++) {
        const p = this.pool[i];
        if (p.type === PARTICLE_TYPE.EMBER) {
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    /**
     * Immediately deactivates and recycles all particles.
     */
    clear() {
      for (let i = 0; i < this.activeCount; i++) {
        this.pool[i].active = false;
      }
      this.activeCount = 0;
      this.oldestIndex = 0;
    }
  }

  // Universal Modular Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.ParticleSystem = ParticleSystem;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParticleSystem;
    module.exports.ParticleSystem = ParticleSystem;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
