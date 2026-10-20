/**
 * Empirical Adversarial Stress Test Harness: Milestone 2 Projectiles & Trail Rendering
 * Tensa Zangetsu: Soul Altar Defense
 * 
 * Tests:
 * 1. Getsuga wave projectile lifecycle:
 *    - Fire 1,000 projectiles and update for 5,000 frames: verify clean culling
 *      when leaving screen bounds or reaching max lifespan (1.6s).
 *    - Hit registration: verify that exactly 8 enemies are penetrated before
 *      the projectile dissipates, with zero over-penetration across linear,
 *      clustered, and single-frame overlapping formations.
 * 2. Ribbon trail buffer:
 *    - Continuous 10,000-frame slashing simulation: verify buffer never exceeds
 *      16 samples and memory remains flat.
 *    - Rapid slashing / idle cycles and trail eviction.
 */

const assert = require('node:assert');
const path = require('node:path');

// Require Katana and Projectile modules
const Katana = require(path.resolve(__dirname, '../../../src/game/Katana.js'));
const GetsugaWave = require(path.resolve(__dirname, '../../../src/game/Projectile.js'));
const ParticleSystem = require(path.resolve(__dirname, '../../../src/engine/ParticleSystem.js'));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function reportTest(name, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  [PASS] ${name}${details ? ` (${details})` : ''}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${name}${details ? ` (${details})` : ''}`);
  }
}

console.log('================================================================');
console.log('STARTING EMPIRICAL ADVERSARIAL STRESS TEST: MILESTONE 2');
console.log('================================================================\n');

// ----------------------------------------------------------------------
// SUITE 1: Getsuga Wave Projectile Lifecycle & Boundary Culling
// ----------------------------------------------------------------------
console.log('--- SUITE 1: Getsuga Wave Projectile Lifecycle & Culling ---');

// 1.1: 1,000 Projectiles Fired Concurrently and Simulated for 5,000 Frames
(() => {
  const particleSys = new ParticleSystem();
  const katana = new Katana(640, 360, { particleSystem: particleSys });
  const count = 1000;
  const frames = 5000;
  const dt = 1 / 120; // 120Hz fixed timestep

  // Direct injection of 1,000 projectiles with randomized angles, speeds, and origins
  let culledByBounds = 0;
  let culledByLifespan = 0;
  let totalSpawned = 0;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    const speed = 200 + (i % 800); // 200 to 1000 px/s
    const ox = 200 + (i % 880);
    const oy = 150 + ((i * 3) % 420);
    const p = new GetsugaWave(ox, oy, Math.cos(angle), Math.sin(angle), {
      speed,
      particleSystem: particleSys
    });
    katana.projectiles.push(p);
    totalSpawned++;
  }

  assert.strictEqual(katana.projectiles.length, 1000, 'All 1,000 projectiles successfully added to katana');

  let maxActiveObserved = katana.projectiles.length;
  let allCulledFrame = -1;

  for (let f = 1; f <= frames; f++) {
    // In each frame, update katana
    katana.update(dt);

    if (katana.projectiles.length > maxActiveObserved) {
      maxActiveObserved = katana.projectiles.length;
    }

    if (katana.projectiles.length === 0 && allCulledFrame === -1) {
      allCulledFrame = f;
    }
  }

  const cleanCull = katana.projectiles.length === 0;
  const frameTime = allCulledFrame * dt;

  reportTest(
    '1.1 Fire 1,000 concurrent projectiles updated for 5,000 frames: 100% clean culling',
    cleanCull && allCulledFrame > 0 && allCulledFrame <= 250,
    `all 1,000 culled by frame ${allCulledFrame} (${frameTime.toFixed(3)}s), final count: ${katana.projectiles.length}`
  );
})();

// 1.2: 1,000 Projectiles Fired Sequentially over 5,000 Frames
(() => {
  const particleSys = new ParticleSystem();
  const katana = new Katana(640, 360, { particleSystem: particleSys });
  const totalToFire = 1000;
  const frames = 5000;
  const dt = 1 / 120;
  let firedCount = 0;
  let maxActiveAcrossRun = 0;

  for (let f = 1; f <= frames; f++) {
    // Fire 1 projectile every 3 frames until 1,000 are fired (up to frame 3,000)
    if (f % 3 === 0 && firedCount < totalToFire) {
      const angle = (firedCount * 0.137) % (2 * Math.PI);
      const p = new GetsugaWave(640, 360, Math.cos(angle), Math.sin(angle), {
        particleSystem: particleSys,
        speed: 820
      });
      katana.projectiles.push(p);
      firedCount++;
    }

    katana.update(dt);

    if (katana.projectiles.length > maxActiveAcrossRun) {
      maxActiveAcrossRun = katana.projectiles.length;
    }
  }

  const finalCount = katana.projectiles.length;
  reportTest(
    '1.2 Fire 1,000 sequential projectiles over 5,000 frames: steady-state active cap and clean end state',
    firedCount === 1000 && finalCount === 0 && maxActiveAcrossRun <= 150,
    `fired: ${firedCount}, peak active: ${maxActiveAcrossRun}, final count: ${finalCount}`
  );
})();

// 1.3: Boundary Culling Exact Coordinates Test
(() => {
  const dt = 1 / 120;
  // Test right boundary: margin is 100px past 1280 (so > 1380 is culled)
  const pRightInside = new GetsugaWave(1379, 360, 1, 0, { speed: 10 });
  pRightInside.update(dt);
  const passInside = !pRightInside.isDead;

  const pRightOutside = new GetsugaWave(1381, 360, 1, 0, { speed: 10 });
  pRightOutside.update(dt);
  const passOutside = pRightOutside.isDead;

  // Test left boundary: margin is 100px before 0 (so < -100 is culled)
  const pLeftInside = new GetsugaWave(-99, 360, -1, 0, { speed: 10 });
  pLeftInside.update(dt);
  const passLeftIn = !pLeftInside.isDead;

  const pLeftOutside = new GetsugaWave(-101, 360, -1, 0, { speed: 10 });
  pLeftOutside.update(dt);
  const passLeftOut = pLeftOutside.isDead;

  // Test top and bottom bounds (-100 and 820)
  const pTopOut = new GetsugaWave(640, -101, 0, -1, { speed: 10 });
  pTopOut.update(dt);
  const pBottomOut = new GetsugaWave(640, 821, 0, 1, { speed: 10 });
  pBottomOut.update(dt);

  reportTest(
    '1.3 Precise margin bounds culling ([-100, 1380] x [-100, 820])',
    passInside && passOutside && passLeftIn && passLeftOut && pTopOut.isDead && pBottomOut.isDead,
    'boundary margins strictly enforced'
  );
})();

// 1.4: Max Lifespan (1.6s) Culling Without Leaving Bounds
(() => {
  // A very slow projectile (speed = 10 px/s) starting in the center (640, 360)
  // In 1.6s it travels only 16px, so it never reaches boundaries
  const pSlow = new GetsugaWave(640, 360, 1, 0, { speed: 10, life: 1.6 });
  const dt = 1 / 120; // 8.33ms
  let framesElapsed = 0;

  // Simulate 1.59 seconds (190 frames at 120Hz = 1.5833s)
  for (let i = 0; i < 190; i++) {
    pSlow.update(dt);
    framesElapsed++;
  }
  const aliveAt1_58 = !pSlow.isDead && pSlow.life > 0;

  // Simulate 3 more frames (takes total time to 193 frames = 1.608s)
  for (let i = 0; i < 3; i++) {
    pSlow.update(dt);
    framesElapsed++;
  }
  const deadAt1_61 = pSlow.isDead && pSlow.life <= 0;

  reportTest(
    '1.4 Max lifespan (1.6s) culling independent of screen boundaries',
    aliveAt1_58 && deadAt1_61,
    `alive at 1.583s, dead at 1.608s (total frames: ${framesElapsed})`
  );
})();

// 1.5: Adversarial Delta Time Handling (dt = 0, dt < 0, large spike dt = 5.0s)
(() => {
  const pZero = new GetsugaWave(500, 300, 1, 0, { speed: 820 });
  pZero.update(0);
  const passZero = !pZero.isDead && pZero.x === 500;

  const pNeg = new GetsugaWave(500, 300, 1, 0, { speed: 820 });
  pNeg.update(-0.1);
  const passNeg = !pNeg.isDead && pNeg.x === 500;

  const pSpike = new GetsugaWave(500, 300, 1, 0, { speed: 820 });
  pSpike.update(5.0); // 5s spike immediately triggers bounds and lifespan culling
  const passSpike = pSpike.isDead && !Number.isNaN(pSpike.x);

  reportTest(
    '1.5 Resilient handling of degenerate delta times (0, negative, 5.0s spike)',
    passZero && passNeg && passSpike,
    'no NaN, no reverse motion, graceful culling on frame spike'
  );
})();

console.log('');

// ----------------------------------------------------------------------
// SUITE 2: Hit Registration & Pierce Dissipation Stress Test
// ----------------------------------------------------------------------
console.log('--- SUITE 2: Hit Registration & Pierce Dissipation ---');

// Helper mock enemy
function createMockEnemy(id, x, y, radius = 16) {
  return {
    id,
    x,
    y,
    radius,
    isDead: false,
    hitCount: 0,
    lastDamage: 0,
    onHit(dmg, cutNormal, cutAngle, speed) {
      this.hitCount++;
      this.lastDamage = dmg;
    }
  };
}

// 2.1: Exactly 8 enemies penetrated in linear corridor, zero over-penetration (20 enemies lined up)
(() => {
  const wave = new GetsugaWave(50, 300, 1, 0, { speed: 820 });
  const enemies = [];
  // 20 enemies spaced 30px apart from x = 100 to x = 670 along y = 300
  for (let i = 0; i < 20; i++) {
    enemies.push(createMockEnemy(i + 1, 100 + i * 30, 300, 16));
  }

  let totalHitsRegistered = 0;
  const dt = 1 / 120;

  // Advance wave across 200 frames
  for (let f = 0; f < 200; f++) {
    wave.update(dt);
    for (let i = 0; i < enemies.length; i++) {
      const hit = wave.checkHit(enemies[i]);
      if (hit) totalHitsRegistered++;
    }
  }

  const hitEnemyIds = enemies.filter(e => e.hitCount > 0).map(e => e.id);
  const unhitEnemyIds = enemies.filter(e => e.hitCount === 0).map(e => e.id);
  const overPenetrations = enemies.slice(8).filter(e => e.hitCount > 0).length;

  reportTest(
    '2.1 Linear corridor of 20 enemies: exactly 8 penetrated, 0 over-penetration',
    totalHitsRegistered === 8 &&
    wave.pierceCount === 8 &&
    wave.isDead &&
    hitEnemyIds.length === 8 &&
    overPenetrations === 0 &&
    unhitEnemyIds.length === 12,
    `hits: ${totalHitsRegistered}, hit IDs: [${hitEnemyIds.join(',')}], over-penetrations: ${overPenetrations}`
  );
})();

// 2.2: Single-Frame Simultaneous Overlap of 15 Enemies
(() => {
  const wave = new GetsugaWave(300, 300, 1, 0, { speed: 820 });
  const enemies = [];
  // 15 enemies at exact same position (300, 300)
  for (let i = 0; i < 15; i++) {
    enemies.push(createMockEnemy(`overlap_${i + 1}`, 300, 300, 16));
  }

  let hitsThisFrame = 0;
  for (let i = 0; i < enemies.length; i++) {
    if (wave.checkHit(enemies[i])) {
      hitsThisFrame++;
    }
  }

  const hitCount = enemies.filter(e => e.hitCount === 1).length;
  const unhitCount = enemies.filter(e => e.hitCount === 0).length;

  reportTest(
    '2.2 Instantaneous multi-enemy overlap (15 enemies at same point in single frame): exactly 8 hits',
    hitsThisFrame === 8 &&
    hitCount === 8 &&
    unhitCount === 7 &&
    wave.pierceCount === 8 &&
    wave.isDead,
    `registered: ${hitsThisFrame}, unhit: ${unhitCount}, wave.isDead: ${wave.isDead}`
  );
})();

// 2.3: High-Density Swarm Cluster (50 enemies in 40x40 area)
(() => {
  const wave = new GetsugaWave(100, 300, 1, 0, { speed: 820 });
  const enemies = [];
  // 50 enemies randomly clustered in [250..290] x [280..320]
  for (let i = 0; i < 50; i++) {
    const rx = 250 + (i % 8) * 5;
    const ry = 280 + Math.floor(i / 8) * 6;
    enemies.push(createMockEnemy(`swarm_${i + 1}`, rx, ry, 12));
  }

  let totalHits = 0;
  const dt = 1 / 120;
  for (let f = 0; f < 100; f++) {
    wave.update(dt);
    for (let i = 0; i < enemies.length; i++) {
      if (wave.checkHit(enemies[i])) {
        totalHits++;
      }
    }
  }

  const enemiesHit = enemies.filter(e => e.hitCount > 0);
  reportTest(
    '2.3 High-density 50-enemy swarm cluster: exactly 8 penetrated before dissipation',
    totalHits === 8 && wave.pierceCount === 8 && wave.isDead && enemiesHit.length === 8,
    `total hits: ${totalHits}, unique enemies hit: ${enemiesHit.length}, isDead: ${wave.isDead}`
  );
})();

// 2.4: Duplicate Hit Immunity across 50 Successive Frames
(() => {
  const wave = new GetsugaWave(300, 300, 0.01, 0, { speed: 0.1 }); // almost stationary
  const enemy = createMockEnemy('stationary_boss', 300, 300, 20);

  let hitAttemptsPassed = 0;
  const dt = 1 / 120;

  for (let f = 0; f < 50; f++) {
    wave.update(dt);
    if (wave.checkHit(enemy)) {
      hitAttemptsPassed++;
    }
  }

  reportTest(
    '2.4 Duplicate hit immunity across 50 successive frames on same enemy',
    hitAttemptsPassed === 1 && enemy.hitCount === 1 && wave.pierceCount === 1 && !wave.isDead,
    `hit attempts passed: ${hitAttemptsPassed}, enemy.hitCount: ${enemy.hitCount}, piercesLeft: ${wave.piercesLeft}`
  );
})();

// 2.5: Dead Enemy Immunity & piercesLeft Dynamic Property
(() => {
  const wave = new GetsugaWave(300, 300, 1, 0, { speed: 820 });
  const deadEnemy = createMockEnemy('dead_one', 300, 300, 16);
  deadEnemy.isDead = true;

  const hitDead = wave.checkHit(deadEnemy);
  const piercesLeftInitial = wave.piercesLeft;

  const liveEnemy = createMockEnemy('live_one', 300, 300, 16);
  const hitLive = wave.checkHit(liveEnemy);

  reportTest(
    '2.5 Dead enemy immunity and piercesLeft dynamic counting',
    !hitDead && hitLive && wave.pierceCount === 1 && wave.piercesLeft === 7,
    `hitDead: ${hitDead}, hitLive: ${hitLive}, piercesLeft: ${wave.piercesLeft}`
  );
})();

// 2.6: Custom Pierce Threshold (maxPierces = 3 and maxPierces = 1)
(() => {
  const wave3 = new GetsugaWave(100, 300, 1, 0, { speed: 820, maxPierces: 3 });
  const enemies3 = [
    createMockEnemy(1, 150, 300),
    createMockEnemy(2, 200, 300),
    createMockEnemy(3, 250, 300),
    createMockEnemy(4, 300, 300)
  ];
  let hits3 = 0;
  for (let f = 0; f < 50; f++) {
    wave3.update(1 / 120);
    for (const e of enemies3) {
      if (wave3.checkHit(e)) hits3++;
    }
  }

  const wave1 = new GetsugaWave(100, 300, 1, 0, { speed: 820, maxPierces: 1 });
  const enemies1 = [createMockEnemy(1, 150, 300), createMockEnemy(2, 200, 300)];
  let hits1 = 0;
  for (let f = 0; f < 50; f++) {
    wave1.update(1 / 120);
    for (const e of enemies1) {
      if (wave1.checkHit(e)) hits1++;
    }
  }

  reportTest(
    '2.6 Custom pierce limits (maxPierces: 3 and maxPierces: 1) strictly obeyed',
    hits3 === 3 && wave3.isDead && hits1 === 1 && wave1.isDead,
    `hits3: ${hits3}/3 (isDead: ${wave3.isDead}), hits1: ${hits1}/1 (isDead: ${wave1.isDead})`
  );
})();

console.log('');

// ----------------------------------------------------------------------
// SUITE 3: Ribbon Trail Buffer Stress Test & Memory Stability
// ----------------------------------------------------------------------
console.log('--- SUITE 3: Ribbon Trail Buffer & Memory Stability ---');

// 3.1 & 3.2: Continuous 10,000-Frame Slashing Simulation
(() => {
  const particleSys = new ParticleSystem();
  const katana = new Katana(640, 360, { particleSystem: particleSys });
  const totalFrames = 10000;
  const dt = 1 / 120; // 120Hz fixed timestep (~83.3 seconds of real-time simulation)

  let maxTrailLengthObserved = 0;
  let trailLengthExceeded16 = false;

  // Force GC before starting baseline if available
  if (typeof global.gc === 'function') {
    global.gc();
  }

  const memSnapshots = [];
  const startMem = process.memoryUsage();
  memSnapshots.push({ frame: 0, heapUsedMB: (startMem.heapUsed / 1024 / 1024).toFixed(2) });

  // Circular sweeping mouse motion simulating intense slashing
  // Speed is high (800..1500 px/s) to keep trail active every single frame
  const centerX = 640;
  const centerY = 360;
  const sweepRadius = 180;

  for (let f = 1; f <= totalFrames; f++) {
    const theta = f * 0.08; // High angular velocity sweep
    const mouseX = centerX + Math.cos(theta) * sweepRadius;
    const mouseY = centerY + Math.sin(theta) * sweepRadius;

    katana.onMouseMove(mouseX, mouseY);
    katana.update(dt);

    if (katana.trail.length > maxTrailLengthObserved) {
      maxTrailLengthObserved = katana.trail.length;
    }

    if (katana.trail.length > 16) {
      trailLengthExceeded16 = true;
    }

    // Record memory snapshot every 2,000 frames
    if (f % 2000 === 0) {
      const currentMem = process.memoryUsage();
      memSnapshots.push({
        frame: f,
        heapUsedMB: (currentMem.heapUsed / 1024 / 1024).toFixed(2),
        trailLen: katana.trail.length
      });
    }
  }

  if (typeof global.gc === 'function') {
    global.gc();
  }
  const endMem = process.memoryUsage();
  const heapDeltaMB = (endMem.heapUsed - startMem.heapUsed) / (1024 * 1024);

  reportTest(
    '3.1 Continuous 10,000-frame slashing simulation: buffer NEVER exceeds 16 samples',
    !trailLengthExceeded16 && maxTrailLengthObserved <= 16 && katana.trail.length === 16,
    `max observed: ${maxTrailLengthObserved}, end length: ${katana.trail.length}, violated: ${trailLengthExceeded16}`
  );

  // Memory flatness check: heap delta should be bounded (< 25MB after 10,000 frames without unbounded growth)
  const memoryFlat = Math.abs(heapDeltaMB) < 25.0;
  const snapLog = memSnapshots.map(s => `[F${s.frame}: ${s.heapUsedMB}MB]`).join(' -> ');

  reportTest(
    '3.2 Memory remains flat over 10,000 frames (no unbounded heap growth)',
    memoryFlat,
    `start: ${(startMem.heapUsed / 1024 / 1024).toFixed(2)}MB, end: ${(endMem.heapUsed / 1024 / 1024).toFixed(2)}MB, delta: ${heapDeltaMB.toFixed(2)}MB. Progression: ${snapLog}`
  );
})();

// 3.3: Idle Eviction / Stationary Culling (Full 16 samples -> 0 samples in 240ms)
(() => {
  const katana = new Katana(640, 360);
  const dt = 1 / 120;

  // 1. Slash for 30 frames to fill buffer
  for (let f = 0; f < 30; f++) {
    katana.onMouseMove(640 + f * 20, 360);
    katana.update(dt);
  }
  const filledLength = katana.trail.length;
  assert.strictEqual(filledLength, 16, 'Trail buffer reached maximum 16 samples during swing');

  // 2. Allow hilt smoothing to settle below movement threshold (speed < 120 px/s)
  let settleFrames = 0;
  while (katana.speed >= 120 && settleFrames < 20) {
    katana.update(dt);
    settleFrames++;
  }

  // 3. Measure stationary eviction: within 29 frames (29 * (1/120) = 0.2417s > 0.240s lifespan)
  let stationaryFrames = 0;
  while (katana.trail.length > 0 && stationaryFrames < 40) {
    katana.update(dt);
    stationaryFrames++;
  }
  const evictedLength = katana.trail.length;
  const evictionTimeSec = stationaryFrames * dt;

  // 4. Resume movement for 20 frames
  for (let f = 0; f < 20; f++) {
    katana.onMouseMove(700 + f * 20, 360);
    katana.update(dt);
  }
  const refilledLength = katana.trail.length;

  reportTest(
    '3.3 Idle eviction: 16 samples fully evict to 0 after 240ms stationary, cleanly refill on motion',
    filledLength === 16 && evictedLength === 0 && refilledLength > 0 && refilledLength <= 16 && stationaryFrames <= 30,
    `filled: ${filledLength}, settled in: ${settleFrames} frames, evicted in: ${stationaryFrames} frames (${evictionTimeSec.toFixed(3)}s), refilled: ${refilledLength}`
  );
})();

// 3.4: Alternating Slashing and Idle Bursts (50 consecutive cycles)
(() => {
  const katana = new Katana(640, 360);
  const dt = 1 / 120;
  const cycles = 50;
  let allCyclesBounded = true;
  let allIdleEvicted = true;

  for (let c = 0; c < cycles; c++) {
    // 25 frames slashing
    for (let f = 0; f < 25; f++) {
      katana.onMouseMove(640 + Math.sin(f + c) * 100, 360 + Math.cos(f + c) * 100);
      katana.update(dt);
      if (katana.trail.length > 16) allCyclesBounded = false;
    }
    // 45 frames stationary (covers 10 frames settling + 29 frames stationary > 240ms)
    for (let f = 0; f < 45; f++) {
      katana.update(dt);
    }
    if (katana.trail.length !== 0) {
      allIdleEvicted = false;
    }
  }

  reportTest(
    '3.4 Alternating slashing / idle bursts (50 cycles): buffer oscillates 16 -> 0 with zero leak',
    allCyclesBounded && allIdleEvicted && katana.trail.length === 0,
    `cycles: 50, all bounded <= 16: ${allCyclesBounded}, all cleanly evicted to 0: ${allIdleEvicted}`
  );
})();

// 3.5: Dual-Composite Render Safety Under Edge Conditions (Mock Context)
(() => {
  const katana = new Katana(640, 360);
  let renderErrors = 0;

  // Mock 2D context
  const mockCtx = {
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    fillRect() {},
    translate() {},
    rotate() {},
    createLinearGradient() {
      return { addColorStop() {} };
    }
  };

  try {
    // Render on empty trail
    katana.drawTrail(mockCtx);

    // Render with 1 sample
    katana.trail = [{ tipX: 100, tipY: 100, hiltX: 50, hiltY: 50, age: 0, maxAge: 0.24, speed: 500 }];
    katana.drawTrail(mockCtx);

    // Render with full 16 samples
    for (let i = 0; i < 15; i++) {
      katana.trail.push({ tipX: 100 + i * 5, tipY: 100, hiltX: 50, hiltY: 50, age: i * 0.01, maxAge: 0.24, speed: 500 });
    }
    katana.drawTrail(mockCtx);

    // Render with null ctx
    katana.drawTrail(null);
  } catch (err) {
    renderErrors++;
  }

  reportTest(
    '3.5 Dual-composite drawTrail render safety (empty, 1 sample, 16 samples, null ctx)',
    renderErrors === 0,
    `render errors: ${renderErrors}`
  );
})();

// ----------------------------------------------------------------------
// SUITE 4: White-Box Edge Cases & Extreme Combat Stress
// ----------------------------------------------------------------------
console.log('\n--- SUITE 4: White-Box Edge Cases & Extreme Combat Stress ---');

// 4.1: Extreme Velocity (10,000 px/s) SweptQuad CCD Hit Detection & Blind Spot Boundary
(() => {
  // At 10,000 px/s and dt = 1/120s, wave jumps 83.3px per frame (from 100 to 183.3)
  // 1. Enemy at x = 110 (within swept corridor, distSq > maxReach^2): swept quad correctly detects
  const wave = new GetsugaWave(100, 360, 1, 0, { speed: 10000 });
  const enemyCorridor = createMockEnemy('corridor_enemy', 110, 360, 16);
  wave.update(1 / 120);
  const hitCorridor = wave.checkHit(enemyCorridor);

  // 2. Direct SweptQuad CCD volume check
  const sq = wave.getSweptQuad();
  const sqDirectHit = sq && sq.intersectsCircle(140, 360, 16);

  reportTest(
    '4.1 Extreme velocity (10,000 px/s): swept quad CCD detects enemy in sweep corridor',
    hitCorridor && sqDirectHit && enemyCorridor.hitCount === 1,
    `hitCorridor: ${hitCorridor}, sqDirectHit: ${sqDirectHit}, jumped: ${(wave.x - wave.prevX).toFixed(1)}px`
  );
})();

// 4.2: Cooldown Throttle Spam (1,000 rapid triggers in 1 tick)
(() => {
  const katana = new Katana(640, 360);
  let acceptedSpawns = 0;
  let rejectedSpawns = 0;

  for (let i = 0; i < 1000; i++) {
    const success = katana.triggerCrescentWave(640, 360, 1, 0);
    if (success) acceptedSpawns++;
    else rejectedSpawns++;
  }

  reportTest(
    '4.2 Crescent wave trigger spam: 1,000 rapid invocations in single tick yields exactly 1 spawn',
    acceptedSpawns === 1 && rejectedSpawns === 999 && katana.projectiles.length === 1,
    `accepted: ${acceptedSpawns}, rejected: ${rejectedSpawns}, projectiles: ${katana.projectiles.length}`
  );
})();

// 4.3: Corrupted / NaN Enemy Coordinates & Non-Positive Radii Immunity
(() => {
  const wave = new GetsugaWave(300, 360, 1, 0, { speed: 820 });
  const nanEnemy = createMockEnemy('nan', NaN, NaN, 16);
  const negRadEnemy = createMockEnemy('neg_r', 300, 360, -10);
  const nullEnemy = null;
  const undefinedEnemy = undefined;

  const hitNaN = wave.checkHit(nanEnemy);
  const hitNeg = wave.checkHit(negRadEnemy);
  const hitNull = wave.checkHit(nullEnemy);
  const hitUndef = wave.checkHit(undefinedEnemy);

  // Directly verify intersectsCircle zero/negative radius rejection
  const zeroRadDirect = wave.intersectsCircle(300, 360, 0);
  const negRadDirect = wave.intersectsCircle(300, 360, -5);

  reportTest(
    '4.3 Corrupted enemy immunity (NaN, negative radius, null, undefined, zero radius direct)',
    !hitNaN && !hitNeg && !hitNull && !hitUndef && !zeroRadDirect && !negRadDirect && wave.pierceCount === 0,
    'zero crashes, zero false positives, pierceCount remains 0'
  );
})();

// 4.4: Out-of-Bounds Spawn Culling
(() => {
  const waveOOB = new GetsugaWave(2000, 1000, 1, 0, { speed: 820 });
  waveOOB.update(1 / 120);

  reportTest(
    '4.4 Out-of-bounds spawn immediately culled on first physics update',
    waveOOB.isDead,
    `isDead: ${waveOOB.isDead}, pos: (${waveOOB.x}, ${waveOOB.y})`
  );
})();

// 4.5: Forced Slash & Crescent Wave Interleaved Rapid Combat (1,000 frames)
(() => {
  const katana = new Katana(640, 360);
  const dt = 1 / 120;
  let totalWavesSpawned = 0;
  let totalForcedSlashes = 0;
  let maxActiveWaves = 0;

  for (let f = 0; f < 1000; f++) {
    // Attempt forced slash every frame
    if (katana.triggerForcedSlash()) {
      totalForcedSlashes++;
    }
    // Attempt crescent wave every frame
    if (katana.triggerCrescentWave(katana.tip.x, katana.tip.y, 1, 0)) {
      totalWavesSpawned++;
    }

    katana.update(dt);
    if (katana.projectiles.length > maxActiveWaves) {
      maxActiveWaves = katana.projectiles.length;
    }
  }

  reportTest(
    '4.5 Interleaved forced slashes & crescent waves over 1,000 frames: cooldowns strictly enforced',
    totalWavesSpawned > 0 && totalForcedSlashes > 0 && maxActiveWaves <= 2 && katana.trail.length <= 16,
    `waves: ${totalWavesSpawned}, forced slashes: ${totalForcedSlashes}, max active waves: ${maxActiveWaves}`
  );
})();

console.log('\n================================================================');
console.log(`FINAL STRESS TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
