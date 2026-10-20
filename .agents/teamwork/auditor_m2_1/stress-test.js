/**
 * Independent Forensic Auditor Adversarial Stress Test Suite
 * Milestone 2 (Katana & Combat Subsystem)
 */

const assert = require('node:assert');
const Katana = require('../../../src/game/Katana.js');
const { GetsugaWave, Projectile } = require('../../../src/game/Projectile.js');
const Vector2 = require('../../../src/engine/Vector2.js');

console.log('=== Starting Adversarial Stress Tests for Milestone 2 ===');

// 1. Stress Test: Delta Time Extremes & Division by Zero
console.log('1. Testing Delta Time Extremes (dt = 0, negative, huge lag spike)...');
{
  const katana = new Katana(640, 360);
  katana.update(0);
  assert.ok(!Number.isNaN(katana.hilt.x) && !Number.isNaN(katana.hilt.y));
  assert.ok(!Number.isNaN(katana.speed));

  katana.update(-0.016);
  assert.ok(!Number.isNaN(katana.hilt.x) && !Number.isNaN(katana.hilt.y));

  // Lag spike of 10 seconds
  katana.onMouseMove(800, 400);
  katana.update(10.0);
  assert.ok(!Number.isNaN(katana.hilt.x) && !Number.isNaN(katana.hilt.y));
  assert.ok(!Number.isNaN(katana.angle));
  assert.ok(!Number.isNaN(katana.speed));
}
console.log('  -> PASS');

// 2. Stress Test: Out-of-bounds, Non-numeric, NaN, Infinity inputs
console.log('2. Testing Non-numeric / NaN / Infinity Inputs...');
{
  const katana = new Katana(640, 360);
  katana.onMouseMove(NaN, NaN);
  assert.ok(!Number.isNaN(katana.targetMouse.x));
  assert.ok(!Number.isNaN(katana.targetMouse.y));

  katana.onMouseMove(Infinity, -Infinity);
  assert.strictEqual(katana.targetMouse.x, 1280);
  assert.strictEqual(katana.targetMouse.y, 0);

  katana.onMouseMove('invalid', { foo: 'bar' });
  assert.ok(!Number.isNaN(katana.targetMouse.x));

  katana.update(0.016, NaN, NaN);
  assert.ok(!Number.isNaN(katana.angle));
}
console.log('  -> PASS');

// 3. Stress Test: Tassel Verlet Physics under Catastrophic Teleportation
console.log('3. Testing Tassel Verlet Physics under Catastrophic Teleportation...');
{
  const katana = new Katana(640, 360);
  for (let i = 0; i < 60; i++) {
    katana.update(0.016);
  }

  // Sudden catastrophic teleportation across 50,000 pixels
  katana.hilt = { x: 50000, y: -50000 };
  katana.onMouseMove(50000, -50000);
  katana.update(0.016);

  for (let i = 0; i < katana.tasselNodes.length; i++) {
    const node = katana.tasselNodes[i];
    assert.ok(!Number.isNaN(node.x), `Node ${i} X is NaN after teleport`);
    assert.ok(!Number.isNaN(node.y), `Node ${i} Y is NaN after teleport`);
    assert.ok(Number.isFinite(node.x), `Node ${i} X is Infinite after teleport`);
    assert.ok(Number.isFinite(node.y), `Node ${i} Y is Infinite after teleport`);
  }

  // Verify distance between adjacent nodes remains bounded
  for (let i = 0; i < katana.tasselNodes.length - 1; i++) {
    const nA = katana.tasselNodes[i];
    const nB = katana.tasselNodes[i + 1];
    const dist = Math.hypot(nB.x - nA.x, nB.y - nA.y);
    assert.ok(dist < 50, `Distance between link ${i} and ${i+1} blew up: ${dist}`);
  }
}
console.log('  -> PASS');

// 4. Stress Test: High-Frequency Mouse Jitter & Angular Branch Cut Stability
console.log('4. Testing High-Frequency Mouse Jitter & Branch Cut Crossing...');
{
  const katana = new Katana(640, 360);
  // Rapid oscillation around Altar across the -X axis (where angle is +/- PI)
  for (let i = 0; i < 2000; i++) {
    const yOffset = (i % 2 === 0 ? 0.001 : -0.001);
    katana.hilt = { x: 500, y: 360 + yOffset };
    katana.targetMouse = { x: 500, y: 360 + yOffset };
    katana.speed = 10;
    katana.update(0.008); // 120Hz tick
    assert.ok(!Number.isNaN(katana.angle), `Angle became NaN at iteration ${i}`);
    assert.ok(Number.isFinite(katana.angle), `Angle became Infinite at iteration ${i}`);
    assert.ok(Math.abs(katana.angle) <= Math.PI + 0.1, `Angle exploded: ${katana.angle}`);
  }
}
console.log('  -> PASS');

