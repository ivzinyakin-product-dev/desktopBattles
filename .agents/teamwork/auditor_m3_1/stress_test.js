const assert = require('node:assert');
const Slicer = require('../../../src/game/Slicer.js');
const { DebrisPiece } = Slicer;
const Enemy = require('../../../src/game/Enemy.js');
const { MenosGrande } = Enemy;
const Vector2 = require('../../../src/engine/Vector2.js');

console.log('--- STARTING ADVERSARIAL STRESS TEST SUITE ---');

// 1. Degenerate & Extreme Inputs to Slicer.computeCutNormal
console.log('Test 1: Slicer.computeCutNormal robustness...');
const normals = [
  Slicer.computeCutNormal(0),
  Slicer.computeCutNormal(Math.PI / 2),
  Slicer.computeCutNormal(-Math.PI),
  Slicer.computeCutNormal(1e6),
  Slicer.computeCutNormal(-1e6),
  Slicer.computeCutNormal(NaN),
  Slicer.computeCutNormal(undefined)
];
for (const n of normals) {
  assert.ok(!Number.isNaN(n.x), 'Normal X must not be NaN');
  assert.ok(!Number.isNaN(n.y), 'Normal Y must not be NaN');
  const mag = Math.hypot(n.x, n.y);
  assert.ok(Math.abs(mag - 1.0) < 1e-4, 'Normal must be normalized unit vector');
}
console.log('PASS: Slicer.computeCutNormal is robust under extreme/invalid angles');

// 2. Degenerate Geometry in Slicer.sliceEnemy
console.log('Test 2: Slicer.sliceEnemy edge cases...');
// Zero radius enemy
const zeroRadEnemy = { x: 100, y: 100, radius: 0, type: 'crawler' };
const halves0 = Slicer.sliceEnemy(zeroRadEnemy, { x: 100, y: 100 }, 0, 500);
assert.strictEqual(halves0.length, 2);
assert.ok(!Number.isNaN(halves0[0].vx));
assert.ok(!Number.isNaN(halves0[1].vy));

// Cut far outside enemy bounding box (10,000 px away)
const farCutHalves = Slicer.sliceEnemy({ x: 0, y: 0, radius: 16 }, { x: 10000, y: 10000 }, 0, 500);
assert.strictEqual(farCutHalves.length, 2);
assert.ok(!Number.isNaN(farCutHalves[0].seamStart.x));
assert.ok(!Number.isNaN(farCutHalves[1].seamEnd.y));

// Extreme swing speed (100,000 px/s)
const hyperHalves = Slicer.sliceEnemy({ x: 0, y: 0, radius: 16 }, { x: 0, y: 0 }, 0, 100000);
assert.strictEqual(hyperHalves.length, 2);
assert.ok(hyperHalves[0].vx !== hyperHalves[1].vx || hyperHalves[0].vy !== hyperHalves[1].vy);

// Null or empty enemy
assert.deepStrictEqual(Slicer.sliceEnemy(null), []);
assert.deepStrictEqual(Slicer.sliceEnemy(undefined), []);
console.log('PASS: Slicer.sliceEnemy handles zero radius, extreme distances, high speeds, and null gracefully');

// 3. Debris Piece Update and Dissolution Stability
console.log('Test 3: DebrisPiece physics & dissolution stress...');
const [halfA, halfB] = hyperHalves;
// Update with negative dt or 0 dt
halfA.update(0);
halfA.update(-0.1);
assert.strictEqual(halfA.life, 0);

// Advance in tiny 120Hz micro-steps up to 1.5s
let steps = 0;
while (!halfA.isDead && steps < 2000) {
  halfA.update(1 / 120);
  steps++;
}
assert.strictEqual(halfA.isDead, true);
assert.strictEqual(halfA.alpha, 0);
assert.ok(!Number.isNaN(halfA.x));
assert.ok(!Number.isNaN(halfA.y));
assert.ok(!Number.isNaN(halfA.angle));
console.log('PASS: DebrisPiece dissolves cleanly over micro-steps without NaN or infinite loops');

