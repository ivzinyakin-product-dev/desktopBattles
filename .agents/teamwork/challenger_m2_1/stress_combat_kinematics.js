/**
 * Tensa Zangetsu: Soul Altar Defense
 * .agents/teamwork/challenger_m2_1/stress_combat_kinematics.js
 * 
 * Adversarial Stress Test Suite for Milestone 2 (Katana Kinematics & Verlet Physics).
 * 
 * Tests:
 * 1. Extreme Velocity Mouse Whip (10,000 px/s & 50,000 px/s)
 *    - Verlet chain stability, node coordinates finite, link length limits (<= 7px, total <= 45px)
 *    - Node 0 pinning to pommel
 *    - SweptQuad validity, finite bounds, CCD circle intersection without degenerate errors
 * 2. Rapid 180° Direction Reversals Within 1 Frame (Whip Back and Forth)
 *    - High angular acceleration & centrifugal force
 *    - Chain wrap / stretch bounds under alternating impulses
 *    - SweptQuad self-intersecting / bow-tie geometry stability
 * 3. Senka Forced Slash Interruption & Rapid Re-triggering
 *    - Cooldown enforcement under rapid spam (100x/frame)
 *    - State preservation under concurrent violent mouse whip (50,000 px/s)
 *    - Re-trigger boundary at t = 0.35s
 *    - Concurrent crescent wave triggering & adversarial inputs
 * 4. Stationary Mouse & Velocity Filter Decay Dynamics
 *    - Speed decay at 120Hz fixed timestep
 *    - Invariant checks across 10,000 randomized frames
 */

const assert = require('node:assert');
const path = require('node:path');

// Load engine and game modules
const projectRoot = path.resolve(__dirname, '../../..');
const Vector2 = require(path.join(projectRoot, 'src/engine/Vector2.js'));
const { SweptQuad } = Vector2;
const Katana = require(path.join(projectRoot, 'src/game/Katana.js'));
const { GetsugaWave } = require(path.join(projectRoot, 'src/game/Projectile.js'));

console.log('================================================================');
console.log('STARTING ADVERSARIAL STRESS TEST: KATANA KINEMATICS & VERLET');
console.log('================================================================');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err });
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

// Helper to verify all coordinates of tassel nodes are finite numbers
function assertTasselIntegrity(katana, context = '') {
  const nodes = katana.tasselNodes;
  assert.ok(nodes && nodes.length === 8, `${context}: Tassel must have exactly 8 nodes`);

  // Check node 0 is pinned to pommel
  const pommelDist = Math.hypot(nodes[0].x - katana.pommel.x, nodes[0].y - katana.pommel.y);
  assert.ok(pommelDist < 1e-4, `${context}: Node 0 not pinned to pommel (dist = ${pommelDist})`);

  let totalLength = 0;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    assert.ok(Number.isFinite(n.x), `${context}: Node ${i}.x is not finite (${n.x})`);
    assert.ok(Number.isFinite(n.y), `${context}: Node ${i}.y is not finite (${n.y})`);
    assert.ok(Number.isFinite(n.oldX), `${context}: Node ${i}.oldX is not finite (${n.oldX})`);
    assert.ok(Number.isFinite(n.oldY), `${context}: Node ${i}.oldY is not finite (${n.oldY})`);

    if (i < nodes.length - 1) {
      const next = nodes[i + 1];
      const linkLen = Math.hypot(next.x - n.x, next.y - n.y);
      assert.ok(Number.isFinite(linkLen), `${context}: Link ${i}->${i+1} length is not finite`);
      // Physical limit: restLen is 5px, link clamp is restLen * 1.3 = 6.5px, allow tolerance <= 7.0px
      assert.ok(linkLen <= 7.0, `${context}: Link ${i}->${i+1} stretched beyond limit (${linkLen.toFixed(2)}px > 7.0px)`);
      totalLength += linkLen;
    }
  }

  // Total chain length limit: 7 links * 6.5px = 45.5px max
  assert.ok(totalLength <= 46.0, `${context}: Total chain length exceeded limit (${totalLength.toFixed(2)}px > 46px)`);
}

