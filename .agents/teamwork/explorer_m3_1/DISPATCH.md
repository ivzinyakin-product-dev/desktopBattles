## 2026-10-18T15:56:17Z
You are Explorer 1 for Milestone 3 (Slicing Engine & Debris Physics) of "Tensa Zangetsu: Soul Altar Defense".

Your working directory is:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m3_1\

Mandatory: Read ORIGINAL_REQUEST.md and PROJECT.md first:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\ORIGINAL_REQUEST.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\orchestrator_1\PROJECT.md

Check existing engine and test files:
- src/engine/Vector2.js
- src/engine/SpriteGen.js
- test/test-e2e.js (Features 13 & 14)

Task:
Investigate and design complete, drop-in production blueprints for `src/game/Slicer.js`:
1. Geometric Slicing Math:
   - `Slicer.computeCutNormal(cutAngle)`: returns normalized `{ x, y }` perpendicular to cut angle.
   - `Slicer.sliceEnemy(enemy, cutPoint, cutAngle, swingSpeed, swingVel)`:
     * Clips the enemy's RotMG sprite / bounding hull along the cutting plane into two distinct halves (`HalfA` and `HalfB`).
     * Provides clean polygon / canvas clipping methods (`OffscreenCanvas` or clipped path rendering) preserving exact pixel art colors.
     * Generates glowing white/crimson (#ff0033 / #ffffff) reiatsu cauterized seam lines along the cut edge.
2. Severed Debris Physics:
   - Lateral impulse separation: opposing separation velocities perpendicular to cut normal + forward momentum from `swingVel`.
   - Opposing tumbling angular velocities (+- 5 to 10 rad/s).
   - Ground friction factor (velocity damped by 0.94^dt).
   - Monotonic alpha dissolution over lifespan of 0.85s (dead at 0.9s).
   - Black spiritual smoke particle emission via ParticleSystem.
3. Interface contracts:
   - Universal module export: `window.TZ.Slicer = Slicer;` and `module.exports = { Slicer };`.
4. Define exact class design, methods, unit test specs for `test/test-combat.js`.

Output:
Write report to:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m3_1\handoff.md
Send completion message to orchestrator.
