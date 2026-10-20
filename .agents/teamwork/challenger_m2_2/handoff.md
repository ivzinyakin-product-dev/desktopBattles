# Handoff Report: Milestone 2 Adversarial Stress Testing (Projectiles & Trail Rendering)

**Agent**: Challenger 2 (`challenger_m2_2`)  
**Role**: Empirical Challenger (critic, specialist)  
**Date**: 2026-10-18T15:56:00Z  
**Verdict**: **APPROVE**

---

## 1. Observation

Adversarial stress testing was conducted against the Milestone 2 Getsuga Tensho crescent projectile subsystem (`src/game/Projectile.js`) and dynamic ribbon trail subsystem (`src/game/Katana.js`) via the newly developed empirical stress test harness `.agents/teamwork/challenger_m2_2/stress_projectile_trail.js`.

### Direct Tool Command & Execution Result
Command executed:
```powershell
node .agents/teamwork/challenger_m2_2/stress_projectile_trail.js
```

Execution Output:
```
================================================================
STARTING EMPIRICAL ADVERSARIAL STRESS TEST: MILESTONE 2
================================================================

--- SUITE 1: Getsuga Wave Projectile Lifecycle & Culling ---
  [PASS] 1.1 Fire 1,000 concurrent projectiles updated for 5,000 frames: 100% clean culling (all 1,000 culled by frame 193 (1.608s), final count: 0)
  [PASS] 1.2 Fire 1,000 sequential projectiles over 5,000 frames: steady-state active cap and clean end state (fired: 1000, peak active: 38, final count: 0)
  [PASS] 1.3 Precise margin bounds culling ([-100, 1380] x [-100, 820]) (boundary margins strictly enforced)
  [PASS] 1.4 Max lifespan (1.6s) culling independent of screen boundaries (alive at 1.583s, dead at 1.608s (total frames: 193))
  [PASS] 1.5 Resilient handling of degenerate delta times (0, negative, 5.0s spike) (no NaN, no reverse motion, graceful culling on frame spike)

--- SUITE 2: Hit Registration & Pierce Dissipation ---
  [PASS] 2.1 Linear corridor of 20 enemies: exactly 8 penetrated, 0 over-penetration (hits: 8, hit IDs: [1,2,3,4,5,6,7,8], over-penetrations: 0)
  [PASS] 2.2 Instantaneous multi-enemy overlap (15 enemies at same point in single frame): exactly 8 hits (registered: 8, unhit: 7, wave.isDead: true)
  [PASS] 2.3 High-density 50-enemy swarm cluster: exactly 8 penetrated before dissipation (total hits: 8, unique enemies hit: 8, isDead: true)
  [PASS] 2.4 Duplicate hit immunity across 50 successive frames on same enemy (hit attempts passed: 1, enemy.hitCount: 1, piercesLeft: 7)
  [PASS] 2.5 Dead enemy immunity and piercesLeft dynamic counting (hitDead: false, hitLive: true, piercesLeft: 7)
  [PASS] 2.6 Custom pierce limits (maxPierces: 3 and maxPierces: 1) strictly obeyed (hits3: 3/3 (isDead: true), hits1: 1/1 (isDead: true))

--- SUITE 3: Ribbon Trail Buffer & Memory Stability ---
  [PASS] 3.1 Continuous 10,000-frame slashing simulation: buffer NEVER exceeds 16 samples (max observed: 16, end length: 16, violated: false)
  [PASS] 3.2 Memory remains flat over 10,000 frames (no unbounded heap growth) (start: 7.11MB, end: 9.93MB, delta: 2.82MB. Progression: [F0: 7.11MB] -> [F2000: 10.75MB] -> [F4000: 10.03MB] -> [F6000: 8.98MB] -> [F8000: 7.54MB] -> [F10000: 9.93MB])
  [PASS] 3.3 Idle eviction: 16 samples fully evict to 0 after 240ms stationary, cleanly refill on motion (filled: 16, settled in: 10 frames, evicted in: 28 frames (0.233s), refilled: 16)
  [PASS] 3.4 Alternating slashing / idle bursts (50 cycles): buffer oscillates 16 -> 0 with zero leak (cycles: 50, all bounded <= 16: true, all cleanly evicted to 0: true)
  [PASS] 3.5 Dual-composite drawTrail render safety (empty, 1 sample, 16 samples, null ctx) (render errors: 0)

--- SUITE 4: White-Box Edge Cases & Extreme Combat Stress ---
  [PASS] 4.1 Extreme velocity (10,000 px/s): swept quad CCD detects enemy in sweep corridor (hitCorridor: true, sqDirectHit: true, jumped: 83.3px)
  [PASS] 4.2 Crescent wave trigger spam: 1,000 rapid invocations in single tick yields exactly 1 spawn (accepted: 1, rejected: 999, projectiles: 1)
  [PASS] 4.3 Corrupted enemy immunity (NaN, negative radius, null, undefined, zero radius direct) (zero crashes, zero false positives, pierceCount remains 0)
  [PASS] 4.4 Out-of-bounds spawn immediately culled on first physics update (isDead: true, pos: (2006.8333333333333, 1000))
  [PASS] 4.5 Interleaved forced slashes & crescent waves over 1,000 frames: cooldowns strictly enforced (waves: 5, forced slashes: 24, max active waves: 1)

================================================================
FINAL STRESS TEST RESULTS: 21/21 PASSED (0 FAILED)
================================================================
```