// Helper to verify SweptQuad validity
function assertSweptQuadValidity(sq, context = '') {
  assert.ok(sq, `${context}: getSweptQuad() returned null/undefined`);
  assert.ok(Array.isArray(sq.points) && sq.points.length === 4, `${context}: SweptQuad must have 4 points`);

  for (let i = 0; i < 4; i++) {
    const pt = sq.points[i];
    assert.ok(Number.isFinite(pt.x), `${context}: Quad vertex ${i}.x is not finite (${pt.x})`);
    assert.ok(Number.isFinite(pt.y), `${context}: Quad vertex ${i}.y is not finite (${pt.y})`);
  }

  const bounds = sq.getBounds();
  assert.ok(Number.isFinite(bounds.minX), `${context}: bounds.minX not finite`);
  assert.ok(Number.isFinite(bounds.maxX), `${context}: bounds.maxX not finite`);
  assert.ok(Number.isFinite(bounds.minY), `${context}: bounds.minY not finite`);
  assert.ok(Number.isFinite(bounds.maxY), `${context}: bounds.maxY not finite`);
  assert.ok(bounds.minX <= bounds.maxX, `${context}: bounds.minX > maxX (${bounds.minX} > ${bounds.maxX})`);
  assert.ok(bounds.minY <= bounds.maxY, `${context}: bounds.minY > maxY (${bounds.minY} > ${bounds.maxY})`);
}

// ============================================================================
// SUITE 1: Extreme Velocity Mouse Whip (10,000 px/s & 50,000 px/s)
// ============================================================================
console.log('\n--- SUITE 1: Extreme Velocity Mouse Whip (10k & 50k px/s) ---');

runTest('1.1: Linear whip at 10,000 px/s preserves Verlet chain stability over 500 frames', () => {
  const katana = new Katana(640, 360);
  const dt = 1 / 120; // 120Hz fixed timestep
  const speed = 10000; // px/s
  const step = speed * dt; // ~83.33 px per frame

  let currentX = 100;
  katana.hilt = { x: currentX, y: 360 };
  katana.targetMouse = { x: currentX, y: 360 };

  for (let frame = 0; frame < 500; frame++) {
    currentX = (currentX + step) % 1200 + 40;
    katana.onMouseMove(currentX, 360);
    katana.update(dt);

    assertTasselIntegrity(katana, `Frame ${frame} @ 10k px/s`);
    const sq = katana.getSweptQuad();
    assertSweptQuadValidity(sq, `Frame ${frame} @ 10k px/s`);
  }
});

runTest('1.2: Violent linear whip at 50,000 px/s preserves Verlet chain stability over 500 frames', () => {
  const katana = new Katana(640, 360);
  const dt = 1 / 120;
  const speed = 50000; // px/s
  const step = speed * dt; // ~416.67 px per frame

  let currentX = 100;
  katana.hilt = { x: currentX, y: 360 };
  katana.targetMouse = { x: currentX, y: 360 };

  for (let frame = 0; frame < 500; frame++) {
    currentX = (currentX + step) % 1200 + 40;
    katana.onMouseMove(currentX, 360);
    katana.update(dt);

    assertTasselIntegrity(katana, `Frame ${frame} @ 50k px/s`);
    const sq = katana.getSweptQuad();
    assertSweptQuadValidity(sq, `Frame ${frame} @ 50k px/s`);
  }
});

runTest('1.3: High-velocity circular centrifuge whip at 50,000 px/s', () => {
  const katana = new Katana(640, 360);
  const dt = 1 / 120;
  const radius = 350;
  const circumference = 2 * Math.PI * radius; // ~2200 px
  // Rev/s = 50000 / 2200 ~ 22.7 rev/s -> angular vel ~ 143 rad/s
  const angularSpeed = 50000 / radius; // ~142.8 rad/s

  let angle = 0;
  katana.hilt = { x: 640 + radius, y: 360 };
  katana.targetMouse = { x: 640 + radius, y: 360 };

  for (let frame = 0; frame < 600; frame++) {
    angle += angularSpeed * dt;
    const mx = 640 + Math.cos(angle) * radius;
    const my = 360 + Math.sin(angle) * radius;
    katana.onMouseMove(mx, my);
    katana.update(dt);

    assertTasselIntegrity(katana, `Circular whip frame ${frame}`);
    const sq = katana.getSweptQuad();
    assertSweptQuadValidity(sq, `Circular whip frame ${frame}`);
  }
});

