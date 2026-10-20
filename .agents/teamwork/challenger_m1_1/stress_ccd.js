/**
 * Adversarial Stress Test Harness for Milestone 1 (Engine Core)
 * Tests SweptQuad CCD and GameLoop timing under extreme conditions.
 * 
 * Challenger 1: Empirical Adversarial Challenge Suite
 */
const path = require('path');

const projectRoot = path.resolve(__dirname, '../../../');
const Vector2 = require(path.join(projectRoot, 'src/engine/Vector2.js'));
const SweptQuad = Vector2.SweptQuad;
const GameLoop = require(path.join(projectRoot, 'src/engine/GameLoop.js'));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    const msg = `  [FAIL] ${testName}${details ? ' - ' + details : ''}`;
    console.error(msg);
    failures.push(msg);
  }
}

function assertClose(actual, expected, eps, testName) {
  const diff = Math.abs(actual - expected);
  assert(diff <= eps, testName, `Expected ${expected} +/- ${eps}, got ${actual} (diff: ${diff})`);
}

console.log('================================================================');
console.log('STARTING EMPIRICAL ADVERSARIAL STRESS TEST: MILESTONE 1');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: SweptQuad CCD under Extreme Velocities (10,000 px/s & 50,000 px/s)
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: High-Velocity Sweeps (10k px/s and 50k px/s) ---');
{
  const bladeLen = 70;
  const dt120 = 1 / 120;
  
  // 10,000 px/s horizontal whip: dx = 83.333 px/tick
  const speed10k = 10000;
  const dx10k = speed10k * dt120;
  const h0_10k = new Vector2(100, 200);
  const t0_10k = new Vector2(100, 200 + bladeLen);
  const h1_10k = new Vector2(100 + dx10k, 200);
  const t1_10k = new Vector2(100 + dx10k, 200 + bladeLen);
  const quad10k = SweptQuad.fromBladeSegments(h0_10k, t0_10k, h1_10k, t1_10k);

  assert(quad10k.intersectsCircle(new Vector2(140, 235), 8), '10k px/s: detects circle in middle of sweep path');
  assert(quad10k.intersectsCircle(new Vector2(140, 235), 1), '10k px/s: detects 1px tiny collider in middle of sweep');
  assert(!quad10k.intersectsCircle(new Vector2(140, 180), 10), '10k px/s: rejects circle above sweep envelope');
  assert(!quad10k.intersectsCircle(new Vector2(80, 235), 10), '10k px/s: rejects circle behind sweep start');
  assert(!quad10k.intersectsCircle(new Vector2(200, 235), 10), '10k px/s: rejects circle ahead of sweep end');

  // 50,000 px/s extreme horizontal whip: dx = 416.667 px/tick
  const speed50k = 50000;
  const dx50k = speed50k * dt120;
  const h0_50k = new Vector2(100, 300);
  const t0_50k = new Vector2(100, 300 + bladeLen);
  const h1_50k = new Vector2(100 + dx50k, 300);
  const t1_50k = new Vector2(100 + dx50k, 300 + bladeLen);
  const quad50k = SweptQuad.fromBladeSegments(h0_50k, t0_50k, h1_50k, t1_50k);

  assert(quad50k.intersectsCircle(new Vector2(150, 335), 12), '50k px/s: detects enemy at 12% along corridor');
  assert(quad50k.intersectsCircle(new Vector2(308, 335), 12), '50k px/s: detects enemy at 50% along corridor (mid-whip)');
  assert(quad50k.intersectsCircle(new Vector2(480, 335), 12), '50k px/s: detects enemy at 91% along corridor (near end)');
  assert(quad50k.intersectsCircle(new Vector2(300, 335), 0.5), '50k px/s: detects 0.5px sub-pixel collider at mid-whip');
  
  let allDetected = true;
  for (let x = 120; x <= 500; x += 80) {
    if (!quad50k.intersectsCircle(new Vector2(x, 335), 10)) {
      allDetected = false;
    }
  }
  assert(allDetected, '50k px/s: detects all 5 sequential targets along sweep corridor without tunneling');

  // 50,000 px/s angular whip (90-degree circular flick around hilt)
  const rotHilt = new Vector2(400, 400);
  const rotT0 = new Vector2(470, 400);
  const rotT1 = new Vector2(400, 470);
  const rotQuad = SweptQuad.fromBladeSegments(rotHilt, rotT0, rotHilt, rotT1);
  assert(rotQuad.intersectsCircle(new Vector2(430, 430), 10), 'Angular flick: detects enemy inside swept sector triangle');
  assert(!rotQuad.intersectsCircle(new Vector2(350, 350), 10), 'Angular flick: rejects enemy behind pivot');
}

