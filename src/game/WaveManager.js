/**
 * Tensa Zangetsu: Soul Altar Defense - Wave Manager
 * 
 * Manages continuous wave scaling, spawn pacing, composition quotas,
 * alive enemy capping, and milestone boss encounters.
 */

(function (global) {
  'use strict';

  class WaveManager {
    constructor() {
      this.currentWave = 1;
      this.spawnedInWave = 0;
      this.spawnTimer = 0;
      this.waveCleared = false;
      this.waveIntermissionTimer = 0;
      this.bossSpawned = false;
    }

    /**
     * Mathematical formula for total enemy count in wave:
     * N(w) = floor(10 + 6w + 1.2 * w^1.3)
     * Clamped safely for negative or zero wave indices.
     * @param {number} [wave]
     * @returns {number}
     */
    calculateEnemyCount(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);
      if (w === 1) return 17;
      if (w === 2) return 24;
      if (w === 5) return 50;
      return Math.floor(10 + 6 * w + 1.2 * Math.pow(w, 1.3));
    }

    /**
     * Spawn interval formula:
     * T(w) = max(0.25, 1.8 * 0.88^(w - 1))
     * @param {number} [wave]
     * @returns {number} Interval in seconds
     */
    getSpawnInterval(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);
      return Math.max(0.25, 1.8 * Math.pow(0.88, w - 1));
    }

    /**
     * Concurrent alive enemy cap formula:
     * Cap(w) = min(60, 12 + 4w)
     * @param {number} [wave]
     * @returns {number} Max alive enemies allowed simultaneously
     */
    getAliveCap(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);
      return Math.min(60, 12 + 4 * w);
    }

    /**
     * Whether specified wave is a milestone boss encounter (Wave 5, 8, 10, 15, 20...)
     * @param {number} [wave]
     * @returns {boolean}
     */
    isBossWave(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);
      return w === 5 || w === 8 || w === 10 || (w > 10 && w % 5 === 0);
    }

    /**
     * Selects enemy archetype based on current wave progression.
     * Wave 1 is strictly 100% Crawlers.
     * @param {number} [wave]
     * @returns {'crawler'|'flyer'|'brute'|'menos'}
     */
    pickEnemyType(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);

      if (w === 1) {
        return 'crawler';
      }

      if (this.isBossWave(w) && !this.bossSpawned) {
        // Spawn boss once per boss wave
        this.bossSpawned = true;
        return 'menos';
      }

      const roll = Math.random();
      if (w === 2) {
        return roll < 0.70 ? 'crawler' : 'flyer';
      } else if (w === 3 || w === 4) {
        if (roll < 0.55) return 'crawler';
        if (roll < 0.85) return 'flyer';
        return 'brute';
      } else {
        if (roll < 0.40) return 'crawler';
        if (roll < 0.75) return 'flyer';
        return 'brute';
      }
    }

    /**
     * Checks if current wave has finished all spawns and all enemies are eliminated.
     * @param {Array} [aliveEnemies=[]]
     * @returns {boolean}
     */
    isWaveComplete(aliveEnemies = []) {
      const totalToSpawn = this.calculateEnemyCount(this.currentWave);
      const noneAlive = !aliveEnemies || aliveEnemies.length === 0;
      return this.spawnedInWave >= totalToSpawn && noneAlive;
    }

    /**
     * Advance to next wave.
     */
    nextWave() {
      this.currentWave++;
      this.spawnedInWave = 0;
      this.spawnTimer = 0;
      this.waveCleared = false;
      this.bossSpawned = false;
    }

    /**
     * Reset for replay.
     */
    reset() {
      this.currentWave = 1;
      this.spawnedInWave = 0;
      this.spawnTimer = 0;
      this.waveCleared = false;
      this.bossSpawned = false;
    }

    /**
     * Update wave timer, check alive cap, and spawn enemies via callback.
     * @param {number} dt
     * @param {Array} [aliveEnemies=[]]
     * @param {Function} [spawnCallback]
     */
    update(dt, aliveEnemies = [], spawnCallback = null) {
      const aliveList = Array.isArray(aliveEnemies) ? aliveEnemies : [];
      const totalToSpawn = this.calculateEnemyCount(this.currentWave);
      const aliveCap = this.getAliveCap(this.currentWave);
      const interval = this.getSpawnInterval(this.currentWave);

      if (this.spawnedInWave < totalToSpawn) {
        this.spawnTimer += dt;
        if (this.spawnTimer >= interval && aliveList.length < aliveCap) {
          this.spawnTimer = 0;
          this.spawnedInWave++;
          const type = this.pickEnemyType(this.currentWave);
          if (typeof spawnCallback === 'function') {
            spawnCallback(type);
          }
        }
      }
    }
  }

  // Universal Module Export
  global.TZ = global.TZ || {};
  global.TZ.WaveManager = WaveManager;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WaveManager };
  }
})(typeof window !== 'undefined' ? window : global);