### Existing Suite Verification Command & Results
- `node --test test/test-combat.js`: **41/41 tests passing (0 failures, 0 skipped)**
- `node --test test/test-e2e.js`: **76/76 active tests passing (0 failures, 95 skipped for M3-M5)**

### Code Inspection Observations
1. **Lifespan and Out-of-Bounds Culling** (`src/game/Projectile.js`, lines 256-273):
   ```javascript
   this.life -= delta;
   if (this.life <= 0) {
     this.isDead = true;
     return;
   }
   if (
     this.x < -100 ||
     this.x > 1280 + 100 ||
     this.y < -100 ||
     this.y > 720 + 100
   ) {
     this.isDead = true;
     return;
   }
   ```
   Lifespan strictly decrements by frame delta, and bounding margins `[-100, 1380] x [-100, 820]` are strictly checked every frame.

2. **Projectiles Array Lifecycle Pruning** (`src/game/Katana.js`, lines 453-461):
   ```javascript
   for (let i = this.projectiles.length - 1; i >= 0; i--) {
     const p = this.projectiles[i];
     if (p && typeof p.update === 'function') {
       p.update(dt, this.particleSystem);
       if (p.isDead || (typeof p.life === 'number' && p.life <= 0)) {
         this.projectiles.splice(i, 1);
       }
     }
   }
   ```
   Reverse loop cleanly splices dead projectiles without skipping indices.

3. **Pierce Counter and Penetration Limit** (`src/game/Projectile.js`, lines 202-232):
   ```javascript
   if (this.intersectsCircle(ex, ey, er)) {
     this.hitEntities.add(enemy);
     this.pierceCount++;
     ...
     if (this.pierceCount >= this.maxPierces) {
       this.isDead = true;
     }
     return true;
   }
   ```
   Once `pierceCount` reaches 8 (`maxPierces`), `this.isDead` becomes `true`. Subsequent calls to `checkHit` immediately return `false` via `if (this.isDead ...) return false;`.

4. **Ribbon Trail Buffer Capping** (`src/game/Katana.js`, lines 517-530):
   ```javascript
   this.trail.unshift({ ... });
   if (this.trail.length > 16) {
     this.trail.length = 16;
   }
   ```
   Buffer length is unconditionally clamped to 16 samples.

5. **Trail Stationary Decay** (`src/game/Katana.js`, lines 510-514):
   ```javascript
   for (let i = 0; i < this.trail.length; i++) {
     this.trail[i].age += dt;
   }
   this.trail = this.trail.filter(s => s.age < (s.maxAge || this.trailLifespan));
   ```
   All samples age monotonically by `dt` and are filtered when `age >= 0.24s`.

---

## 2. Logic Chain

1. **Getsuga Wave Projectile Lifecycle**:
   - *Premise*: Firing 1,000 projectiles must not result in leaked references, zombie projectiles, or runaway memory growth.
   - *Observation*: In Test 1.1, 1,000 concurrent projectiles updated across 5,000 frames were 100% culled by frame 193 (1.608 seconds, coinciding with `maxLife = 1.6s`), leaving `katana.projectiles.length === 0`.
   - *Observation*: In Test 1.2, 1,000 sequentially spawned projectiles over 5,000 frames maintained a peak concurrent count of 38 and terminated at 0 active projectiles.
   - *Deduction*: The projectile lifecycle is strictly bounded, immune to memory leaks, and adheres to the 1.6s lifespan and 100px boundary margins.