// -----------------------------------------------------------------------------
// SECTION 2: Stationary and Zero-Length Blade Segments
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Stationary & Zero-Length Blade Segments ---');
{
  const hilt = new Vector2(200, 200);
  const tip = new Vector2(200, 270);
  const statQuad = SweptQuad.fromBladeSegments(hilt, tip, hilt, tip);
  
  assert(statQuad.intersectsCircle(new Vector2(205, 235), 10), 'Stationary blade: intersects circle overlapping line segment');
  assert(statQuad.intersectsCircle(new Vector2(200, 200), 5), 'Stationary blade: intersects circle at hilt vertex');
  assert(statQuad.intersectsCircle(new Vector2(200, 270), 5), 'Stationary blade: intersects circle at tip vertex');
  assert(!statQuad.intersectsCircle(new Vector2(225, 235), 10), 'Stationary blade: rejects circle 25px away from segment');

  const pt = new Vector2(300, 300);
  const zeroQuad = SweptQuad.fromBladeSegments(pt, pt, pt, pt);
  assert(zeroQuad.intersectsCircle(new Vector2(300, 300), 5), 'Zero-length stationary: intersects circle enclosing point');
  assert(zeroQuad.intersectsCircle(new Vector2(304, 300), 5), 'Zero-length stationary: intersects circle overlapping point (dist 4 <= 5)');
  assert(!zeroQuad.intersectsCircle(new Vector2(306, 300), 5), 'Zero-length stationary: rejects circle outside point (dist 6 > 5)');

  const expandQuad = SweptQuad.fromBladeSegments(pt, pt, new Vector2(300, 300), new Vector2(300, 370));
  assert(expandQuad.intersectsCircle(new Vector2(300, 335), 10), 'Expanding blade: detects circle along expanded segment');
  
  const collapseQuad = SweptQuad.fromBladeSegments(new Vector2(300, 300), new Vector2(300, 370), pt, pt);
  assert(collapseQuad.intersectsCircle(new Vector2(300, 335), 10), 'Collapsing blade: detects circle along collapsed segment');
}

// -----------------------------------------------------------------------------
// SECTION 3: Collinear & Degenerate Quads
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Collinear & Degenerate Quads ---');
{
  const colXQuad = new SweptQuad(
    new Vector2(100, 100),
    new Vector2(200, 100),
    new Vector2(300, 100),
    new Vector2(150, 100)
  );

  assert(colXQuad.intersectsCircle(new Vector2(180, 100), 5), 'Collinear X: intersects circle centered on line');
  assert(colXQuad.intersectsCircle(new Vector2(180, 95), 6), 'Collinear X: intersects circle touching line (dist 5 <= 6)');
  assert(!colXQuad.intersectsCircle(new Vector2(180, 90), 5), 'Collinear X: rejects circle not touching line (dist 10 > 5)');
  assert(!colXQuad.intersectsCircle(new Vector2(320, 100), 10), 'Collinear X: rejects circle beyond collinear segment end');

  const colYQuad = new SweptQuad(
    new Vector2(500, 100),
    new Vector2(500, 200),
    new Vector2(500, 350),
    new Vector2(500, 150)
  );
  assert(colYQuad.intersectsCircle(new Vector2(500, 250), 10), 'Collinear Y: intersects circle on line');
  assert(!colYQuad.intersectsCircle(new Vector2(530, 250), 10), 'Collinear Y: rejects circle 30px away');

  const revQuad = SweptQuad.fromBladeSegments(
    new Vector2(100, 100), new Vector2(150, 100),
    new Vector2(120, 100), new Vector2(170, 100)
  );
  assert(revQuad.intersectsCircle(new Vector2(135, 100), 5), 'Reversing sweep: intersects target in swept line interval');
  assert(!revQuad.intersectsCircle(new Vector2(190, 100), 5), 'Reversing sweep: rejects target outside swept interval');
}

