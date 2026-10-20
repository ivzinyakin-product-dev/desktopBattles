## 2026-10-18T14:38:14Z
From: 06829fc7-2ed4-4f7b-b3e3-4c32cd67f0bd (Orchestrator)
Priority: MESSAGE_PRIORITY_HIGH

You are the Milestone 1 Worker for "Tensa Zangetsu: Soul Altar Defense".

Your working directory is:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\worker_m1_1\

Mandatory: Read ORIGINAL_REQUEST.md and PROJECT.md first:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\ORIGINAL_REQUEST.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\orchestrator_1\PROJECT.md

Read the 3 Explorer handoff reports for Milestone 1:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m1_1\handoff.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m1_2\handoff.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m1_3\handoff.md

Exclusive File Ownership:
You own exclusively:
- src/engine/Vector2.js
- src/engine/GameLoop.js
- src/engine/CanvasRenderer.js
- src/engine/Camera.js
- src/engine/ParticleSystem.js
- src/engine/SpriteGen.js
- test/test-engine.js

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implementation Tasks:
1. Implement `src/engine/Vector2.js`:
   - Vector2 math (add, sub, scale, mag, magSq, normalize, dist, dot, cross, lerp, angle, rotate, clone).
   - SweptQuad Continuous Collision Detection class (bounding box, point in convex quad winding test, line-segment sweep intersection against circle colliders).
2. Implement `src/engine/GameLoop.js`:
   - 120Hz fixed timestep accumulator game loop (dt = 1/120s, max accumulator clamp 0.1s, alpha interpolation calculation, update(dt) vs render(alpha)).
3. Implement `src/engine/CanvasRenderer.js`:
   - 1280x720 canonical resolution, aspect-ratio preservation, screen-to-virtual coordinate transformation, `imageSmoothingEnabled = false`, layered rendering pipeline, and camera shake isolation.
4. Implement `src/engine/Camera.js`:
   - Trauma-squared camera shake model (trauma in [0, 1], shake = trauma^2, trauma decay 1.8/s, translation offsets and angular rotation around center pivot).
5. Implement `src/engine/ParticleSystem.js`:
   - Reiatsu crimson embers (screen-blend), Kuroi dark spiritual smoke (upward drift, alpha fade), bone mask shards (ballistic gravity, floor bounce), particle pooling.
6. Implement `src/engine/SpriteGen.js`:
   - RotMG procedural sprite matrices for Katana (32x32), Soul Altar (32x32: intact, damaged, critical), Crawler (16x16: stand & walk), Flyer (16x16: flap 0 & 1), Armored Brute (32x32), and Menos Grande (32x32 / 64x64).
   - Automated 1-pixel dark outline algorithm (`applyOutline`) using 4-way cardinal neighbor test.
   - Sprite caching registry.
7. Implement Universal Modular Pattern across all modules:
   `window.TZ = window.TZ || {};` and CommonJS export `if (typeof module !== 'undefined' && module.exports) { module.exports = ...; }`.
8. Create comprehensive automated unit tests in `test/test-engine.js` using Node.js v24 native runner (`node:test`, `node:assert`).
9. Run tests: `node --test test/test-engine.js` and verify 100% pass.
