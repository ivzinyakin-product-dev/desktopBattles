/**
 * Tensa Zangetsu: Soul Altar Defense - Soul Altar Entity
 * 
 * Central defense objective with 100 HP, 36px collision radius,
 * 4 health states, batch damage clamping, and player damage immunity.
 */

(function (global) {
  'use strict';

  class SoulAltar {
    /**
     * @param {number} [x=640] - World X center
     * @param {number} [y=360] - World Y center
     * @param {Object} [options={}] - Optional dependencies
     */
    constructor(x = 640, y = 360, options = {}) {
      this.x = Number.isFinite(x) ? x : 640;
      this.y = Number.isFinite(y) ? y : 360;
      this.radius = 36;
      this.maxHp = 100;
      this.hp = 100;
      this.pulseTimer = 0;
      this.pulseScale = 1.0;
      this.lastHitTimer = 0;
      this.particleSystem = options.particleSystem || (global.TZ && global.TZ.defaultParticleSystem) || null;
      this.audio = options.audioSynth || (global.TZ && global.TZ.defaultAudioSynth) || null;
      this.camera = options.camera || null;
    }

    /**
     * Take damage from enemy contact or Cero beam.
     * Rejects negative damage (anti-heal exploit).
     * @param {number} amount
     * @returns {boolean} Whether damage was dealt
     */
    takeDamage(amount) {
      if (typeof amount !== 'number' || amount <= 0 || this.hp <= 0) {
        return false;
      }
      this.hp = Math.max(0, this.hp - amount);
      this.lastHitTimer = 0.25;

      if (this.camera && typeof this.camera.addTrauma === 'function') {
        this.camera.addTrauma(Math.min(0.6, amount * 0.015));
      }
      if (this.audio && typeof this.audio.playAltarHit === 'function') {
        this.audio.playAltarHit();
      }
      if (this.particleSystem && typeof this.particleSystem.spawnEmbers === 'function') {
        this.particleSystem.spawnEmbers(this.x, this.y, Math.min(20, Math.ceil(amount * 0.5)), 0, '#00e5ff');
      }

      return true;
    }

    /**
     * Caps simultaneous multi-enemy batch damage to max 30 per frame.
     * @param {number} amount
     * @returns {number} Actual damage dealt
     */
    takeBatchDamage(amount) {
      if (typeof amount !== 'number' || amount <= 0) return 0;
      const capped = Math.min(30, amount);
      this.takeDamage(capped);
      return capped;
    }

    /**
     * Strict Damage Exclusivity: Player slashes and projectiles deal ZERO damage to Altar.
     * @param {number} amount
     */
    takePlayerDamage(amount) {
      // Intentionally does nothing - protects Altar from friendly fire
      return false;
    }

    /**
     * Wave clear restoration restores up to specified amount, capped at maxHp (100).
     * @param {number} amount
     * @returns {number} Actual health restored
     */
    restoreHealth(amount) {
      if (typeof amount !== 'number' || amount <= 0 || this.hp <= 0) return 0;
      const prev = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + amount);
      return this.hp - prev;
    }

    /**
     * Returns current state based on HP percentage:
     * - INTACT: >= 75 HP
     * - DAMAGED: 40 - 74 HP
     * - CRITICAL: 1 - 39 HP
     * - DESTROYED: <= 0 HP
     * @returns {'INTACT'|'DAMAGED'|'CRITICAL'|'DESTROYED'}
     */
    getState() {
      if (this.hp >= 75) return 'INTACT';
      if (this.hp >= 40) return 'DAMAGED';
      if (this.hp > 0) return 'CRITICAL';
      return 'DESTROYED';
    }

    /**
     * Whether the Altar has been destroyed.
     * @returns {boolean}
     */
    isDestroyed() {
      return this.hp <= 0;
    }

    /**
     * Resets Altar health and visual states for replay.
     */
    reset() {
      this.hp = this.maxHp;
      this.pulseTimer = 0;
      this.lastHitTimer = 0;
    }

    /**
     * Update visual pulsation and timers.
     * @param {number} dt
     */
    update(dt) {
      this.pulseTimer += dt * 3.0;
      this.pulseScale = 1.0 + Math.sin(this.pulseTimer) * 0.04;
      if (this.lastHitTimer > 0) {
        this.lastHitTimer = Math.max(0, this.lastHitTimer - dt);
      }
    }

    /**
     * Draw Altar to canvas context.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} [SpriteGen]
     */
    draw(ctx, SpriteGen) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(this.x, this.y);

      const state = this.getState();
      let auraColor = 'rgba(0, 229, 255, 0.25)'; // Cyan Reiatsu
      let coreColor = '#00e5ff';
      if (state === 'DAMAGED') {
        auraColor = 'rgba(234, 179, 8, 0.3)'; // Amber
        coreColor = '#eab308';
      } else if (state === 'CRITICAL') {
        auraColor = 'rgba(239, 68, 68, 0.45)'; // Crimson alert
        coreColor = '#ef4444';
      } else if (state === 'DESTROYED') {
        auraColor = 'rgba(100, 100, 100, 0.2)';
        coreColor = '#52525b';
      }

      // Outer protective spiritual barrier dome
      if (state !== 'DESTROYED') {
        ctx.beginPath();
        ctx.arc(0, 0, (this.radius + 14) * this.pulseScale, 0, Math.PI * 2);
        ctx.fillStyle = auraColor;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = coreColor;
        ctx.stroke();
      }

      // Base RotMG pixel art altar sprite or procedural fallback
      let spriteCanvas = null;
      if (SpriteGen && typeof SpriteGen.getSprite === 'function') {
        try {
          spriteCanvas = SpriteGen.getSprite('altar');
        } catch (e) {
          spriteCanvas = null;
        }
      }

      if (spriteCanvas && typeof ctx.drawImage === 'function') {
        const size = 64;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spriteCanvas, -size / 2, -size / 2, size, size);
      } else {
        // Procedural Altar column with spiritual gem
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#18181b';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#27272a';
        ctx.stroke();

        // Inner glowing soul core
        ctx.beginPath();
        ctx.arc(0, 0, 16 * this.pulseScale, 0, Math.PI * 2);
        ctx.fillStyle = coreColor;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      // Hit flash overlay
      if (this.lastHitTimer > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${this.lastHitTimer * 2})`;
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // Universal Module Export
  global.TZ = global.TZ || {};
  global.TZ.SoulAltar = SoulAltar;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SoulAltar };
  }
})(typeof window !== 'undefined' ? window : global);