// -----------------------------------------------------------------------------
// SECTION 4: Tangential Circle Grazes with Sub-Millimeter Precision
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Sub-Millimeter Precision Tangential Grazes ---');
{
  const quad = new SweptQuad(
    new Vector2(100, 100),
    new Vector2(200, 100),
    new Vector2(200, 200),
    new Vector2(100, 200)
  );
  const R = 15;
  const eps = 1e-4;

  // Bottom Edge Tangent
  assert(quad.intersectsCircle(new Vector2(150, 85), R), 'Graze Bottom: exact tangent (dist == R) intersects');
  assert(quad.intersectsCircle(new Vector2(150, 85 + eps), R), 'Graze Bottom: penetration by 1e-4 intersects');
  assert(!quad.intersectsCircle(new Vector2(150, 85 - eps), R), 'Graze Bottom: separation by 1e-4 rejects');

  // Top Edge Tangent
  assert(quad.intersectsCircle(new Vector2(150, 215), R), 'Graze Top: exact tangent (dist == R) intersects');
  assert(quad.intersectsCircle(new Vector2(150, 215 - eps), R), 'Graze Top: penetration by 1e-4 intersects');
  assert(!quad.intersectsCircle(new Vector2(150, 215 + eps), R), 'Graze Top: separation by 1e-4 rejects');

  // Left Edge Tangent
  assert(quad.intersectsCircle(new Vector2(85, 150), R), 'Graze Left: exact tangent (dist == R) intersects');
  assert(quad.intersectsCircle(new Vector2(85 + eps, 150), R), 'Graze Left: penetration by 1e-4 intersects');
  assert(!quad.intersectsCircle(new Vector2(85 - eps, 150), R), 'Graze Left: separation by 1e-4 rejects');

  // Right Edge Tangent
  assert(quad.intersectsCircle(new Vector2(215, 150), R), 'Graze Right: exact tangent (dist == R) intersects');
  assert(quad.intersectsCircle(new Vector2(215 - eps, 150), R), 'Graze Right: penetration by 1e-4 intersects');
  assert(!quad.intersectsCircle(new Vector2(215 + eps, 150), R), 'Graze Right: separation by 1e-4 rejects');

  // Corner Vertex Tangent (testing with penetration vs separation)
  const dInside = (R - eps) * Math.SQRT1_2;
  const dOutside = (R + eps) * Math.SQRT1_2;
  assert(quad.intersectsCircle(new Vector2(200 + dInside, 200 + dInside), R), 'Graze Corner: penetration by 1e-4 intersects');
  assert(!quad.intersectsCircle(new Vector2(200 + dOutside, 200 + dOutside), R), 'Graze Corner: separation by 1e-4 rejects');

  // Exact diagonal corner float precision check (investigation test)
  const exactCornerX = 200 + R * Math.SQRT1_2;
  const exactCornerY = 200 + R * Math.SQRT1_2;
  const exactCornerHit = quad.intersectsCircle(new Vector2(exactCornerX, exactCornerY), R);
  assert(
    exactCornerHit,
    'Graze Corner Exact Tangent: exact diagonal vertex tangent',
    'Fails due to IEEE-754 precision overshoot (+2.84e-14 in distSq) with strict <= rSq'
  );

  // 50,000 px/s High-Velocity Tangential Graze
  const sweepH0 = new Vector2(0, 100);
  const sweepT0 = new Vector2(0, 170);
  const sweepH1 = new Vector2(416.67, 100);
  const sweepT1 = new Vector2(416.67, 170);
  const highSpeedQuad = SweptQuad.fromBladeSegments(sweepH0, sweepT0, sweepH1, sweepT1);
  assert(highSpeedQuad.intersectsCircle(new Vector2(200, 85), R), 'High-speed graze: exact tangent along 50k px/s corridor intersects');
  assert(!highSpeedQuad.intersectsCircle(new Vector2(200, 85 - eps), R), 'High-speed graze: separated by 1e-4 along 50k px/s corridor rejects');
}

