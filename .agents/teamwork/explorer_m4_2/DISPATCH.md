## 2026-10-18T16:44:49Z
You are Explorer 2 for Milestone 4 (Score, Combo, Cleave Bonus & Stats) of "Tensa Zangetsu: Soul Altar Defense".

Your working directory is:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m4_2\

Mandatory: Read ORIGINAL_REQUEST.md and PROJECT.md first:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\ORIGINAL_REQUEST.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\orchestrator_1\PROJECT.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\orchestrator_1\TEST_INFRA.md

Examine test suites in `test/test-e2e.js`:
- Feature 22 (Score, Combo & Replay System)
- Feature 24.3 (Bleach Rank Titles)
- Tier 2.4.5 (Combo timer boundary at 2.0s)
- Tier 3.2 (Forced Slash & Multi-Kill Cleave)
- Tier 4 Scenarios A, B, C, D

Task:
Formulate complete drop-in production blueprints for:
1. `src/game/ScoreManager.js`:
   - Properties: `score`, `combo`, `maxCombo`, `comboTimer`, `totalKills`, `killsByType` (`crawler`, `flyer`, `brute`, `menos`), `survivalTime`, `cleaveCount`.
   - Base points: `getBasePoints(type)` -> crawler: 100, flyer: 150, brute: 300, menos: 1500.
   - Multiplier ladder: `getMultiplier()`:
     * combo < 5: 1.0x (Rank D)
     * 5 <= combo < 10: 1.5x (Rank C)
     * 10 <= combo < 20: 2.0x (Rank B)
     * 20 <= combo < 35: 3.0x (Rank A)
     * 35 <= combo < 50: 4.5x (Rank S)
     * combo >= 50: 6.0x (Rank SSS)
   - Dynamic Bleach rank text: `getRankTitle(combo)`:
     * combo < 5: 'Shikai'
     * 5 <= combo < 10: 'Bankai'
     * 10 <= combo < 20: 'Kuroi Getsuga'
     * 20 <= combo < 35: 'Hollowfication'
     * 35 <= combo < 50: 'Vasto Lorde'
     * combo >= 50: 'Mugetsu'
   - `addScore(enemyType)`: adds `getBasePoints(enemyType) * getMultiplier()`, increments combo, updates maxCombo & stats, resets `comboTimer = 2.0s`.
   - `addCleaveBonus(count)`: awards `Math.max(0, (count - 1) * 200)` points for simultaneous cuts in single slash.
   - `update(dt)`: increments survivalTime; if `combo > 0`, decreases `comboTimer -= dt`; if `comboTimer <= 0`, resets `combo = 0` and `comboTimer = 0`.
   - `reset()`: resets all score and combo metrics.
   - High score persistence: `saveHighScore()` / `loadHighScore()` via `localStorage` with fallback for headless/Node environments.
   - Universal module export: `window.TZ.ScoreManager = ScoreManager;` and CommonJS exports.
2. Unit test specifications for `test/test-defense.js`.

Write report to:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m4_2\handoff.md
Send completion message to orchestrator.
