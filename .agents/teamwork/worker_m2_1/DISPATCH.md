## 2026-10-18T15:28:54Z
You are the Milestone 2 Worker for "Tensa Zangetsu: Soul Altar Defense".

Your working directory is:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\worker_m2_1\

Mandatory: Read ORIGINAL_REQUEST.md and PROJECT.md first:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\ORIGINAL_REQUEST.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\orchestrator_1\PROJECT.md

Read the 3 M2 Explorer handoff reports:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m2_1\handoff.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m2_2\handoff.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m2_3\handoff.md

Exclusive File Ownership:
- src/game/Katana.js
- src/game/Projectile.js
- test/test-combat.js

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implementation Tasks:
1. Implement `src/game/Projectile.js`:
   - `TZ.GetsugaWave`: Crescent projectile wave unleashed on Right-Click or Spacebar.
   - Parabolic Bezier crescent geometry (R = 42px, thickness 16px) with jet-black core (#050508) and glowing crimson stroke (#ff0033).
   - Speed 820 px/s, lifespan 1.6s, penetrates up to 8 enemies before dissipating.
   - Leaves trailing kuroi smoke and reiatsu embers.
   - Bounding circle and SweptQuad support for continuous collision queries.
2. Implement `src/game/Katana.js`:
   - Kinematics: Exponential hilt smoothing (lambda = 50 s^-1) tracking mouse input, K=5 velocity ring buffer calculating smoothed velocity, swing speed, and angular sweep velocity.
   - Dynamic Stance: Ready stance (speed < 280 px/s) pointing radially outward from Soul Altar (640, 360) vs cutting stance (speed >= 280 px/s) aligned with swing vector +0.35 rad forward rake angle.
   - Critical Contract: Methods `isSlashing()` and `canDeflectCero()` MUST exist and return booleans to satisfy test-e2e.js.
   - Continuous Collision: `getBladeSegment()`, `getSweptQuad()` utilizing `TZ.SweptQuad.fromBladeSegments`.
   - Dynamic Getsuga Trail: 16-sample rolling ribbon buffer, dual-composite shader (Pass 1: screen blend dilated crimson glow with shadowBlur 18; Pass 2: source-over 4px jet-black core ribbon; trailing reiatsu embers).
   - Chained Tassel (Verlet Physics): 8 linked nodes pinned to pommel anchor point, real-time Verlet integration (gravity 280 px/s^2, air drag), 3-iteration distance relaxation constraint (d0 = 5px), RotMG metallic styling.
   - Left-Click Forced Slash: "Senka" 240° circular sweep around cursor, ease-out cubic, 150ms duration, 0.35s cooldown, guaranteed bisection, +0.25 camera trauma.
   - Projectile management: stores active `projectiles` array, `fireGetsugaWave()`, updates and renders waves.
3. Universal Modular Pattern:
   - `window.TZ = window.TZ || {};`
   - CommonJS exports: `if (typeof module !== 'undefined' && module.exports) { module.exports = { Katana, Projectile: GetsugaWave, GetsugaWave }; }`.
4. Create comprehensive automated unit tests in `test/test-combat.js` covering kinematics, stance transitions, swept quads, ribbon buffer, Verlet distance constraint stability under 10k px/s flicks, forced slash, and Getsuga wave lifecycle.
5. Execute verification commands:
   `node --test test/test-combat.js`
   `node --test test/test-engine.js`
   `node --test test/test-e2e.js`
   Verify 100% pass! (All Milestone 2 tests in test-e2e.js should automatically activate and pass).
6. Document implementation, commands, and passing logs in:
   c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\worker_m2_1\handoff.md
   Send completion message to orchestrator.
