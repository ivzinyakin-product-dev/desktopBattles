/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/engine/Camera.js
 * 
 * Non-linear Trauma-Squared Screen Shake & Viewport Transformation Engine.
 * Zero external dependencies. Browser & Node.js compatible.
 */
(function (global) {
  'use strict';

  class Camera {
    /**
     * @param {Object} [options]
     * @param {number} [options.width=1280] Virtual canvas width
     * @param {number} [options.height=720] Virtual canvas height
     * @param {number} [options.decayRate=1.8] Trauma decay rate per second
     * @param {number} [options.maxOffsetX=16] Maximum translation displacement X in pixels
     * @param {number} [options.maxOffsetY=16] Maximum translation displacement Y in pixels
     * @param {number} [options.maxAngle=0.045] Maximum rotational displacement in radians (~2.58 deg)
     */
    constructor(options = {}) {
      this.width = options.width || 1280;
      this.height = options.height || 720;
      this.decayRate = typeof options.decayRate === 'number' ? options.decayRate : 1.8;
      this.maxOffsetX = options.maxOffsetX || 16;
      this.maxOffsetY = options.maxOffsetY || 16;
      this.maxAngle = options.maxAngle || 0.045;

      this.trauma = 0.0;
      this.time = 0.0;
      this.offsetX = 0.0;
      this.offsetY = 0.0;
      this.angle = 0.0;
      this.centerX = this.width / 2;
      this.centerY = this.height / 2;
      this.isShaking = false;
      this._savedState = false;
    }

    /**
     * Shorthand getters for x and y offset
     */
    get x() {
      return this.offsetX;
    }

    get y() {
      return this.offsetY;
    }

    /**
     * Returns current displacement offset
     * @returns {{x: number, y: number}}
     */
    getOffset() {
      return { x: this.offsetX, y: this.offsetY };
    }

    /**
     * Adds trauma to camera, clamped to [0.0, 1.0].
     * @param {number} amount
     */
    addTrauma(amount) {
      if (typeof amount !== 'number' || isNaN(amount)) return;
      this.trauma = Math.max(0.0, Math.min(1.0, this.trauma + amount));
    }

    /**
     * Sets trauma to specific value clamped to [0.0, 1.0].
     * @param {number} amount
     */
    setTrauma(amount) {
      if (typeof amount !== 'number' || isNaN(amount)) return;
      this.trauma = Math.max(0.0, Math.min(1.0, amount));
    }

    /**
     * Quadratic shake intensity: S = T^2
     */
    get shakeIntensity() {
      return this.trauma * this.trauma;
    }

    /**
     * Getter method for shake intensity (compatible with tests checking getShakeIntensity)
     * @returns {number}
     */
    getShakeIntensity() {
      return this.trauma * this.trauma;
    }

    /**
     * Advances shake simulation and decays trauma.
     * @param {number} dt Delta time in seconds
     */
    update(dt) {
      if (dt <= 0 || isNaN(dt)) return;
      this.time += dt;

      // Linear trauma decay
      this.trauma = Math.max(0.0, this.trauma - this.decayRate * dt);

      if (this.trauma > 0.0001) {
        const shake = this.trauma * this.trauma;
        // Non-commensurate harmonic noise for smooth organic camera tremor
        const nX = Math.sin(105 * this.time) * 0.7 + Math.sin(187 * this.time) * 0.3;
        const nY = Math.cos(125 * this.time) * 0.7 + Math.cos(213 * this.time) * 0.3;
        const nA = Math.sin(85 * this.time) * 0.8 + Math.cos(143 * this.time) * 0.2;

        this.offsetX = shake * this.maxOffsetX * nX;
        this.offsetY = shake * this.maxOffsetY * nY;
        this.angle = shake * this.maxAngle * nA;
        this.isShaking = true;
      } else {
        this.trauma = 0.0;
        this.offsetX = 0.0;
        this.offsetY = 0.0;
        this.angle = 0.0;
        this.isShaking = false;
      }
    }

    /**
     * Applies camera transformation to canvas 2D rendering context.
     * Saves context state before applying transformation.
     * @param {CanvasRenderingContext2D} ctx
     */
    apply(ctx) {
      if (!ctx) return;
      ctx.save();
      this._savedState = true;
      ctx.translate(this.centerX + this.offsetX, this.centerY + this.offsetY);
      ctx.rotate(this.angle);
      ctx.translate(-this.centerX, -this.centerY);
    }

    /**
     * Alias for apply(ctx)
     * @param {CanvasRenderingContext2D} ctx
     */
    applyShake(ctx) {
      this.apply(ctx);
    }

    /**
     * Restores canvas context state to pre-shake orientation.
     * @param {CanvasRenderingContext2D} ctx
     */
    restore(ctx) {
      if (!ctx) return;
      if (this._savedState) {
        ctx.restore();
        this._savedState = false;
      }
    }

    /**
     * Convenience wrapper: applies transformation, runs render callback, and restores.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Function} renderCallback
     */
    shake(ctx, renderCallback) {
      this.apply(ctx);
      try {
        if (typeof renderCallback === 'function') {
          renderCallback(ctx);
        }
      } finally {
        this.restore(ctx);
      }
    }

    /**
     * Maps screen-space coordinates (e.g. mouse cursor) to world-space coordinates.
     * @param {number} screenX
     * @param {number} screenY
     * @returns {{x: number, y: number}}
     */
    screenToWorld(screenX, screenY) {
      if (!this.isShaking) {
        return { x: screenX, y: screenY };
      }
      const dx = screenX - (this.centerX + this.offsetX);
      const dy = screenY - (this.centerY + this.offsetY);
      const cosA = Math.cos(-this.angle);
      const sinA = Math.sin(-this.angle);
      return {
        x: this.centerX + (dx * cosA - dy * sinA),
        y: this.centerY + (dx * sinA + dy * cosA)
      };
    }

    /**
     * Maps world-space coordinates to screen-space coordinates.
     * @param {number} worldX
     * @param {number} worldY
     * @returns {{x: number, y: number}}
     */
    worldToScreen(worldX, worldY) {
      if (!this.isShaking) {
        return { x: worldX, y: worldY };
      }
      const dx = worldX - this.centerX;
      const dy = worldY - this.centerY;
      const cosA = Math.cos(this.angle);
      const sinA = Math.sin(this.angle);
      return {
        x: this.centerX + this.offsetX + (dx * cosA - dy * sinA),
        y: this.centerY + this.offsetY + (dx * sinA + dy * cosA)
      };
    }

    /**
     * Instantly resets camera trauma, time, and transformation offsets.
     */
    reset() {
      this.trauma = 0.0;
      this.time = 0.0;
      this.offsetX = 0.0;
      this.offsetY = 0.0;
      this.angle = 0.0;
      this.isShaking = false;
      this._savedState = false;
    }
  }

  // Universal Modular Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.Camera = Camera;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Camera;
    module.exports.Camera = Camera;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