// -----------------------------------------------------------------------------
// SECTION 5: Circle Completely Inside Quad vs Completely Outside
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Circle Inside vs Outside Quad ---');
{
  const quad = new SweptQuad(
    new Vector2(100, 100),
    new Vector2(400, 100),
    new Vector2(350, 400),
    new Vector2(150, 350)
  );

  assert(quad.containsPoint(new Vector2(250, 250)), 'Inside quad: centroid containsPoint is true');
  assert(quad.intersectsCircle(new Vector2(250, 250), 10), 'Inside quad: small circle completely internal intersects');
  assert(quad.intersectsCircle(new Vector2(250, 250), 1), 'Inside quad: 1px micro-circle completely internal intersects');

  assert(quad.intersectsCircle(new Vector2(250, 250), 500), 'Enclosing circle: massive circle covering entire quad intersects');
  assert(!quad.intersectsCircle(new Vector2(1000, 1000), 50), 'Outside quad: far away circle rejects');

  // Point in AABB corner cutout: inside AABB [100..400]x[100..400], but outside polygon
  assert(!quad.containsPoint(new Vector2(390, 390)), 'AABB corner: point inside AABB but outside quad containsPoint is false');
  assert(!quad.intersectsCircle(new Vector2(390, 390), 10), 'AABB corner: circle radius 10 inside AABB but outside quad rejects');
  // Distance from (390, 390) to edge (400,100)-(350,400) is 37.81px. Circle radius 45 overlaps edge!
  assert(quad.intersectsCircle(new Vector2(390, 390), 45), 'AABB corner: circle radius 45 inside AABB overlapping quad edge intersects');
}

// -----------------------------------------------------------------------------
// SECTION 6: Adversarial Concave Swept Quad Stress Test (Blade Translation + Rotation)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 6: Concave Swept Quad Stress Test (Translation + Rotation) ---');
{
  // Realistic sword swing combining hilt motion and tip rotation:
  // H0=(200, 200), T0=(137.95, 167.61) [blade length 70px]
  // H1=(277.88, 284.49), T1=(283.32, 214.70)
  const h0 = new Vector2(200, 200);
  const t0 = new Vector2(137.95, 167.61);
  const h1 = new Vector2(277.88, 284.49);
  const t1 = new Vector2(283.32, 214.70);
  const concaveQuad = SweptQuad.fromBladeSegments(h0, t0, h1, t1);

  // Target located strictly inside the swept polygon volume at (266, 250)
  // Distance to all 4 edges is > 10px. Circle radius is 3px.
  const internalTarget = new Vector2(266, 250);
  const hitDetected = concaveQuad.intersectsCircle(internalTarget, 3);
  assert(
    hitDetected,
    'Concave Quad: detects internal circle collider without edge contact',
    'FAILED: containsPoint() returned false on concave quad, causing tunneling through enemy!'
  );
}