// 4. Enemy Flocking Separation: Coincident Coordinates (dist = 0)
console.log('Test 4: Enemy flocking separation with coincident positions...');
const e1 = Enemy.createCrawler(200, 200);
const e2 = Enemy.createCrawler(200, 200); // Exact same location
const push = e1.applySeparation([e2]);
assert.ok(!Number.isNaN(e1.vx), 'Velocity X must not be NaN with dist = 0');
assert.ok(!Number.isNaN(e1.vy), 'Velocity Y must not be NaN with dist = 0');
assert.strictEqual(push.pushX, 0);
assert.strictEqual(push.pushY, 0);
console.log('PASS: Coincident enemy flocking does not divide by zero or yield NaN');

// 5. Flyer Evasion with NaN / extreme coordinates
console.log('Test 5: Flyer evasion with invalid blade inputs...');
const flyer = Enemy.createFlyer(100, 100);
assert.strictEqual(flyer.evadeBlade(null), false);
assert.strictEqual(flyer.evadeBlade({ x: NaN, y: 100 }), false);
assert.strictEqual(flyer.evadeBlade({ x: 100, y: 100 }, 400), true);
assert.ok(!Number.isNaN(flyer.vx));
assert.ok(!Number.isNaN(flyer.vy));
console.log('PASS: Flyer evasion handles invalid blade coordinates defensively');

// 6. Armored Brute Boundary Conditions
console.log('Test 6: Armored Brute speed boundary conditions...');
const brute = Enemy.createBrute(0, 0);
// 599.999 px/s -> ricochet
const resRicochet = brute.onHit(30, { x: 0, y: 1 }, 0, 599.999);
assert.strictEqual(resRicochet.ricochet, true);
assert.strictEqual(brute.armorBroken, false);

// 600.000 px/s -> crack
const resCrack = brute.onHit(30, { x: 0, y: 1 }, 0, 600.0);
assert.strictEqual(resCrack.cracked, true);
assert.strictEqual(brute.armorBroken, true);
assert.strictEqual(brute.stunTimer, 1.2);

// Subsequent hit at low speed after armor is broken -> clean bisect
const resBisect = brute.onHit(50, { x: 0, y: 1 }, 0, 100);
assert.strictEqual(resBisect.bisect, true);
assert.strictEqual(brute.isDead, true);
console.log('PASS: Armored Brute strictly respects 600 px/s threshold and stun state');

// 7. Menos Grande Cero Deflection Math & Stun Progression
console.log('Test 7: Menos Grande Cero deflection math...');
const menos = Enemy.createMenos(640 - 280, 360);
menos.state = 'CERO';
menos.aimAngle = 0; // Pointing +X towards Altar at (640, 360)

// Test beam intersection for circle directly in beam path
assert.strictEqual(menos.checkBeamIntersectsCircle(500, 360, 10), true);
// Test beam intersection for circle outside beam width
assert.strictEqual(menos.checkBeamIntersectsCircle(500, 360 + 60, 10), false);
// Test beam intersection behind mouth
assert.strictEqual(menos.checkBeamIntersectsCircle(menos.x - 50, 360, 10), false);

// Deflect cero
menos.deflectCero({ x: 500, y: 360 });
assert.strictEqual(menos.isDeflected, true);
assert.strictEqual(menos.stunTimer, 1.5);
assert.strictEqual(menos.getCeroDamage(), 0);

// Verify Altar at (640, 360) is NO LONGER in deflected beam path
assert.strictEqual(menos.checkBeamIntersectsCircle(640, 360, 36), false);

// Advance stun countdown
menos.update(1.0);
assert.strictEqual(menos.state, 'STUNNED');
assert.ok(Math.abs(menos.stunTimer - 0.5) < 1e-4);
menos.update(0.6);
assert.strictEqual(menos.stunTimer, 0);
assert.strictEqual(menos.state, 'MARCH');
console.log('PASS: Menos Cero beam geometry, deflection angle, and stun recovery verified');

console.log('--- ALL ADVERSARIAL STRESS TESTS PASSED CLEANLY ---');
