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
      const ctx = offscreen && typeof offscreen.getContext === 'function' ? offscreen.getContext('2d') : null;
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
        } else if (typeof ctx.rect === 'function') {
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

      if (this.canvas && typeof ctx.drawImage === 'function') {
        const sw = this.canvas.width || (this.radius * 2);
        const sh = this.canvas.height || (this.radius * 2);
        ctx.drawImage(this.canvas, -sw / 2, -sh / 2);
        this._renderSeamToContext(ctx);
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

        if (this.sprite && typeof ctx.drawImage === 'function') {
          const sw = this.sprite.width || (this.radius * 2);
          const sh = this.sprite.height || (this.radius * 2);
          ctx.drawImage(this.sprite, -sw / 2, -sh / 2, sw, sh);
        } else {
          ctx.fillStyle = '#3b0764';
          ctx.beginPath();
          if (typeof ctx.arc === 'function') {
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
          } else if (typeof ctx.rect === 'function') {
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
        const chordHalfLen = Math.sqrt(Math.max(0, rSq - dPerpSq));
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
      const tumbleBase = 5.0 + Math.random() * 4.0;
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