// -----------------------------------------------------------------------------
// SECTION 7: GameLoop Timing under Extreme Simulated Frame Stalls
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 7: GameLoop Timing under Frame Stalls & Bursts ---');
{
  let updateTicks = 0;
  let renderFrames = 0;
  const loop = new GameLoop({
    targetFps: 120,
    maxAccumulator: 0.1,
    update: (dt) => {
      updateTicks++;
    },
    render: () => {
      renderFrames++;
    }
  });

  const step1 = loop.tickManual(1 / 120);
  assert(step1.ticks === 1, 'GameLoop: 1/120s produces exactly 1 tick');
  assert(updateTicks === 1, 'GameLoop: update called exactly once');

  // 1.0s Freeze: clamp to 12 ticks (0.1s / (1/120s))
  updateTicks = 0;
  const freeze1s = loop.tickManual(1.0);
  assert(freeze1s.ticks === 12, '1.0s Freeze: tick count strictly clamped to 12 ticks (maxAccumulator=0.1s)');
  assert(updateTicks === 12, '1.0s Freeze: update called exactly 12 times (no spiral of death)');
  assert(loop.accumulator < 1 / 120, '1.0s Freeze: residual accumulator is strictly less than 1 tick dt');

  // 500ms Spike
  updateTicks = 0;
  const spike500ms = loop.tickManual(0.5);
  assert(spike500ms.ticks === 12, '500ms Spike: tick count strictly clamped to 12 ticks');
  assert(updateTicks === 12, '500ms Spike: update called exactly 12 times');

  // Rapid rAF bursts (100 frames with dt=0.0001s = 0.01s total)
  updateTicks = 0;
  renderFrames = 0;
  loop.accumulator = 0;
  for (let i = 0; i < 100; i++) {
    loop.tickManual(0.0001);
  }
  assert(renderFrames === 100, 'Rapid rAF bursts: all 100 render frames executed');
  assert(updateTicks === 1, 'Rapid rAF bursts: exactly 1 tick executed across 100 micro-frames (0.01s total)');

  // Zero-time frames
  updateTicks = 0;
  const zeroFrame = loop.tickManual(0);
  assert(zeroFrame.ticks === 0, 'Zero-time frame: 0 ticks executed');

  // Negative delta time
  updateTicks = 0;
  const negFrame = loop.tickManual(-0.25);
  assert(negFrame.ticks === 0, 'Negative delta: 0 ticks executed, clamped safely');

  // NaN / Infinity delta time
  updateTicks = 0;
  const nanFrame = loop.tickManual(NaN);
  assert(nanFrame.ticks === 0, 'NaN delta: 0 ticks executed, fallback to 0');
  const infFrame = loop.tickManual(Infinity);
  assert(infFrame.ticks === 12, 'Infinity delta: clamped safely to maxAccumulator (12 ticks)');

  // Pause / Resume
  updateTicks = 0;
  loop.pause();
  assert(loop.isPaused, 'Pause: isPaused flag is true');
  const pausedStep = loop.tickManual(0.5);
  assert(pausedStep.ticks === 0, 'Paused: 0 ticks executed during 500ms lag spike');
  loop.resume();
  assert(!loop.isPaused, 'Resume: isPaused flag is false');
  assert(loop.accumulator === 0, 'Resume: accumulator cleared to prevent delta surge');

  // Long-term timing conservation over 1,000 variable frames
  loop.accumulator = 0;
  let totalSimulatedSec = 0;
  let seed = 42;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  for (let i = 0; i < 1000; i++) {
    const frameDt = 0.004 + rnd() * (0.033 - 0.004);
    totalSimulatedSec += Math.min(frameDt, 0.1);
    loop.tickManual(frameDt);
  }
  assert(loop.accumulator >= 0 && loop.accumulator < 1 / 120, 'Timing conservation: final accumulator within [0, dt)');
}

// -----------------------------------------------------------------------------
// SECTION 8: Summary & Verdict
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`STRESS TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
if (failedTests > 0) {
  console.log('FAILURES:');
  failures.forEach(f => console.error(f));
  console.log('\nVERDICT: REQUEST_CHANGES');
  process.exit(1);
} else {
  console.log('VERDICT: ALL ADVERSARIAL STRESS TESTS PASSED (APPROVE)');
  console.log('================================================================');
  process.exit(0);
}