runTest('1.4: SweptQuad at 50,000 px/s detects circle collider along sweep path without tunneling', () => {
  const katana = new Katana(640, 360);
  katana.hilt = { x: 200, y: 360 };
  katana.targetMouse = { x: 200, y: 360 };
  katana.angle = 0; // Pointing right
  katana.update(1 / 120);

  // Large teleport/flick to x=700 (delta = 500px in 1 frame ~ 60,000 px/s)
  katana.onMouseMove(700, 360);
  katana.update(1 / 120);

  const sq = katana.getSweptQuad();
  assertSweptQuadValidity(sq, 'CCD Whip');

  // Place enemy circle right in the path between prev hilt (200) and new hilt (~370 due to smoothing)
  // Check intersection with small enemy (radius 16px) at (300, 360)
  const enemyPos = { x: 300, y: 360 };
  const intersects = sq.intersectsCircle(enemyPos, 16);
  assert.ok(intersects, 'SweptQuad must detect circle collider in high-speed sweep path');

  // Check non-intersecting circle far away
  const missPos = { x: 300, y: 100 };
  assert.strictEqual(sq.intersectsCircle(missPos, 16), false, 'SweptQuad must reject circle far away');
});

// ============================================================================
// SUITE 2: Rapid 180° Direction Reversals Within 1 Frame (Whip Back and Forth)
// ============================================================================
console.log('\n--- SUITE 2: Rapid 180° Direction Reversals Within 1 Frame ---');

runTest('2.1: Alternating horizontal 180° flicks (left-right 1000px) every frame for 500 frames', () => {
  const katana = new Katana(640, 360);
  const dt = 1 / 120;

  for (let frame = 0; frame < 500; frame++) {
    const targetX = (frame % 2 === 0) ? 1100 : 180;
    katana.onMouseMove(targetX, 360);
    katana.update(dt);

    assert.ok(Number.isFinite(katana.angle), `Frame ${frame}: angle not finite (${katana.angle})`);
    assert.ok(Number.isFinite(katana.angularVelocity), `Frame ${frame}: angularVelocity not finite (${katana.angularVelocity})`);
    assert.ok(Number.isFinite(katana.speed), `Frame ${frame}: speed not finite (${katana.speed})`);

    assertTasselIntegrity(katana, `180° reversal frame ${frame}`);
    const sq = katana.getSweptQuad();
    assertSweptQuadValidity(sq, `180° reversal frame ${frame}`);
  }
});

runTest('2.2: Alternating diagonal 180° flicks (cross-corner) every frame for 500 frames', () => {
  const katana = new Katana(640, 360);
  const dt = 1 / 120;

  for (let frame = 0; frame < 500; frame++) {
    const targetX = (frame % 2 === 0) ? 1150 : 130;
    const targetY = (frame % 2 === 0) ? 650 : 70;
    katana.onMouseMove(targetX, targetY);
    katana.update(dt);

    assertTasselIntegrity(katana, `Diagonal reversal frame ${frame}`);
    const sq = katana.getSweptQuad();
    assertSweptQuadValidity(sq, `Diagonal reversal frame ${frame}`);
  }
});

runTest('2.3: Self-intersecting / bow-tie SweptQuad collision checks during 180° flip', () => {
  const katana = new Katana(640, 360);
  katana.hilt = { x: 600, y: 360 };
  katana.angle = 0; // Blade points right (tip at 685, 360)
  katana.update(1 / 120);

  // Violent flick to left causing 180° reversal
  katana.onMouseMove(100, 360);
  katana.update(1 / 120);

  const sq = katana.getSweptQuad();
  assertSweptQuadValidity(sq, 'Bow-tie SweptQuad');

  // Verify containsPoint and intersectsCircle do not throw or NaN
  assert.doesNotThrow(() => {
    sq.containsPoint(500, 360);
    sq.containsPoint(600, 360);
    sq.containsPoint(0, 0);
    sq.intersectsCircle(500, 360, 20);
    sq.intersectsCircle(600, 360, 20);
    sq.intersectsCircle(1200, 700, 50);
  });
});

// ============================================================================
// SUITE 3: Senka Forced Slash Interruption & Re-triggering
// ============================================================================
console.log('\n--- SUITE 3: Senka Forced Slash Interruption & Re-triggering ---');

runTest('3.1: Senka forced slash initiates and holds active slashing status', () => {
  const katana = new Katana(640, 360);
  const triggered = katana.triggerForcedSlash();
  assert.strictEqual(triggered, true);
  assert.strictEqual(katana.isForcedSlashing, true);
  assert.strictEqual(katana.isSlashing(), true);
  assert.strictEqual(katana.canDeflectCero(), true);
  assert.strictEqual(katana.forcedSlashCooldownTimer, 0.35);
});

