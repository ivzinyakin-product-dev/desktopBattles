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
     * Fast-paced 10-wave campaign (15 - 38 enemies).
     * Clamped safely for negative or zero wave indices.
     * @param {number} [wave]
     * @returns {number}
     */
    calculateEnemyCount(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);
      if (w === 1) return 15;
      if (w === 2) return 18;
      if (w === 3) return 22;
      if (w === 4) return 24;
      if (w === 5) return 27;
      if (w === 6) return 29;
      if (w === 7) return 31;
      if (w === 8) return 33;
      if (w === 9) return 35;
      if (w === 10) return 38;
      return Math.floor(12 + 2.4 * w + 0.35 * Math.pow(w, 1.3));
    }

    /**
     * Spawn interval formula:
     * Fast spawn cadence for a brisk 5-7 minute complete campaign.
     * @param {number} [wave]
     * @returns {number} Interval in seconds
     */
    getSpawnInterval(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);
      return Math.max(0.35, 1.4 * Math.pow(0.90, w - 1));
    }

    /**
     * Concurrent alive enemy cap formula:
     * Cap(w) = min(45, 10 + 3w)
     * @param {number} [wave]
     * @returns {number} Max alive enemies allowed simultaneously
     */
    getAliveCap(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);
      return Math.min(45, 10 + 3 * w);
    }

    /**
     * Whether specified wave is a milestone boss encounter (Wave 3 and Wave 10)
     * @param {number} [wave]
     * @returns {boolean}
     */
    isBossWave(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);
      return w === 3 || w === 10 || (w > 10 && w % 5 === 0);
    }

    /**
     * Checks if current wave is the climax final wave of the campaign.
     * @param {number} [wave]
     * @returns {boolean}
     */
    isFinalWave(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);
      return w === 10;
    }

    /**
     * Determines faction based on chronological Bleach story arc:
     * - Waves 1-3 (Karakura & Rukongai): 'hollow'
     * - Waves 4-5 (Seireitei & Sokyoku): 'shinigami'
     * - Waves 6-10 (Hueco Mundo, Las Noches, Fake Karakura): 'arrancar'
     * @param {number} [wave]
     * @returns {'hollow'|'shinigami'|'arrancar'}
     */
    getFactionForWave(wave) {
      const w = Math.max(1, typeof wave === 'number' ? wave : this.currentWave);
      if (w <= 3) return 'hollow';
      if (w <= 5) return 'shinigami';
      return 'arrancar';
    }

    /**
     * Selects enemy archetype based on current wave progression and story faction.
     * Wave 1 is strictly 100% Crawlers.
     * @param {number} [wave]
     * @returns {string}
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

      const faction = this.getFactionForWave(w);
      const roll = Math.random();

      if (faction === 'shinigami') {
        if (w === 4) {
          return roll < 0.65 ? 'shinigami_swordsman' : 'shinigami_kido';
        } else {
          // Wave 5: Sōkyoku Hill duel
          if (roll < 0.40) return 'shinigami_swordsman';
          if (roll < 0.70) return 'shinigami_kido';
          return 'shinigami_officer';
        }
      }

      if (faction === 'arrancar') {
        if (w === 6) {
          return roll < 0.60 ? 'arrancar_numeros' : 'arrancar_flyer';
        } else {
          // Waves 7-10: Las Noches & Fake Karakura
          if (roll < 0.45) return 'arrancar_numeros';
          if (roll < 0.75) return 'arrancar_flyer';
          return 'arrancar_brute';
        }
      }

      // Default: Hollow Faction (Waves 1-3)
      if (w === 2) {
        return roll < 0.70 ? 'crawler' : 'flyer';
      } else {
        // Wave 3: Hollow Brutes accompany Menos Grande breach
        if (roll < 0.50) return 'crawler';
        if (roll < 0.80) return 'flyer';
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
    module.exports = WaveManager;
    module.exports.WaveManager = WaveManager;
  }
})(typeof window !== 'undefined' ? window : global);
