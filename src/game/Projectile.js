/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/game/Projectile.js
 * 
 * Kuroi Getsuga Tensho Crescent Wave Projectile (TZ.GetsugaWave).
 * High-velocity crescent reiatsu wave unleashed on Right-Click or Spacebar.
 * 
 * Universal Modular Pattern (Browser window.TZ & Node.js CommonJS).
 */
(function (global) {
  'use strict';

  // Acquire engine dependencies defensively
  const Vector2 = (global.TZ && global.TZ.Vector2) || 
    (typeof require === 'function' ? require('../engine/Vector2.js') : null);
  const SweptQuad = (global.TZ && global.TZ.SweptQuad) || 
    (Vector2 ? Vector2.SweptQuad : null);

  class GetsugaWave {
    /**
     * @param {number} [x=0] Origin X coordinate
     * @param {number} [y=0] Origin Y coordinate
     * @param {number} [dirX=1] Direction X or velocity X
     * @param {number} [dirY=0] Direction Y or velocity Y
     * @param {Object} [options={}] Configuration options
     */
    constructor(x = 0, y = 0, dirX = 1, dirY = 0, options = {}) {
      this.x = typeof x === 'number' && !Number.isNaN(x) ? x : 0;
      this.y = typeof y === 'number' && !Number.isNaN(y) ? y : 0;
      this.prevX = this.x;
      this.prevY = this.y;

      const rawLen = Math.hypot(dirX, dirY);
      const defaultSpeed = 820; // 820 px/s

      if (typeof options.speed === 'number') {
        this.speed = options.speed;
        this.dirX = rawLen > 1e-6 ? dirX / rawLen : 1;
        this.dirY = rawLen > 1e-6 ? dirY / rawLen : 0;
      } else if (rawLen > 1.5) {
        // Raw velocity passed as dirX, dirY
        this.speed = rawLen;
        this.dirX = dirX / rawLen;
        this.dirY = dirY / rawLen;
      } else if (rawLen > 1e-6) {
        this.speed = defaultSpeed;
        this.dirX = dirX / rawLen;
        this.dirY = dirY / rawLen;
      } else {
        // Zero-speed / zero direction vector passed
        this.speed = 0;
        this.dirX = 0;
        this.dirY = 0;
      }

      this.vx = this.dirX * this.speed;
      this.vy = this.dirY * this.speed;
      this.angle = (this.dirX === 0 && this.dirY === 0) ? 0 : Math.atan2(this.dirY, this.dirX);

      // Geometry: Parabolic Bezier crescent (R = 42px, thickness 16px)
      this.radius = typeof options.radius === 'number' ? options.radius : 42;
      this.thickness = typeof options.thickness === 'number' ? options.thickness : 16;

      // Lifecycle & Penetration (lifespan 1.6s, up to 8 enemies)
      this.maxLife = typeof options.life === 'number' ? options.life : 1.6;
      this.life = this.maxLife;
      this.maxPierces = typeof options.maxPierces === 'number' ? options.maxPierces : 8;
      this.pierceCount = 0;
      this.isDead = (this.speed <= 0 && rawLen === 0) || this.life <= 0;

      // Combat stats
      this.damage = typeof options.damage === 'number' ? options.damage : 60;
      this.hitEntities = new Set();

      // Particle wake integration
      this.particleSystem = options.particleSystem || null;
      this.trailTimer = 0;
      this.trailInterval = 0.025; // 25ms between trail puffs
    }

    /**
     * Remaining pierce count getter/setter for compatibility
     */
    get piercesLeft() {
      return Math.max(0, this.maxPierces - this.pierceCount);
    }

    set piercesLeft(val) {
      if (typeof val === 'number') {
        this.pierceCount = this.maxPierces - val;
        if (this.pierceCount >= this.maxPierces) {
          this.isDead = true;
        }
      }
    }

    /**
     * Increments pierce counter and checks dissipation
     * @returns {boolean} Whether wave dissipated
     */
    onPierce() {
      this.pierceCount++;
      if (this.pierceCount >= this.maxPierces) {
        this.isDead = true;
      }
      return this.isDead;
    }

    /**
     * Constructs SweptQuad CCD volume representing the wave's sweep across the last frame
     * @returns {SweptQuad|null}
     */
    getSweptQuad() {
      const QuadClass = (global.TZ && global.TZ.SweptQuad) || SweptQuad;
      if (!QuadClass) return null;

      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);
      // Lateral wing endpoints perpendicular to flight angle: (-sin, cos)
      const halfSpan = this.radius; // 42px
      const p0 = { x: this.prevX - sin * halfSpan, y: this.prevY + cos * halfSpan };
      const p1 = { x: this.prevX + sin * halfSpan, y: this.prevY - cos * halfSpan };
      const p2 = { x: this.x + sin * halfSpan, y: this.y - cos * halfSpan };
      const p3 = { x: this.x - sin * halfSpan, y: this.y + cos * halfSpan };

      return new QuadClass(p0, p1, p2, p3);
    }

    /**
     * Tests continuous intersection against a circular collision volume
     * Supports both intersectsCircle(center, radius) and intersectsCircle(cx, cy, r).
     * @param {Vector2|{x:number, y:number}|number} cxOrCenter 
     * @param {number} cyOrRadius 
     * @param {number} [r] 
     * @returns {boolean}
     */
    intersectsCircle(cxOrCenter, cyOrRadius, r) {
      if (this.isDead) return false;

      let cx, cy, cr;
      if (typeof cxOrCenter === 'object' && cxOrCenter !== null) {
        cx = cxOrCenter.x;
        cy = cxOrCenter.y;
        cr = typeof cyOrRadius === 'number' ? cyOrRadius : 0;
      } else {
        cx = cxOrCenter;
        cy = cyOrRadius;
        cr = typeof r === 'number' ? r : 0;
      }

      if (Number.isNaN(cx) || Number.isNaN(cy) || cr <= 0) {
        return false;
      }

      // 1. Broadphase: distance to current wave center
      const dx = cx - this.x;
      const dy = cy - this.y;
      const distSq = dx * dx + dy * dy;
      const maxReach = this.radius + cr;

      if (distSq > maxReach * maxReach) {
        // Continuous swept quad check for high speed sweep
        const sq = this.getSweptQuad();
        if (sq && typeof sq.intersectsCircle === 'function') {
          return sq.intersectsCircle(cx, cy, cr);
        }
        return false;
      }

      // 2. Narrowphase: Transform query point to wave's local frame
      // In local space: +X is flight forward, +Y is lateral wing
      const cos = Math.cos(-this.angle);
      const sin = Math.sin(-this.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;

      // Lateral chord rejection
      if (ly + cr < -this.radius || ly - cr > this.radius) {
        return false;
      }

      // Parabolic arc curve profile check
      // Crest is at +18.9px, tips are at -14.7px, +/- 42px
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
     * Checks collision with enemy entity, handles pierce counter and multi-hit prevention
     * @param {Object} enemy 
     * @param {Object} [particleSystem] 
     * @returns {boolean} Whether hit occurred
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

        // Invoke enemy onHit callback
        if (typeof enemy.onHit === 'function') {
          enemy.onHit(this.damage, { x: this.dirX, y: this.dirY }, this.angle, this.speed);
        }

        // Dissipate if pierced maximum allowed entities
        if (this.pierceCount >= this.maxPierces) {
          this.isDead = true;
        }
        return true;
      }

      return false;
    }

    /**
     * Updates wave position, lifespan, bounds check, and emits trailing particles
     * @param {number} dt Frame delta time in seconds
     * @param {Object} [particleSystem] Optional particle system override
     */
    update(dt, particleSystem) {
      if (this.isDead) return;

      const delta = typeof dt === 'number' && dt > 0 ? dt : 0;

      // Despawn on zero speed or non-positive lifespan
      if (this.speed <= 0 || this.life <= 0) {
        this.isDead = true;
        return;
      }

      // Advance position
      this.prevX = this.x;
      this.prevY = this.y;
      this.x += this.vx * delta;
      this.y += this.vy * delta;

      // Lifespan decay
      this.life -= delta;
      if (this.life <= 0) {
        this.isDead = true;
        return;
      }

      // Bounds checking (1280x720 canvas with 100px margin)
      if (
        this.x < -100 ||
        this.x > 1280 + 100 ||
        this.y < -100 ||
        this.y > 720 + 100
      ) {
        this.isDead = true;
        return;
      }

      // Trailing kuroi smoke and reiatsu embers wake
      const ps = particleSystem || this.particleSystem || (global.TZ && global.TZ.particleSystem);
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
     * Renders parabolic Bezier crescent with jet-black core and glowing crimson stroke
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
      if (this.isDead || !ctx) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      const R = this.radius;          // 42px
      const W = this.thickness;       // 16px
      const tipX = -R * 0.35;         // -14.7px
      const crestX = R * 0.45;        // +18.9px
      const innerCrestX = crestX - W; // +2.9px

      ctx.beginPath();
      // Outer leading parabolic curve
      ctx.moveTo(tipX, -R);
      if (typeof ctx.quadraticCurveTo === 'function') {
        ctx.quadraticCurveTo(crestX * 1.5, 0, tipX, R);
        // Inner trailing parabolic curve
        ctx.quadraticCurveTo(innerCrestX * 1.2, 0, tipX, -R);
      } else {
        ctx.lineTo(crestX, 0);
        ctx.lineTo(tipX, R);
        ctx.lineTo(innerCrestX, 0);
        ctx.lineTo(tipX, -R);
      }
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

  // Universal Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.GetsugaWave = GetsugaWave;
  global.TZ.Projectile = GetsugaWave;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GetsugaWave;
    module.exports.GetsugaWave = GetsugaWave;
    module.exports.Projectile = GetsugaWave;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