runTest('3.2: Re-triggering Senka 100x/frame during active slash (0 to 0.15s) is rejected', () => {
  const katana = new Katana(640, 360);
  katana.triggerForcedSlash();

  const dt = 0.01; // 10ms steps (15 steps to complete 150ms)
  let elapsed = 0;

  // Test strictly active phase up to 140ms
  while (elapsed + dt < 0.150) {
    katana.update(dt);
    elapsed += dt;

    // Spam re-trigger 100 times this frame
    for (let i = 0; i < 100; i++) {
      const retriggered = katana.triggerForcedSlash();
      assert.strictEqual(retriggered, false, `Must reject re-trigger at elapsed = ${elapsed.toFixed(3)}s`);
    }

    assert.strictEqual(katana.isForcedSlashing, true, `Must stay forced slashing at elapsed = ${elapsed.toFixed(3)}s`);
    assert.ok(katana.forcedSlashCooldownTimer > 0, 'Cooldown timer must remain positive');
  }

  // Next step reaches 150ms: Senka active state must cleanly transition to false
  katana.update(dt);
  elapsed += dt;
  assert.strictEqual(katana.isForcedSlashing, false, 'Senka active state must end at 150ms');
  assert.ok(katana.forcedSlashCooldownTimer > 0, 'Cooldown timer must still be active after 150ms');
});

runTest('3.3: Re-triggering Senka during remaining cooldown (0.15s to 0.35s) is rejected', () => {
  const katana = new Katana(640, 360);
  katana.triggerForcedSlash();

  // Advance past active slash (0.16s)
  katana.update(0.16);
  assert.strictEqual(katana.isForcedSlashing, false, 'Senka active state must end after 150ms');
  assert.ok(katana.forcedSlashCooldownTimer > 0, 'Cooldown timer must still be active');

  // Spam 50 times during cooldown window
  for (let i = 0; i < 50; i++) {
    katana.update(0.003);
    const retriggered = katana.triggerForcedSlash();
    if (katana.forcedSlashCooldownTimer > 0) {
      assert.strictEqual(retriggered, false, 'Must reject re-trigger while cooldown timer > 0');
    }
  }
});

runTest('3.4: Senka can be cleanly re-triggered immediately upon cooldown expiration (t >= 0.35s)', () => {
  const katana = new Katana(640, 360);
  katana.triggerForcedSlash();

  // Advance exactly through entire cooldown
  katana.update(0.36);
  assert.strictEqual(katana.forcedSlashCooldownTimer, 0, 'Cooldown timer must reach 0');

  const retriggered = katana.triggerForcedSlash();
  assert.strictEqual(retriggered, true, 'Senka must succeed immediately after cooldown expires');
  assert.strictEqual(katana.isForcedSlashing, true);
});

runTest('3.5: Violent mouse whip (50,000 px/s) DURING active Senka does not corrupt arc', () => {
  const katana = new Katana(640, 360);
  katana.triggerForcedSlash();
  const startAngle = katana.angle;

  const dt = 1 / 120;
  for (let frame = 0; frame < 18; frame++) { // ~150ms
    // Move mouse wildly at 50,000 px/s
    katana.onMouseMove(Math.random() * 1280, Math.random() * 720);
    katana.update(dt);

    assert.ok(Number.isFinite(katana.angle), `Frame ${frame}: angle not finite`);
    assertTasselIntegrity(katana, `Senka violent whip frame ${frame}`);
    const sq = katana.getSweptQuad();
    assertSweptQuadValidity(sq, `Senka violent whip frame ${frame}`);
  }

  // After 150ms, Senka should complete full 240 degrees (4*PI/3 rad)
  const totalSwept = katana.angle - startAngle;
  assert.ok(Math.abs(totalSwept - (4 * Math.PI / 3)) < 0.05, `Senka must sweep 240 deg (swept ${totalSwept.toFixed(3)} rad)`);
});

runTest('3.6: Concurrent Crescent Wave triggering during Senka', () => {
  const katana = new Katana(640, 360);
  katana.triggerForcedSlash();

  // Fire crescent wave while spinning
  const waveFired = katana.triggerCrescentWave();
  assert.strictEqual(waveFired, true, 'Getsuga wave should fire during Senka');
  assert.strictEqual(katana.projectiles.length, 1);

  // Subsequent wave call must be blocked by 1.8s crescent cooldown
  const wave2Fired = katana.triggerCrescentWave();
  assert.strictEqual(wave2Fired, false, 'Second wave must be blocked by cooldown');

  // Verify wave update does not corrupt katana
  katana.update(0.016);
  assert.ok(katana.projectiles[0].x > 0);
  assert.strictEqual(katana.isForcedSlashing, true);
});

// ============================================================================
// SUITE 4: Stationary Mouse & Velocity Filter Decay Dynamics
// ============================================================================
console.log('\n--- SUITE 4: Stationary Mouse & Velocity Filter Decay Dynamics ---');

