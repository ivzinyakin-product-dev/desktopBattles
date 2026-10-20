## 2026-10-18T16:44:49Z
You are Explorer 1 for Milestone 4 (Soul Altar State, Defense Rules & Wave Progression) of "Tensa Zangetsu: Soul Altar Defense".

Your working directory is:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m4_1\

Mandatory: Read ORIGINAL_REQUEST.md and PROJECT.md first:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\ORIGINAL_REQUEST.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\orchestrator_1\PROJECT.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\orchestrator_1\TEST_INFRA.md

Examine test suites in `test/test-e2e.js`:
- Feature 20 (Soul Altar State & Defense Rules)
- Feature 21 (Continuous Wave Progression)
- Tier 2.2 (Altar Health Boundaries & Damage Exclusivity)
- Tier 2.5 (Wave Progression Boundaries)
- Tier 3.5 (Swarm Breach & Distress Recovery)
- Tier 4 Scenarios A, B, C, D

Task:
Formulate complete drop-in production blueprints for:
1. `src/game/SoulAltar.js`:
   - Class properties: `x` (default 640), `y` (default 360), `radius` (default 36), `hp` (default 100), `maxHp` (100).
   - Strict Damage Exclusivity: `takePlayerDamage(amount)` deals strictly ZERO damage (no friendly fire from player sword or projectiles).
   - `takeDamage(amount)`: reduces HP from enemy contact or Cero beam, clamps [0, maxHp], triggers camera trauma & audio. Negative damage rejected.
   - `takeBatchDamage(amount)`: caps simultaneous multi-enemy damage to max 30 per frame batch.
   - `restoreHealth(amount)`: restores HP (e.g. +15 on wave clear), capped at maxHp (100).
   - `getState()`: returns 'INTACT' (hp >= 75), 'DAMAGED' (hp >= 40), 'CRITICAL' (hp > 0), 'DESTROYED' (hp <= 0).
   - `isDestroyed()`: boolean (`hp <= 0`).
   - `reset()`: resets hp to 100.
   - `draw(ctx, spriteGen)`: renders RotMG altar sprite (`altar_intact`, `altar_damaged`, `altar_critical`, `altar_destroyed`), pulsing soul aura ring, and health bar.
2. `src/game/WaveManager.js`:
   - Mathematical enemy count scaling: `calculateEnemyCount(w)` = `Math.floor(10 + 6 * w + 1.2 * Math.pow(Math.max(1, w), 1.3))`. (w=1: 17, w=2: 24, w=5: 50). Safely clamps for w <= 0.
   - Spawn interval scaling: `getSpawnInterval(w)` = `Math.max(0.25, 1.8 * Math.pow(0.88, Math.max(1, w) - 1))`. (w=1: 1.8s, w=50: 0.25s).
   - Alive cap scaling: `getAliveCap(w)` = `Math.min(60, 12 + 4 * Math.max(1, w))`. (w=1: 16, w=20+: 60).
   - Composition selection: `pickEnemyType(w)` (Wave 1: strictly 'crawler', later waves: weighted random 'crawler', 'flyer', 'brute').
   - Boss wave detection: `isBossWave(w)` (Wave 5, 8, 10, or w % 5 === 0).
   - Spawning & Wave Progression state machine: `currentWave`, `spawnedInWave`, `totalToSpawn`, `spawnTimer`, `intermissionTimer` (3.0s between waves), `isIntermission`.
   - `update(dt, aliveEnemies, spawnCallback, onWaveCompleteCallback)`: manages spawns, handles zero-alive transition, handles empty enemy lists safely without crashing, invokes wave complete callbacks.
   - Universal module export: `window.TZ.SoulAltar = SoulAltar; window.TZ.WaveManager = WaveManager;` and CommonJS exports.
3. Unit test specifications for `test/test-defense.js`.

Write report to:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m4_1\handoff.md
Send completion message to orchestrator.
