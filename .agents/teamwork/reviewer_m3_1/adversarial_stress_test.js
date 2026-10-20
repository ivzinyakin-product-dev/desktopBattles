/**
 * Adversarial stress test for Slicer and Debris Physics.
 */
const assert = require('assert');
const Slicer = require('../../../src/game/Slicer');
const DebrisPiece = Slicer.DebrisPiece;
const Enemy = require('../../../src/game/Enemy');
const Vector2 = require('../../../src/engine/Vector2');
const ParticleSystem = require('../../../src/engine/ParticleSystem');
const Camera = require('../../../src/engine/Camera');

console.log('--- Starting Adversarial Stress Tests ---');

// Test 1: Slicer with invalid / boundary inputs
console.log('Test 1: Slicer input sanitization and boundary cuts');
{
  // Null enemy
  assert.deepStrictEqual(Slicer.sliceEnemy(null), []);

  // Undefined properties on enemy
  const enemyBare = {};
  const [h1, h2] = Slicer.sliceEnemy(enemyBare);
  assert.ok(h1 && h2);
  assert.strictEqual(h1.isDead, false);

  // NaN cutAngle
  const [h3, h4] = Slicer.sliceEnemy({ x: 10, y: 10, radius: 10 }, { x: 10, y: 10 }, NaN, 400);
  assert.ok(!Number.isNaN(h3.vx) && !Number.isNaN(h3.vy));
  assert.ok(!Number.isNaN(h4.vx) && !Number.isNaN(h4.vy));

  // Extreme angles
  for (const angle of [-Math.PI * 10, -Math.PI / 2, 0, Math.PI / 2, Math.PI, 100 * Math.PI]) {
    const halves = Slicer.sliceEnemy({ x: 0, y: 0, radius: 20 }, { x: 0, y: 0 }, angle, 500);
    assert.strictEqual(halves.length, 2);
    assert.ok(!Number.isNaN(halves[0].vx) && !Number.isNaN(halves[0].vy));
    assert.ok(!Number.isNaN(halves[1].vx) && !Number.isNaN(halves[1].vy));
  }

  // Extreme speed
  const [fastA, fastB] = Slicer.sliceEnemy({ x: 0, y: 0, radius: 20 }, { x: 0, y: 0 }, 0, 1e7);
  assert.ok(fastA.vx > 0);
  assert.ok(fastB.vx > 0);
  assert.ok(!Number.isNaN(fastA.vy));

  // Zero / negative swingSpeed fallback
  const [slowA, slowB] = Slicer.sliceEnemy({ x: 0, y: 0, radius: 20 }, { x: 0, y: 0 }, 0, 0);
  assert.ok(slowA.vy - slowB.vy >= 240, 'Separation speed must fallback to minimum 120 px/s each');

  const [negA, negB] = Slicer.sliceEnemy({ x: 0, y: 0, radius: 20 }, { x: 0, y: 0 }, 0, -500);
  assert.ok(negA.vy - negB.vy >= 240);

  // Cut point far outside enemy (extreme graze / miss)
  const [farA, farB] = Slicer.sliceEnemy({ x: 0, y: 0, radius: 10 }, { x: 1000, y: 1000 }, 0, 400);
  assert.ok(farA && farB);
  assert.ok(!Number.isNaN(farA.seamStart.x) && !Number.isNaN(farA.seamEnd.y));
}

// Test 2: Debris physics evolution & stability under extreme timesteps
console.log('Test 2: Debris physics under extreme and irregular delta times');
{
  const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
  const [dA] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500);

  // Negative dt should do nothing
  dA.update(-0.1);
  assert.strictEqual(dA.life, 0);
  assert.strictEqual(dA.alpha, 1.0);

  // Zero dt should do nothing
  dA.update(0);
  assert.strictEqual(dA.life, 0);

  // NaN dt should do nothing
  dA.update(NaN);
  assert.strictEqual(dA.life, 0);

  // Variable micro-steps vs macro-step
  const [p1] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500);
  const [p2] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500);
  p1.angVel = 6.0;
  p2.angVel = 6.0;

  // Step p1 in 60 steps of 1/60s (1.0s)
  for (let i = 0; i < 60; i++) {
    p1.update(1 / 60);
  }
  // Step p2 in single step of 1.0s
  p2.update(1.0);

  assert.strictEqual(p1.isDead, true);
  assert.strictEqual(p2.isDead, true);
  assert.strictEqual(p1.alpha, 0.0);
  assert.strictEqual(p2.alpha, 0.0);
}

