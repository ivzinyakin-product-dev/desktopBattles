/**
 * Tensa Zangetsu: Soul Altar Defense - Score & Combo Manager
 * 
 * Tracks player score, kill count, survival time, cleave bonuses,
 * Bleach rank titles, and decaying combo multiplier ladder (D to SSS).
 */

(function (global) {
  'use strict';

  class ScoreManager {
    constructor() {
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.comboTimer = 0;
      this.comboDuration = 2.0; // 2.0 seconds window
      this.kills = 0;
      this.survivalTime = 0;
      this.cleaves = 0;
    }

    /**
     * Base score points per enemy archetype.
     * @param {string} type
     * @returns {number}
     */
    getBasePoints(type) {
      const t = (type || '').toLowerCase();
      switch (t) {
        case 'crawler': return 100;
        case 'flyer': return 150;
        case 'brute': return 300;
        case 'menos': return 1500;
        default: return 100;
      }
    }

    /**
     * Combo multiplier ladder:
     * - D:   1.0x (combo 0 - 4)
     * - C:   1.5x (combo 5 - 9)
     * - B:   2.0x (combo 10 - 19)
     * - A:   3.0x (combo 20 - 29)
     * - S:   4.5x (combo 30 - 49)
     * - SSS: 6.0x (combo >= 50)
     * @param {number} [comboVal]
     * @returns {number}
     */
    getMultiplier(comboVal) {
      const c = typeof comboVal === 'number' ? comboVal : this.combo;
      if (c >= 50) return 6.0;
      if (c >= 30) return 4.5;
      if (c >= 20) return 3.0;
      if (c >= 10) return 2.0;
      if (c >= 5) return 1.5;
      return 1.0;
    }

    /**
     * Bleach rank titles corresponding to combo tier.
     * @param {number} [comboVal]
     * @returns {string}
     */
    getRankTitle(comboVal) {
      const c = typeof comboVal === 'number' ? comboVal : this.combo;
      if (c >= 50) return 'Mugetsu';
      if (c >= 30) return 'Hollowfied';
      if (c >= 20) return 'Kuroi Getsuga';
      if (c >= 10) return 'Getsuga';
      if (c >= 5) return 'Bankai';
      return 'Shikai';
    }

    /**
     * Add score for eliminating an enemy with combo progression.
     * @param {string} type
     * @returns {number} Points awarded
     */
    addScore(type) {
      const base = this.getBasePoints(type);
      this.combo++;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }
      this.comboTimer = this.comboDuration;

      const mult = this.getMultiplier();
      const awarded = Math.round(base * mult);
      this.score += awarded;
      this.kills++;
      return awarded;
    }

    /**
     * Multi-kill cleave bonus for cutting multiple enemies in a single slash.
     * Formula: (k - 1) * 200 points.
     * @param {number} count
     * @returns {number} Bonus points awarded
     */
    addCleaveBonus(count) {
      if (typeof count !== 'number' || count <= 1) return 0;
      const bonus = (count - 1) * 200;
      this.score += bonus;
      this.cleaves++;
      return bonus;
    }

    /**
     * Update combo timer and survival time.
     * Decays combo to 0 if timer expires.
     * @param {number} dt
     */
    update(dt) {
      if (typeof dt === 'number' && dt > 0) {
        this.survivalTime += dt;
        if (this.combo > 0) {
          this.comboTimer -= dt;
          if (this.comboTimer <= 0) {
            this.combo = 0;
            this.comboTimer = 0;
          }
        }
      }
    }

    /**
     * Resets all metrics for replay.
     */
    reset() {
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.comboTimer = 0;
      this.kills = 0;
      this.survivalTime = 0;
      this.cleaves = 0;
    }
  }

  // Universal Module Export
  global.TZ = global.TZ || {};
  global.TZ.ScoreManager = ScoreManager;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScoreManager };
  }
})(typeof window !== 'undefined' ? window : global);
