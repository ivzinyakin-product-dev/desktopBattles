/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/game/Katana.js
 * 
 * Tensa Zangetsu Katana Controller & Combat Subsystem.
 * 
 * Features:
 * - Exponential hilt smoothing (lambda = 50 s^-1) tracking mouse input
 * - K=5 velocity ring buffer calculating moving average velocity, speed, angular velocity
 * - Dual-stance dynamic blade orientation (radial ready stance vs high-velocity cutting stance with +0.35 rad rake)
 * - Continuous Collision Detection (CCD) via SweptQuad volume factory
 * - Dual-composite Getsuga Tensho ribbon trail (screen blend dilated crimson glow + 4px jet-black razor core)
 * - 8-node Verlet chained pommel tassel with distance relaxation physics
 * - Left-click Forced Slash ("Senka" 240-degree ease-out cubic arc slash with camera trauma)
 * - Right-click / Spacebar Crescent Getsuga Tensho wave projectile management
 * 
 * Universal Modular Pattern (Browser window.TZ & Node.js CommonJS).
 */
(function (global) {
  'use strict';

  // Acquire engine and projectile dependencies defensively
  const Vector2 = (global.TZ && global.TZ.Vector2) || 
    (typeof require === 'function' ? require('../engine/Vector2.js') : null);
  const SweptQuad = (global.TZ && global.TZ.SweptQuad) || 
    (Vector2 ? Vector2.SweptQuad : null);
  const GetsugaWave = (global.TZ && (global.TZ.GetsugaWave || global.TZ.Projectile)) || 
    (typeof require === 'function' ? require('./Projectile.js') : null);

  class Katana {
    /**
     * @param {number|Object} [altarX=640] Altar X coordinate or configuration options object
     * @param {number} [altarY=360] Altar Y coordinate
     * @param {Object} [options={}] Additional options
     */
    constructor(altarX = 640, altarY = 360, options = {}) {
      let ax = 640;
      let ay = 360;
      let opts = {};

      if (typeof altarX === 'object' && altarX !== null) {
        opts = altarX;
        ax = typeof opts.altarX === 'number' ? opts.altarX : (opts.x || 640);
        ay = typeof opts.altarY === 'number' ? opts.altarY : (opts.y || 360);
      } else {
        ax = typeof altarX === 'number' ? altarX : 640;
        ay = typeof altarY === 'number' ? altarY : 360;
        if (typeof options === 'object' && options !== null) {
          opts = options;
        }
      }

      this.altarPos = { x: ax, y: ay };
      this.camera = opts.camera || null;
      this.particleSystem = opts.particleSystem || null;

      // Blade & Hilt Geometry
      this.bladeLength = 85; // 85px hilt-to-tip
      this.hiltLength = 22;  // 22px hilt-to-pommel anchor

      // Positions
      this.hilt = { x: ax + 100, y: ay };
      this.prevHilt = { x: this.hilt.x, y: this.hilt.y };
      this.angle = 0;
      this.prevAngle = 0;
      this.tip = { x: this.hilt.x + this.bladeLength, y: this.hilt.y };
      this.prevTip = { x: this.tip.x, y: this.tip.y };
      this.pommel = { x: this.hilt.x - this.hiltLength, y: this.hilt.y };

      // Target mouse coordinate
      this.targetMouse = { x: this.hilt.x, y: this.hilt.y };

      // Kinematics & Tuning Constants
      this.smoothingLambda = 50.0;       // s^-1 (sub-10ms responsiveness)
      this.slashThreshold = 280.0;       // px/s (cutting stance threshold)
      this.ceroDeflectThreshold = 450.0; // px/s (cero beam deflection threshold)
      this.forwardRakeAngle = 0.35;      // rad (~20 degrees forward cutting tilt)

      this.speed = 0;
      this.velocity = { x: 0, y: 0 };
      this.angularVelocity = 0;

      // K=5 Velocity Ring Buffer
      this.velHistory = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ];
      this.velIndex = 0;

      // Feature 9: Dual-Composite Getsuga Trail
      this.trail = [];
      this.coreWidth = 4;
      this.trailLifespan = 0.24; // 240ms lifespan

      // Feature 10: Chained Tassel (Verlet Physics)
      this.tasselCount = 8;
      this.restLength = 5;
      this.chainRestLength = 5;
      this.gravity = 280; // 280 px/s^2
      this.damping = 0.05;
      this.constraintIterations = 6;
      this.tasselNodes = [];
      this.initTassel(this.pommel);

      // Feature 11: Left-Click Forced Slash ("Senka" Arc)
      this.isForcedSlashing = false;
      this.forcedSlashActive = false;
      this.forcedSlashTimer = 0.0;
      this.forcedSlashDuration = 0.150; // 150ms
      this.forcedSlashCooldown = 0.35;  // 0.35s
      this.forcedSlashCooldownTimer = 0.0;
      this.forcedSlashStartAngle = 0.0;
      this.forcedSlashSweepAngle = (4 * Math.PI) / 3; // 240 degrees
      this.forcedSlashRadius = 100;     // 100px sweep radius
      this.forcedSlashDamageMult = 1.5; // 1.5x damage
      this.forcedSlashTrauma = 0.25;    // +0.25 camera trauma

      // Feature 12: Crescent Getsuga Wave Projectiles
      this.projectiles = [];
      this.crescentCooldown = 1.8;      // 1.8s
      this.crescentCooldownTimer = 0.0;
    }

    // Property Aliases & Compatibility Getters
    get speed() { return this._speed; }
    set speed(val) {
      this._speed = typeof val === 'number' && !Number.isNaN(val) ? val : 0;
      if (this._speed > 0 && Math.hypot(this.velocity.x, this.velocity.y) < 1e-4) {
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        this.velocity.x = cos * this._speed;
        this.velocity.y = sin * this._speed;
      }
    }
    get trailNodes() { return this.trail; }
    set trailNodes(val) { this.trail = val; }
    get chainNodes() { return this.tasselNodes; }
    set chainNodes(val) { this.tasselNodes = val; }

    /**
     * Mouse coordinate update listener
     * Clamps cursor to virtual canvas dimensions [0, 1280] x [0, 720].
     * @param {number|Object} xOrEvent 
     * @param {number} [y] 
     */
    onMouseMove(xOrEvent, y) {
      let mx = xOrEvent;
      let my = y;
      if (xOrEvent && typeof xOrEvent === 'object') {
        mx = typeof xOrEvent.offsetX === 'number' ? xOrEvent.offsetX : xOrEvent.clientX;
        my = typeof xOrEvent.offsetY === 'number' ? xOrEvent.offsetY : xOrEvent.clientY;
      }
      if (typeof mx === 'number' && !Number.isNaN(mx)) {
        this.targetMouse.x = Math.max(0, Math.min(1280, mx));
      }
      if (typeof my === 'number' && !Number.isNaN(my)) {
        this.targetMouse.y = Math.max(0, Math.min(720, my));
      }
    }

    /**
     * Helper to compute speed magnitude from velocity components
     * @param {number} vx 
     * @param {number} vy 
     * @returns {number}
     */
    computeSpeed(vx, vy) {
      return Math.hypot(vx, vy);
    }

    /**
     * Query whether katana is currently slashing (speed >= 280 px/s or in forced slash)
     * @returns {boolean}
     */
    isSlashing() {
      return this.isForcedSlashing || this.speed >= this.slashThreshold;
    }

    /**
     * Query whether blade speed is sufficient to deflect Cero beam (>= 450 px/s or in forced slash)
     * @returns {boolean}
     */
    canDeflectCero() {
      return this.isForcedSlashing || this.speed >= this.ceroDeflectThreshold;
    }

    /**
     * Explicitly update idle ready stance facing outward from altar
     * @param {number} [altarX=640] 
     * @param {number} [altarY=360] 
     */
    updateStance(altarX = 640, altarY = 360) {
      this.altarPos.x = altarX;
      this.altarPos.y = altarY;
      const dx = this.hilt.x - altarX;
      const dy = this.hilt.y - altarY;
      if (Math.hypot(dx, dy) > 1e-4) {
        this.angle = Math.atan2(dy, dx);
      }
      this._updateTipAndPommel();
    }

    /**
     * Triggers Left-Click Forced Slash ("Senka" 240-degree rapid arc).
     * @returns {boolean} True if triggered, false if on cooldown
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

      // Add camera trauma (+0.25)
      const cam = this.camera || (global.TZ && global.TZ.camera);
      if (cam && typeof cam.addTrauma === 'function') {
        cam.addTrauma(this.forcedSlashTrauma);
      }

      // Burst of Reiatsu embers
      const ps = this.particleSystem || (global.TZ && global.TZ.particleSystem);
      if (ps && typeof ps.spawnEmbers === 'function') {
        ps.spawnEmbers(this.hilt.x, this.hilt.y, 16, this.angle, '#ff0033');
      }

      return true;
    }

    /**
     * Triggers Right-Click / Spacebar Crescent Getsuga Tensho Wave Projectile.
     * @param {number} [originX] 
     * @param {number} [originY] 
     * @param {number} [dirX] 
     * @param {number} [dirY] 
     * @returns {boolean} True if spawned, false if on cooldown
     */
    triggerCrescentWave(originX, originY, dirX, dirY) {
      if (this.crescentCooldownTimer > 0) {
        return false;
      }

      const ox = typeof originX === 'number' ? originX : this.tip.x;
      const oy = typeof originY === 'number' ? originY : this.tip.y;

      let dx, dy;
      let customSpeed;

      if (typeof dirX === 'number' && typeof dirY === 'number') {
        const len = Math.hypot(dirX, dirY);
        if (len > 1e-6) {
          dx = dirX / len;
          dy = dirY / len;
          if (len > 1.5) {
            customSpeed = len;
          }
        } else {
          // Zero direction vector explicitly passed
          dx = 0;
          dy = 0;
          customSpeed = 0;
        }
      } else {
        dx = Math.cos(this.angle);
        dy = Math.sin(this.angle);
      }

      const WaveClass = (global.TZ && (global.TZ.GetsugaWave || global.TZ.Projectile)) || GetsugaWave;
      if (!WaveClass) {
        return false;
      }

      const wave = new WaveClass(ox, oy, dx, dy, {
        particleSystem: this.particleSystem,
        speed: customSpeed
      });

      this.projectiles.push(wave);
      this.crescentCooldownTimer = this.crescentCooldown; // 1.8s
      return true;
    }

    /**
     * Alias for triggerCrescentWave
     */
    fireGetsugaWave(originX, originY, dirX, dirY) {
      return this.triggerCrescentWave(originX, originY, dirX, dirY);
    }

    /**
     * Returns Reiatsu gauge ratio [0, 1] for HUD
     * @returns {number}
     */
    getReiatsuGauge() {
      if (this.crescentCooldownTimer <= 0) return 1.0;
      return Math.max(0, 1.0 - this.crescentCooldownTimer / this.crescentCooldown);
    }

    /**
     * Initializes the 8-node Verlet tassel chain
     * @param {{x:number, y:number}} [pommelPos] 
     */
    initTassel(pommelPos) {
      this.tasselNodes = [];
      const startX = pommelPos ? pommelPos.x : (this.pommel ? this.pommel.x : this.hilt.x);
      const startY = pommelPos ? pommelPos.y : (this.pommel ? this.pommel.y : this.hilt.y);

      for (let i = 0; i < this.tasselCount; i++) {
        this.tasselNodes.push({
          x: startX,
          y: startY + i * this.restLength,
          oldX: startX,
          oldY: startY + i * this.restLength,
          pinned: (i === 0)
        });
      }
    }

    /**
     * Fixed-timestep physics update
     * @param {number} dt Delta time in seconds
     * @param {number} [altarX] Optional altar X coordinate
     * @param {number} [altarY] Optional altar Y coordinate
     */
    update(dt, altarX, altarY) {
      if (typeof altarX === 'number' && typeof altarY === 'number') {
        this.altarPos.x = altarX;
        this.altarPos.y = altarY;
      }

      if (!dt || dt <= 0 || Number.isNaN(dt)) {
        return;
      }

      // 1. Record previous state
      this.prevHilt.x = this.hilt.x;
      this.prevHilt.y = this.hilt.y;
      this.prevTip.x = this.tip.x;
      this.prevTip.y = this.tip.y;
      this.prevAngle = this.angle;

      // 2. Cooldown decays
      if (this.forcedSlashCooldownTimer > 0) {
        this.forcedSlashCooldownTimer = Math.max(0, this.forcedSlashCooldownTimer - dt);
      }
      if (this.crescentCooldownTimer > 0) {
        this.crescentCooldownTimer = Math.max(0, this.crescentCooldownTimer - dt);
      }

      // 3. Exponential hilt smoothing (lambda = 50 s^-1)
      const alpha = 1.0 - Math.exp(-this.smoothingLambda * dt);
      this.hilt.x += (this.targetMouse.x - this.hilt.x) * alpha;
      this.hilt.y += (this.targetMouse.y - this.hilt.y) * alpha;

      // 4. Instantaneous velocity & K=5 Ring Buffer
      const instVx = (this.hilt.x - this.prevHilt.x) / dt;
      const instVy = (this.hilt.y - this.prevHilt.y) / dt;

      if (Math.abs(instVx) > 1e-4 || Math.abs(instVy) > 1e-4) {
        this.velHistory[this.velIndex] = { x: instVx, y: instVy };
        this.velIndex = (this.velIndex + 1) % this.velHistory.length;

        let sumVx = 0;
        let sumVy = 0;
        for (let i = 0; i < this.velHistory.length; i++) {
          sumVx += this.velHistory[i].x;
          sumVy += this.velHistory[i].y;
        }
        this.velocity.x = sumVx / this.velHistory.length;
        this.velocity.y = sumVy / this.velHistory.length;
        this._speed = Math.hypot(this.velocity.x, this.velocity.y);
      } else {
        // Mouse stationary this tick
        if (dt >= 0.04) {
          for (let i = 0; i < this.velHistory.length; i++) {
            this.velHistory[i] = { x: 0, y: 0 };
          }
          this.velocity.x = 0;
          this.velocity.y = 0;
          this._speed = 0;
        }
      }

      if (this._speed < 1e-4) {
        this._speed = 0;
        this.velocity.x = 0;
        this.velocity.y = 0;
      }

      // 5. Orientation Update: Forced Slash vs Dual-Stance Kinematics
      if (this.isForcedSlashing) {
        this.forcedSlashTimer += dt;
        const u = Math.min(1.0, this.forcedSlashTimer / this.forcedSlashDuration);
        const progress = 1 - Math.pow(1 - u, 3); // Ease-out cubic
        this.angle = this.forcedSlashStartAngle + this.forcedSlashSweepAngle * progress;

        const instantOmega = (3 * Math.pow(1 - u, 2) * this.forcedSlashSweepAngle) / this.forcedSlashDuration;
        const instantTipSpeed = instantOmega * this.forcedSlashRadius;
        this.speed = Math.max(this.speed, instantTipSpeed);

        if (this.forcedSlashTimer >= this.forcedSlashDuration) {
          this.isForcedSlashing = false;
          this.forcedSlashActive = false;
          this.forcedSlashTimer = 0.0;
        }
      } else {
        let targetAngle = this.angle;

        if (this.speed < this.slashThreshold) {
          // Ready stance: radially outward from Altar
          const dx = this.hilt.x - this.altarPos.x;
          const dy = this.hilt.y - this.altarPos.y;
          if (Math.hypot(dx, dy) > 1e-4) {
            targetAngle = Math.atan2(dy, dx);
          }
          const diff = Math.atan2(Math.sin(targetAngle - this.angle), Math.cos(targetAngle - this.angle));
          const slerpFactor = 1.0 - Math.exp(-15.0 * dt);
          this.angle += diff * slerpFactor;
        } else {
          // High-velocity cutting stance: align with swing heading + forward rake angle
          const swingHeading = Math.atan2(this.velocity.y, this.velocity.x);
          const headingDiff = Math.atan2(Math.sin(swingHeading - this.prevAngle), Math.cos(swingHeading - this.prevAngle));
          const estOmega = headingDiff / dt;

          const rake = (estOmega !== 0) ? Math.sign(estOmega) * this.forwardRakeAngle : this.forwardRakeAngle;
          targetAngle = swingHeading + rake;

          const diff = Math.atan2(Math.sin(targetAngle - this.angle), Math.cos(targetAngle - this.angle));
          const alignFactor = 1.0 - Math.exp(-25.0 * dt);
          this.angle += diff * alignFactor;
        }
      }

      // 6. Angular velocity calculation
      this.angularVelocity = Math.atan2(Math.sin(this.angle - this.prevAngle), Math.cos(this.angle - this.prevAngle)) / dt;

      // 7. Tip and Pommel positions
      this._updateTipAndPommel();

      // 8. Dynamic Getsuga Trail Update
      this.updateTrail(dt);

      // 9. Chained Tassel (Verlet Physics) Update
      this.updateTasselPhysics(dt);

      // 10. Projectiles update and lifecycle pruning
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        if (p && typeof p.update === 'function') {
          p.update(dt, this.particleSystem);
          if (p.isDead || (typeof p.life === 'number' && p.life <= 0)) {
            this.projectiles.splice(i, 1);
          }
        }
      }
    }

    /**
     * Recomputes tip and pommel coordinates based on current hilt and angle
     * @private
     */
    _updateTipAndPommel() {
      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);
      const length = this.isForcedSlashing ? this.forcedSlashRadius : this.bladeLength;

      this.tip.x = this.hilt.x + cos * length;
      this.tip.y = this.hilt.y + sin * length;
      this.pommel.x = this.hilt.x - cos * this.hiltLength;
      this.pommel.y = this.hilt.y - sin * this.hiltLength;
    }

    /**
     * Returns the 4 line endpoints for the current and previous blade segment
     * @returns {{hilt: {x:number, y:number}, tip: {x:number, y:number}, prevHilt: {x:number, y:number}, prevTip: {x:number, y:number}}}
     */
    getBladeSegment() {
      return {
        hilt: { x: this.hilt.x, y: this.hilt.y },
        tip: { x: this.tip.x, y: this.tip.y },
        prevHilt: { x: this.prevHilt.x, y: this.prevHilt.y },
        prevTip: { x: this.prevTip.x, y: this.prevTip.y }
      };
    }

    /**
     * Constructs and returns SweptQuad CCD volume for continuous collision detection
     * @returns {SweptQuad|null}
     */
    getSweptQuad() {
      const QuadClass = (global.TZ && global.TZ.SweptQuad) || SweptQuad;
      if (QuadClass && typeof QuadClass.fromBladeSegments === 'function') {
        return QuadClass.fromBladeSegments(this.prevHilt, this.prevTip, this.hilt, this.tip);
      }
      return null;
    }

    /**
     * Updates the dynamic rolling Getsuga trail buffer
     * @param {number} dt 
     */
    updateTrail(dt) {
      // 1. Age existing trail samples
      for (let i = 0; i < this.trail.length; i++) {
        this.trail[i].age += dt;
      }
      // 2. Filter out expired samples (> 240ms)
      this.trail = this.trail.filter(s => s.age < (s.maxAge || this.trailLifespan));

      // 3. Capture new sample when blade is moving or slashing
      const isMoving = this.isForcedSlashing || this.speed >= 120;
      if (isMoving) {
        this.trail.unshift({
          tipX: this.tip.x,
          tipY: this.tip.y,
          hiltX: this.hilt.x,
          hiltY: this.hilt.y,
          age: 0,
          maxAge: this.trailLifespan,
          speed: this.speed
        });
        if (this.trail.length > 16) {
          this.trail.length = 16;
        }

        // Emit trailing Reiatsu embers during active swing
        if (this.isSlashing()) {
          const ps = this.particleSystem || (global.TZ && global.TZ.particleSystem);
          if (ps && typeof ps.spawnEmbers === 'function') {
            const t = 0.7 + Math.random() * 0.3;
            const px = this.hilt.x + (this.tip.x - this.hilt.x) * t;
            const py = this.hilt.y + (this.tip.y - this.hilt.y) * t;
            const emAngle = this.angle + Math.PI + (Math.random() - 0.5) * 0.8;
            ps.spawnEmbers(px, py, 1, emAngle, '#ff0033');
          }
        }
      }
    }

    /**
     * Real-time Verlet integration & constraint relaxation for the chained tassel
     * @param {number} dt 
     */
    updateTasselPhysics(dt) {
      if (!this.tasselNodes || this.tasselNodes.length === 0) {
        this.initTassel(this.pommel);
      }

      const nodes = this.tasselNodes;
      const pommelX = this.pommel.x;
      const pommelY = this.pommel.y;

      // Anchor jump / teleport compensation under extreme mouse flicks
      const anchorDx = pommelX - nodes[0].x;
      const anchorDy = pommelY - nodes[0].y;
      const anchorJump = Math.hypot(anchorDx, anchorDy);
      if (anchorJump > 25) {
        for (let i = 1; i < nodes.length; i++) {
          nodes[i].x += anchorDx;
          nodes[i].y += anchorDy;
          nodes[i].oldX += anchorDx;
          nodes[i].oldY += anchorDy;
        }
      }

      const dtSq = dt * dt;
      const dragFactor = Math.max(0, 1.0 - (this.damping || 0.05));
      const gravityY = this.gravity || 280;

      // 1. Verlet Integration on Free Nodes (1 to 7)
      for (let i = 1; i < nodes.length; i++) {
        const node = nodes[i];
        const vx = (node.x - node.oldX) * dragFactor;
        const vy = (node.y - node.oldY) * dragFactor;

        // Centrifugal acceleration from blade rotation
        const rx = node.x - pommelX;
        const ry = node.y - pommelY;
        const w = this.angularVelocity || 0;
        const wSq = Math.min(w * w, 400);
        const ax = rx * wSq;
        const ay = gravityY + ry * wSq;

        node.oldX = node.x;
        node.oldY = node.y;
        node.x += vx + ax * dtSq;
        node.y += vy + ay * dtSq;
      }

      // 2. Anchor lock Node 0
      nodes[0].x = pommelX;
      nodes[0].y = pommelY;
      nodes[0].oldX = pommelX;
      nodes[0].oldY = pommelY;

      // 3. Distance Constraint Relaxation (Gauss-Seidel)
      const restLen = this.restLength || 5;
      const iterations = Math.max(6, this.constraintIterations || 6);

      for (let it = 0; it < iterations; it++) {
        nodes[0].x = pommelX;
        nodes[0].y = pommelY;

        for (let i = 0; i < nodes.length - 1; i++) {
          const nA = nodes[i];
          const nB = nodes[i + 1];
          const dx = nB.x - nA.x;
          const dy = nB.y - nA.y;
          const dist = Math.hypot(dx, dy);

          if (dist > 1e-6) {
            const diff = (dist - restLen) / dist;
            if (nA.pinned) {
              nB.x -= dx * diff;
              nB.y -= dy * diff;
            } else {
              const offsetX = dx * diff * 0.5;
              const offsetY = dy * diff * 0.5;
              nA.x += offsetX;
              nA.y += offsetY;
              nB.x -= offsetX;
              nB.y -= offsetY;
            }
          }
        }
      }

      // Final anchor lock
      nodes[0].x = pommelX;
      nodes[0].y = pommelY;

      // Hard clamp safety on individual links to prevent violent stretch over 6.5px
      for (let i = 0; i < nodes.length - 1; i++) {
        const nA = nodes[i];
        const nB = nodes[i + 1];
        const dx = nB.x - nA.x;
        const dy = nB.y - nA.y;
        const dist = Math.hypot(dx, dy);
        if (dist > restLen * 1.3) {
          const scale = (restLen * 1.25) / dist;
          nB.x = nA.x + dx * scale;
          nB.y = nA.y + dy * scale;
        }
      }
    }

    /**
     * Renders dual-composite dynamic Getsuga Tensho trail
     * @param {CanvasRenderingContext2D} ctx 
     */
    drawTrail(ctx) {
      if (!ctx || !this.trail || this.trail.length < 2) return;

      // PASS 1: Outer Dilated Crimson Aura (Screen Blend)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#ff0033';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < this.trail.length - 1; i++) {
        const s0 = this.trail[i];
        const s1 = this.trail[i + 1];
        const alpha = Math.max(0, 1 - s0.age / s0.maxAge);
        if (alpha <= 0.01) continue;

        // Quad Strip
        ctx.beginPath();
        ctx.moveTo(s0.tipX, s0.tipY);
        ctx.lineTo(s1.tipX, s1.tipY);
        ctx.lineTo(s1.hiltX, s1.hiltY);
        ctx.lineTo(s0.hiltX, s0.hiltY);
        ctx.closePath();

        if (typeof ctx.createLinearGradient === 'function') {
          const grad = ctx.createLinearGradient(s0.tipX, s0.tipY, s0.hiltX, s0.hiltY);
          grad.addColorStop(0, `rgba(255, 0, 51, ${alpha * 0.85})`);
          grad.addColorStop(0.5, `rgba(180, 0, 30, ${alpha * 0.45})`);
          grad.addColorStop(1, `rgba(139, 0, 0, ${alpha * 0.15})`);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Dilated outer tip aura
        ctx.strokeStyle = `rgba(255, 0, 51, ${alpha * 0.9})`;
        ctx.lineWidth = 6 + alpha * 6;
        ctx.beginPath();
        ctx.moveTo(s0.tipX, s0.tipY);
        ctx.lineTo(s1.tipX, s1.tipY);
        ctx.stroke();
      }
      ctx.restore();

      // PASS 2: Inner Pitch-Black Razor Core (Source-Over)
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.lineWidth = this.coreWidth || 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < this.trail.length - 1; i++) {
        const s0 = this.trail[i];
        const s1 = this.trail[i + 1];
        const alpha = Math.max(0, 1 - s0.age / s0.maxAge);
        if (alpha <= 0.01) continue;

        ctx.strokeStyle = `rgba(5, 5, 5, ${alpha * 0.95})`;
        ctx.beginPath();
        ctx.moveTo(s0.tipX, s0.tipY);
        ctx.lineTo(s1.tipX, s1.tipY);
        ctx.stroke();
      }
      ctx.restore();
    }

    /**
     * Renders RotMG pixel-art chained pommel tassel
     * @param {CanvasRenderingContext2D} ctx 
     */
    drawTassel(ctx) {
      if (!ctx || !this.tasselNodes || this.tasselNodes.length < 2) return;

      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // 1. Dark Iron Connecting Link Line
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.tasselNodes[0].x, this.tasselNodes[0].y);
      for (let i = 1; i < this.tasselNodes.length; i++) {
        ctx.lineTo(this.tasselNodes[i].x, this.tasselNodes[i].y);
      }
      ctx.stroke();

      // 2. Metallic 3x3 Pixel Links (Nodes 0 to 6)
      for (let i = 0; i < this.tasselNodes.length - 1; i++) {
        const node = this.tasselNodes[i];
        const px = Math.round(node.x);
        const py = Math.round(node.y);

        // Dark iron border (3x3)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(px - 1, py - 1, 3, 3);

        // Steel body (2x2)
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(px - 1, py - 1, 2, 2);

        // Specular glint highlight (1x1)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 1, py - 1, 1, 1);
      }

      // 3. Terminal Crimson Soul Bead Charm (Node 7)
      const tipNode = this.tasselNodes[this.tasselNodes.length - 1];
      const tpx = Math.round(tipNode.x);
      const tpy = Math.round(tipNode.y);

      // Charm border (4x4)
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(tpx - 2, tpy - 2, 4, 4);

      // Crimson soul gem (3x3)
      ctx.fillStyle = '#ff0033';
      ctx.fillRect(tpx - 1, tpy - 1, 3, 3);

      // Gem glint (1x1)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tpx - 1, tpy - 1, 1, 1);

      ctx.restore();
    }

    /**
     * Master render routine
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
      if (!ctx) return;

      // 1. Trail pass
      this.drawTrail(ctx);

      // 2. Tassel pass
      this.drawTassel(ctx);

      // 3. Katana blade geometry
      ctx.save();
      ctx.translate(this.hilt.x, this.hilt.y);
      ctx.rotate(this.angle);

      // Manji Tsuba (cross guard)
      ctx.fillStyle = '#09090b';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);

      // Pitch-black blade spine
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, -2, this.bladeLength, 3);

      // Razor silver cutting edge
      ctx.fillStyle = '#e4e4e7';
      ctx.fillRect(0, 1, this.bladeLength, 1);

      // Wrapped tsuka hilt
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-this.hiltLength, -2, this.hiltLength, 4);

      // Pommel end cap
      ctx.fillStyle = '#71717a';
      ctx.fillRect(-this.hiltLength, -3, 2, 6);

      ctx.restore();

      // 4. Projectiles pass
      for (let i = 0; i < this.projectiles.length; i++) {
        const p = this.projectiles[i];
        if (p && typeof p.draw === 'function') {
          p.draw(ctx);
        }
      }
    }
  }

  // Universal Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.Katana = Katana;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Katana;
    module.exports.Katana = Katana;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