2. **Hit Registration and Pierce Cap (Exactly 8 Enemies, Zero Over-Penetration)**:
   - *Premise*: A wave must penetrate up to 8 enemies and dissipate on the 8th hit, with 0 hits registered on subsequent enemies regardless of spatial distribution.
   - *Observation*: In Test 2.1 (linear corridor of 20 enemies spaced 30px apart), enemies 1–8 took damage, `pierceCount` reached 8, `isDead` became true, and enemies 9–20 took 0 hits (over-penetration = 0).
   - *Observation*: In Test 2.2 (15 enemies placed at the exact same coordinate in a single frame), exactly 8 registered hits, 7 were rejected, and `wave.isDead` became true.
   - *Observation*: In Test 2.3 (50 enemies clustered in a tight 40x40 box), exactly 8 were hit before dissipation.
   - *Observation*: In Test 2.4 (same enemy checked across 50 consecutive frames), duplicate hit immunity (`this.hitEntities.has(enemy)`) prevented multi-hitting the same target.
   - *Deduction*: Penetration cap of 8 is mathematically guaranteed and immune to clustering, co-location, and frame timing artifacts.

3. **Ribbon Trail Buffer and Memory Stability**:
   - *Premise*: Slashing motion over 10,000 frames must never exceed 16 samples, must not leak memory, and must evict when stationary.
   - *Observation*: In Test 3.1, over 10,000 continuous slashing frames at 120Hz, `maxTrailLengthObserved` was exactly 16. Buffer size was checked at every frame and never exceeded 16.
   - *Observation*: In Test 3.2, heap memory started at 7.11MB and ended at 9.93MB (delta +2.82MB) with cyclic Scavenge GC keeping memory flat between 7MB and 11MB throughout the entire 83.3 seconds of simulation.
   - *Observation*: In Test 3.3, after mouse motion halted, the blade took 10 frames to settle below the 120 px/s threshold due to exponential hilt smoothing (`lambda = 50 s^-1`). Once stationary, all 16 trail samples aged out in exactly 28 frames (0.233s < 0.240s) and reached 0 samples.
   - *Observation*: In Test 3.4, 50 alternating cycles of slashing and resting oscillated cleanly between 16 and 0 samples without residual sample accumulation.
   - *Deduction*: The ribbon trail buffer strictly enforces its 16-sample capacity, flushes cleanly upon idle, and exhibits a flat memory profile under continuous load.

---

## 3. Caveats

1. **High-Velocity (> 5,000 px/s) SweptQuad Broadphase Note**:
   In `src/game/Projectile.js` line 161:
   `if (distSq > maxReach * maxReach) { return sq.intersectsCircle(...) } else { check narrowphase crescent }`
   At extreme artificial velocities (> 5,000 px/s, where step size > 40px), an enemy that is passed during the frame but finishes within `maxReach` (58px) behind the destination crescent falls into the narrowphase crescent check instead of the swept quad check.
   *Assessment*: In the actual game, `GetsugaWave` flies at a canonical speed of 820 px/s (step size 6.83px at 120Hz). Because 6.83px is less than half the 16px crescent thickness, the wave is continuous and cannot jump over colliders. This edge case is purely theoretical under non-gameplay velocities.
2. **Explicit Radius Zero Coercion**:
   In `src/game/Projectile.js` line 208, `const er = enemy.radius || 16;` defaults a radius of 0 to 16 due to falsiness. All enemy archetypes (Crawlers: 16px, Flyers: 14px, Brutes: 24px, Menos: 48px) have non-zero radii, so this does not impact gameplay.

---

## 4. Conclusion

Milestone 2 Projectiles & Trail Rendering implementation meets all functional and adversarial performance criteria specified in `ORIGINAL_REQUEST.md` and `PROJECT.md`:
- **Getsuga wave lifecycle**: 100% clean culling upon boundary exit or 1.6s lifespan expiration across 1,000 projectiles and 5,000 frames.
- **Hit registration**: Strictly 8 penetrations maximum, zero over-penetration across all swarm configurations, with robust duplicate-hit protection.
- **Trail buffer**: Strictly capped at 16 samples, flat memory consumption across 10,000 frames, clean 240ms eviction.

**Verdict**: **APPROVE**.

---

## 5. Verification Method

To independently reproduce and verify this report:

1. **Run Milestone 2 Empirical Adversarial Stress Test Suite**:
   ```powershell
   node .agents/teamwork/challenger_m2_2/stress_projectile_trail.js
   ```
   *Expected result*: 21 passed, 0 failed, exit code 0.

2. **Run Milestone 2 Combat Unit Suite**:
   ```powershell
   node --test test/test-combat.js
   ```
   *Expected result*: 41 passed, 0 failed, exit code 0.

3. **Run Comprehensive E2E System Test Suite**:
   ```powershell
   node --test test/test-e2e.js
   ```
   *Expected result*: 76 passed, 0 failed, 95 skipped (M3-M5), exit code 0.

4. **Invalidation Conditions**:
   - Any test failure in `stress_projectile_trail.js`.
   - `katana.trail.length` exceeding 16 at any point.
   - Any projectile penetrating > 8 enemies.
   - Memory heap increasing monotonically without GC reclamation over 10,000 frames.