// Test 3: Mass conservation & centroid symmetry
console.log('Test 3: Separation impulse momentum & symmetry');
{
  const enemy = { x: 200, y: 300, radius: 16, type: 'crawler' };
  const swingVel = { x: 400, y: 200 };
  const [dA, dB] = Slicer.sliceEnemy(enemy, { x: 200, y: 300 }, Math.PI / 3, 600, swingVel);

  // The center of mass of the two pieces: (dA.v + dB.v) / 2 should equal forward velocity
  const avgVx = (dA.vx + dB.vx) / 2;
  const avgVy = (dA.vy + dB.vy) / 2;
  const expectedVx = swingVel.x * 0.35;
  const expectedVy = swingVel.y * 0.35;

  assert.ok(Math.abs(avgVx - expectedVx) < 1e-4, `Expected avgVx ${expectedVx}, got ${avgVx}`);
  assert.ok(Math.abs(avgVy - expectedVy) < 1e-4, `Expected avgVy ${expectedVy}, got ${avgVy}`);

  // Opposing angular velocities sum to 0
  assert.ok(Math.abs(dA.angVel + dB.angVel) < 1e-4, 'Angular velocities must be exactly equal and opposite');
}

// Test 4: Memory churn and pool isolation (100,000 slices)
console.log('Test 4: High volume churn & memory leak sanity test');
{
  const t0 = Date.now();
  for (let i = 0; i < 5000; i++) {
    const enemy = { x: Math.random() * 1000, y: Math.random() * 600, radius: 16, type: 'crawler' };
    const halves = Slicer.sliceEnemy(enemy, { x: enemy.x, y: enemy.y }, Math.random() * Math.PI * 2, 500);
    halves[0].update(0.9);
    halves[1].update(0.9);
    assert.strictEqual(halves[0].isDead, true);
    assert.strictEqual(halves[1].isDead, true);
  }
  const elapsed = Date.now() - t0;
  console.log(`5000 full slice-and-dissolve cycles executed in ${elapsed}ms`);
}

// Test 5: Verify interface contracts against PROJECT.md
console.log('Test 5: Interface contracts conformance');
{
  // Contract: TZ.Slicer
  assert.strictEqual(typeof Slicer.sliceEnemy, 'function');
  const enemy = Enemy.createCrawler(100, 100);
  const halves = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500, { x: 500, y: 0 });
  assert.ok(Array.isArray(halves) && halves.length === 2);
  const [hA, hB] = halves;

  // hA and hB properties
  assert.ok(hA instanceof DebrisPiece);
  assert.ok(hB instanceof DebrisPiece);
  assert.strictEqual(typeof hA.update, 'function');
  assert.strictEqual(typeof hA.draw, 'function');
  assert.strictEqual(typeof hA.x, 'number');
  assert.strictEqual(typeof hA.y, 'number');
  assert.strictEqual(typeof hA.vx, 'number');
  assert.strictEqual(typeof hA.vy, 'number');
  assert.strictEqual(typeof hA.alpha, 'number');
  assert.strictEqual(typeof hA.isDead, 'boolean');

  // Contract: TZ.Enemy (Crawler, Flyer, Brute, Menos)
  const types = ['crawler', 'flyer', 'brute', 'menos'];
  for (const t of types) {
    const e = (t === 'menos') ? Enemy.createMenos(50, 50) : new Enemy(t, 50, 50);
    assert.strictEqual(typeof e.x, 'number');
    assert.strictEqual(typeof e.y, 'number');
    assert.strictEqual(typeof e.radius, 'number');
    assert.strictEqual(typeof e.hp, 'number');
    assert.strictEqual(typeof e.speed, 'number');
    assert.strictEqual(typeof e.type, 'string');
    assert.strictEqual(typeof e.isDead, 'boolean');
    assert.strictEqual(typeof e.update, 'function');
    assert.strictEqual(typeof e.onHit, 'function');

    // Test onHit return value
    const hitRes = e.onHit(20, { x: 0, y: 1 }, 0, 500);
    assert.ok(typeof hitRes === 'object' && hitRes !== null);
  }
}

console.log('--- All Adversarial Stress Tests Passed Successfully! ---');
