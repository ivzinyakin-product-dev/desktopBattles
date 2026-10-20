## 2026-10-18T15:56:17Z
You are Explorer 2 for Milestone 3 (Standard Enemy Swarm Ecosystem: Crawlers, Flyers, Armored Brutes) of "Tensa Zangetsu: Soul Altar Defense".

Your working directory is:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m3_2\

Mandatory: Read ORIGINAL_REQUEST.md and PROJECT.md first:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\ORIGINAL_REQUEST.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\orchestrator_1\PROJECT.md

Check existing engine and test files:
- src/engine/SpriteGen.js (crawler, flyer, brute sprites)
- test/test-e2e.js (Features 15, 16, 17)

Task:
Investigate and design complete, drop-in production blueprints for `src/game/Enemy.js` - Standard Swarm Types:
1. Canonical Base Class & Archetypes:
   - `new Enemy(type, x, y)` and factory helpers (`Enemy.createCrawler`, `createFlyer`, `createBrute`).
2. Hollow Crawler Swarm AI (Feature 15):
   - Base stats: HP 25 (1-hit cut), Speed 95 px/s, Radius 12px, altarDamage 8.
   - Ground skittering steering toward Altar (640, 360) with sinusoidal gait noise.
   - Flocking separation (`applySeparation(neighbors)`).
3. Hollow Flyer Harasser AI (Feature 16):
   - Base stats: HP 20, Speed 185 px/s, Radius 10px, altarDamage 12, diveSpeed 270 px/s.
   - Logarithmic spiral approach around Altar; close-range dive (r < 180px); reactive blade evasion (`evadeBlade(tip, speed)`).
4. Armored Brute Vanguard AI (Feature 17):
   - Base stats: HP 90, Speed 48 px/s, Radius 20px.
   - Frontal carapace ricochet: light hits (< 600 px/s) ricochet with chip damage (15), metallic clang sound, no armor break.
   - Heavy hits (>= 600 px/s or Senka or Getsuga wave) crack carapace (`armorBroken = true`, `stunTimer = 1.2s`).
   - Subsequent slash triggers clean bisection.
5. Integration with Slicer, SpriteGen, and ParticleSystem.
6. Universal module export: `window.TZ.Enemy = Enemy;` and `module.exports = { Enemy };`.

Output:
Write report to:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m3_2\handoff.md
Send completion message to orchestrator.