// 5. Stress Test: Forced Slash ("Senka") Interruption & Re-triggering
console.log('5. Testing Senka Forced Slash State Machine...');
{
  const katana = new Katana(640, 360);
  assert.strictEqual(katana.triggerForcedSlash(), true);
  assert.strictEqual(katana.isForcedSlashing, true);

  // Spam triggers while active
  for (let i = 0; i < 100; i++) {
    assert.strictEqual(katana.triggerForcedSlash(), false);
  }

  // Step halfway through slash
  katana.update(0.075);
  assert.strictEqual(katana.isForcedSlashing, true);
  assert.ok(katana.isSlashing());
  assert.ok(katana.canDeflectCero());

  // Step past end of slash
  katana.update(0.08); // Total 0.155s > 0.150s
  assert.strictEqual(katana.isForcedSlashing, false);

  // Still on cooldown (total 0.155s < 0.35s)
  assert.strictEqual(katana.triggerForcedSlash(), false);

  // Fast-forward cooldown
  katana.update(0.25);
  assert.strictEqual(katana.triggerForcedSlash(), true);
}
console.log('  -> PASS');

// 6. Stress Test: Getsuga Wave Lifecycle & Massive Collision Batch
console.log('6. Testing Getsuga Wave Lifecycle, Pierce Limit & Collision Geometry...');
{
  const wave = new GetsugaWave(0, 0, 1, 0, { speed: 820, maxPierces: 8 });
  assert.strictEqual(wave.isDead, false);

  // Test circular hits along entire parabolic arc
  // Wing tips at x = -14.7, y = +/-42. Crest at x = +18.9, y = 0
  assert.strictEqual(wave.intersectsCircle(18.9, 0, 10), true, 'Crest hit');
  assert.strictEqual(wave.intersectsCircle(-14.7, 42, 10), true, 'Top wing tip hit');
  assert.strictEqual(wave.intersectsCircle(-14.7, -42, 10), true, 'Bottom wing tip hit');
  assert.strictEqual(wave.intersectsCircle(100, 100, 10), false, 'Far miss');

  // Pierce test with 100 enemies placed on the parabolic crest (x = 18.9, y = 0)
  let hits = 0;
  for (let i = 0; i < 100; i++) {
    const dummy = { x: 18.9, y: 0, radius: 10, isDead: false, onHit: () => {} };
    if (wave.checkHit(dummy)) {
      hits++;
    }
  }
  assert.strictEqual(hits, 8, `Expected exactly 8 pierces, got ${hits}`);
  assert.strictEqual(wave.isDead, true);

  // Re-hitting the same enemy must fail
  const enemyA = { x: 18.9, y: 0, radius: 10, isDead: false };
  const wave2 = new GetsugaWave(0, 0, 1, 0);
  assert.strictEqual(wave2.checkHit(enemyA), true);
  assert.strictEqual(wave2.checkHit(enemyA), false);
}
console.log('  -> PASS');

// 7. Stress Test: Memory Leaks & Buffer Caps
console.log('7. Testing Memory Boundaries (Trail Buffer & Projectile List Capping)...');
{
  const katana = new Katana(640, 360);
  // Perform 1000 fast updates
  for (let i = 0; i < 1000; i++) {
    katana.speed = 800;
    katana.hilt.x += 1;
    katana.update(0.008);
  }
  assert.ok(katana.trail.length <= 16, `Trail buffer exceeded 16: ${katana.trail.length}`);

  // Test projectile auto-pruning
  katana.triggerCrescentWave(640, 360, 1, 0);
  assert.strictEqual(katana.projectiles.length, 1);
  katana.update(2.0); // 2 seconds > 1.6s lifespan
  assert.strictEqual(katana.projectiles.length, 0, 'Dead projectiles must be pruned automatically');
}
console.log('  -> PASS');

console.log('=== All Adversarial Stress Tests Passed Successfully! ===');
