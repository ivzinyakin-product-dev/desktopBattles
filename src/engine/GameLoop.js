/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/engine/GameLoop.js
 * 
 * 120Hz Fixed Timestep Accumulator Game Loop.
 * Decouples physics substepping from display refresh (rAF).
 * Zero external dependencies. Browser & Node.js compatible.
 */
(function (global) {
  'use strict';

  class GameLoop {
    /**
     * @param {Object} [options={}]
     * @param {function(number): void} [options.update] Physics update callback (dt)
     * @param {function(number): void} [options.render] Render callback (alpha)
     * @param {number} [options.targetFps=120] Target physics frequency in Hz
     * @param {number} [options.maxAccumulator=0.1] Maximum accumulator clamp in seconds (prevents spiral of death)
     */
    constructor(options = {}) {
      this.targetFps = options.targetFps || 120;
      this.dt = 1 / this.targetFps; // Default 1/120 = ~0.008333s
      this.fixedStep = this.dt;
      this.FIXED_STEP = this.dt;
      this.maxAccumulator = typeof options.maxAccumulator === 'number' ? options.maxAccumulator : 0.1;

      this.onUpdate = typeof options.update === 'function' ? options.update : (() => {});
      this.onRender = typeof options.render === 'function' ? options.render : (() => {});

      this.accumulator = 0;
      this.lastTime = 0;
      this.isRunning = false;
      this.isPaused = false;

      this._rafId = null;
      this._boundStep = this._step.bind(this);

      // Performance and diagnostics metrics
      this.fps = 0;
      this.tps = 0; // Ticks per second
      this.totalTicks = 0;
      this.totalFrames = 0;
      this._fpsFrameCount = 0;
      this._fpsTickCount = 0;
      this._lastFpsUpdate = 0;
    }

    /**
     * Starts the game loop
     */
    start() {
      if (this.isRunning) return;

      this.isRunning = true;
      this.isPaused = false;
      this.accumulator = 0;

      const now = this._getTimestamp();
      this.lastTime = now;
      this._lastFpsUpdate = now;
      this._fpsFrameCount = 0;
      this._fpsTickCount = 0;

      this._scheduleNext();
    }

    /**
     * Stops the game loop and cancels scheduled frames
     */
    stop() {
      this.isRunning = false;
      if (this._rafId !== null) {
        if (typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(this._rafId);
        } else if (typeof clearTimeout === 'function') {
          clearTimeout(this._rafId);
        }
        this._rafId = null;
      }
    }

    /**
     * Pauses simulation updates (keeps render alive if requested)
     */
    pause() {
      this.isPaused = true;
    }

    /**
     * Resumes simulation updates without delta surge
     */
    resume() {
      if (!this.isPaused) return;
      this.isPaused = false;
      this.lastTime = this._getTimestamp();
      this.accumulator = 0;
    }

    /**
     * Computes the interpolation factor alpha in [0, 1)
     * @returns {number}
     */
    getAlpha() {
      return Math.max(0, Math.min(1, this.accumulator / this.dt));
    }

    /**
     * Deterministic manual stepping for automated headless test suites.
     * Executes fixed substeps for elapsedSeconds without relying on clock.
     * @param {number} elapsedSeconds 
     * @returns {{ticks: number, alpha: number}}
     */
    step(elapsedSeconds) {
      return this.tickManual(elapsedSeconds);
    }

    /**
     * Deterministic manual stepping for automated headless test suites.
     * Executes fixed substeps for elapsedSeconds without relying on clock.
     * @param {number} elapsedSeconds 
     * @returns {{ticks: number, alpha: number}}
     */
    tickManual(elapsedSeconds) {
      let frameTime = elapsedSeconds;
      if (frameTime < 0 || isNaN(frameTime)) frameTime = 0;
      if (frameTime > this.maxAccumulator) {
        frameTime = this.maxAccumulator;
      }

      let ticksExecuted = 0;
      if (!this.isPaused) {
        this.accumulator += frameTime;

        while (this.accumulator >= this.dt) {
          this.onUpdate(this.dt);
          this.accumulator -= this.dt;
          this.totalTicks++;
          ticksExecuted++;
        }
      }

      const alpha = this.getAlpha();
      this.onRender(alpha);
      this.totalFrames++;

      return { ticks: ticksExecuted, alpha };
    }

    /**
     * Internal animation frame execution step
     * @private
     */
    _step() {
      if (!this.isRunning) return;

      const now = this._getTimestamp();
      let frameTime = now - this.lastTime;
      this.lastTime = now;

      // Guard against negative delta (e.g. system clock adjustment)
      if (frameTime < 0 || isNaN(frameTime)) frameTime = 0;

      // Spiral of death prevention: clamp frame delta
      if (frameTime > this.maxAccumulator) {
        frameTime = this.maxAccumulator;
      }

      if (!this.isPaused) {
        this.accumulator += frameTime;

        // Substep physics at fixed dt
        while (this.accumulator >= this.dt) {
          this.onUpdate(this.dt);
          this.accumulator -= this.dt;
          this.totalTicks++;
          this._fpsTickCount++;
        }
      }

      // Compute interpolation factor alpha between 0 and 1
      const alpha = this.getAlpha();

      // Render interpolated frame
      this.onRender(alpha);
      this.totalFrames++;
      this._fpsFrameCount++;

      // Update rolling FPS / TPS every 1 second
      if (now - this._lastFpsUpdate >= 1.0) {
        this.fps = this._fpsFrameCount / (now - this._lastFpsUpdate);
        this.tps = this._fpsTickCount / (now - this._lastFpsUpdate);
        this._fpsFrameCount = 0;
        this._fpsTickCount = 0;
        this._lastFpsUpdate = now;
      }

      this._scheduleNext();
    }

    /**
     * Schedules the next frame using requestAnimationFrame or timer fallback
     * @private
     */
    _scheduleNext() {
      if (!this.isRunning) return;

      if (typeof requestAnimationFrame === 'function') {
        this._rafId = requestAnimationFrame(this._boundStep);
      } else if (typeof setImmediate === 'function') {
        this._rafId = setImmediate(this._boundStep);
      } else {
        this._rafId = setTimeout(this._boundStep, 1000 / 60);
      }
    }

    /**
     * Gets high-precision current time in seconds
     * @private
     * @returns {number}
     */
    _getTimestamp() {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now() / 1000;
      }
      return Date.now() / 1000;
    }
  }

  // Universal Modular Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.GameLoop = GameLoop;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameLoop;
    module.exports.GameLoop = GameLoop;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