runTest('4.1: Moving mouse and then releasing it: speed drops below slashThreshold (280 px/s)', () => {
  const katana = new Katana(640, 360);
  const dt = 1 / 120;

  // Move mouse fast
  for (let i = 0; i < 10; i++) {
    katana.onMouseMove(300 + i * 50, 360);
    katana.update(dt);
  }
  assert.ok(katana.speed > 1000, `Speed during swing should be > 1000 (actual: ${katana.speed})`);
  assert.strictEqual(katana.isSlashing(), true);

  // Release mouse (stop moving mouse, let 120Hz ticks run for 0.5s = 60 ticks)
  for (let i = 0; i < 60; i++) {
    katana.update(dt);
  }

  assert.ok(katana.speed < katana.slashThreshold, `Speed must drop below slash threshold when stationary (speed: ${katana.speed})`);
  assert.strictEqual(katana.isSlashing(), false, 'isSlashing() must be false when stationary');
  assert.strictEqual(katana.canDeflectCero(), false, 'canDeflectCero() must be false when stationary');
});

runTest('4.2: Direct targetMouse == hilt: does speed decay without dt >= 0.04?', () => {
  const katana = new Katana(640, 360);
  katana.speed = 1000;
  katana.hilt = { x: 500, y: 500 };
  katana.targetMouse = { x: 500, y: 500 };

  // At 120Hz (dt = 0.00833s), test if speed decays after 240 ticks (2 seconds)
  for (let i = 0; i < 240; i++) {
    katana.update(1 / 120);
  }

  console.log(`      [Empirical Note] Speed when targetMouse == hilt after 2s @ 120Hz: ${katana.speed}`);
  // Note: We observed earlier that when targetMouse == hilt and dt < 0.04, speed does NOT decay!
  // Let's document whether this is an issue or expected.
  const isStuck = katana.speed === 1000;
  if (isStuck) {
    console.log('      [Observation] Speed remained 1000 because dt < 0.04 bypasses velHistory zeroing.');
  }
});

// ============================================================================
// SUITE 5: Fuzzing & Invariant Stress Across 10,000 Randomized Frames
// ============================================================================
console.log('\n--- SUITE 5: Fuzzing & Invariant Stress (10,000 Randomized Frames) ---');

runTest('5.1: 10,000 frame Monte Carlo fuzzing with adversarial inputs and random dts', () => {
  const katana = new Katana(640, 360);
  let nanOccurrences = 0;
  let tasselExplosions = 0;
  let degenerateQuads = 0;

  for (let frame = 0; frame < 10000; frame++) {
    // Randomize delta time between 1ms (1000Hz) and 100ms (10Hz)
    const dt = 0.001 + Math.random() * 0.099;

    // Adversarial mouse positions: some valid, some out-of-bounds, some NaN/Infinity
    const rand = Math.random();
    if (rand < 0.1) {
      katana.onMouseMove(NaN, NaN);
    } else if (rand < 0.2) {
      katana.onMouseMove(-99999, 99999);
    } else if (rand < 0.3) {
      katana.onMouseMove(Infinity, -Infinity);
    } else {
      katana.onMouseMove(Math.random() * 1280, Math.random() * 720);
    }

    // Random actions
    if (Math.random() < 0.05) katana.triggerForcedSlash();
    if (Math.random() < 0.05) katana.triggerCrescentWave();

    katana.update(dt);

    // Verify invariants
    if (!Number.isFinite(katana.hilt.x) || !Number.isFinite(katana.hilt.y) ||
        !Number.isFinite(katana.tip.x) || !Number.isFinite(katana.tip.y) ||
        !Number.isFinite(katana.angle) || !Number.isFinite(katana.speed)) {
      nanOccurrences++;
    }

    try {
      assertTasselIntegrity(katana, `Fuzz frame ${frame}`);
    } catch (e) {
      tasselExplosions++;
    }

    const sq = katana.getSweptQuad();
    try {
      assertSweptQuadValidity(sq, `Fuzz frame ${frame}`);
    } catch (e) {
      degenerateQuads++;
    }
  }

  assert.strictEqual(nanOccurrences, 0, `Detected ${nanOccurrences} NaN/Infinite values in Katana state`);
  assert.strictEqual(tasselExplosions, 0, `Detected ${tasselExplosions} tassel explosions/elongations`);
  assert.strictEqual(degenerateQuads, 0, `Detected ${degenerateQuads} degenerate SweptQuads`);
});

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passedTests} passed, ${failedTests} failed out of ${totalTests} tests`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
