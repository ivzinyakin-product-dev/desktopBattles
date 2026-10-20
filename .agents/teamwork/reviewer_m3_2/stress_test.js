const assert = require('node:assert');
const Vector2 = require('../../../src/engine/Vector2.js');
const Slicer = require('../../../src/game/Slicer.js');
const Enemy = require('../../../src/game/Enemy.js');
const Katana = require('../../../src/game/Katana.js');
const { GetsugaWave } = require('../../../src/game/Projectile.js');
const Camera = require('../../../src/engine/Camera.js');
const ParticleSystem = require('../../../src/engine/ParticleSystem.js');

console.log('--- STARTING ADVERSARIAL STRESS TESTS ---');

// Stress Test 1: Slicer Edge Cases
console.log('Testing Slicer edge cases...');
assert.deepStrictEqual(Slicer.sliceEnemy(null), []);
assert.deepStrictEqual(Slicer.sliceEnemy(undefined), []);

// Degenerate cut angles & velocities
const dummyEnemy = { x: 500, y: 300, radius: 20, type: 'brute' };
const cutNaN = Slicer.sliceEnemy(dummyEnemy, { x: 500, y: 300 }, NaN, 500);
assert.strictEqual(cutNaN.length, 2);
assert.ok(!Number.isNaN(cutNaN[0].vx));
assert.ok(!Number.isNaN(cutNaN[0].vy));

const cutInf = Slicer.sliceEnemy(dummyEnemy, { x: 500, y: 300 }, Infinity, 500);
assert.strictEqual(cutInf.length, 2);

const cutZeroSpeed = Slicer.sliceEnemy(dummyEnemy, { x: 500, y: 300 }, 0, 0);
assert.strictEqual(cutZeroSpeed.length, 2);
assert.ok(cutZeroSpeed[0].vx !== undefined);

// Cut point far outside enemy circle (graze beyond hull)
const cutFar = Slicer.sliceEnemy(dummyEnemy, { x: 9999, y: 9999 }, 0, 500);
assert.strictEqual(cutFar.length, 2);
assert.ok(!Number.isNaN(cutFar[0].seamStart.x));
assert.ok(!Number.isNaN(cutFar[0].seamEnd.y));

// Debris Piece update with pathological dt
const [debrisA, debrisB] = Slicer.sliceEnemy(dummyEnemy, { x: 500, y: 300 }, 0, 500);
debrisA.update(0);
assert.strictEqual(debrisA.isDead, false);
debrisA.update(-0.1);
assert.strictEqual(debrisA.isDead, false);
debrisA.update(NaN);
assert.strictEqual(debrisA.isDead, false);
debrisA.update(100.0); // Huge dt jump
assert.strictEqual(debrisA.isDead, true);
assert.strictEqual(debrisA.alpha, 0);

console.log('Slicer edge cases passed!');

// Stress Test 2: Enemy Swarm Flocking & Evasion
console.log('Testing Enemy Swarm Flocking & Evasion edge cases...');
const crawler = Enemy.createCrawler(100, 100);
assert.doesNotThrow(() => crawler.applySeparation(null));
assert.doesNotThrow(() => crawler.applySeparation([]));
assert.doesNotThrow(() => crawler.applySeparation([null, undefined, { isDead: true }]));
// Stacking exact coincident enemies: distSq === 0
const coincidentCrawler = Enemy.createCrawler(100, 100);
crawler.applySeparation([coincidentCrawler]);
assert.ok(!Number.isNaN(crawler.vx));
assert.ok(!Number.isNaN(crawler.vy));

// Flyer reactive evasion edge cases
const flyer = Enemy.createFlyer(200, 200);
assert.strictEqual(flyer.evadeBlade(null, 500), false);
assert.strictEqual(flyer.evadeBlade(undefined, 500), false);
assert.strictEqual(flyer.evadeBlade({ x: NaN, y: 200 }, 500), false);
assert.strictEqual(flyer.evadeBlade({ x: 200, y: 200 }, 0), true); // within 95px
// Cooldown check immediately after
assert.strictEqual(flyer.evadeBlade({ x: 200, y: 200 }, 500), false);
// Cooldown decay
flyer.update(0.7); // exceeds 0.65s cooldown
assert.strictEqual(flyer.evadeBlade({ x: flyer.x + 10, y: flyer.y + 10 }, 500), true);

console.log('Enemy Swarm edge cases passed!');

// Stress Test 3: Armored Brute Edge Cases
console.log('Testing Armored Brute edge cases...');
const brute = Enemy.createBrute(300, 300);
// Hit while already dead
brute.isDead = true;
const deadHit = brute.onHit(50);
assert.strictEqual(deadHit.bisect, false);
assert.strictEqual(deadHit.damage, 0);

// Fresh brute boundary speeds
const brute2 = Enemy.createBrute(300, 300);
const res599 = brute2.onHit(20, { x: 0, y: 1 }, 0, 599.999);
assert.strictEqual(res599.ricochet, true);
assert.strictEqual(res599.cracked, false);
assert.strictEqual(brute2.armorBroken, false);

const res600 = brute2.onHit(20, { x: 0, y: 1 }, 0, 600.0);
assert.strictEqual(res600.ricochet, false);
assert.strictEqual(res600.cracked, true);
assert.strictEqual(brute2.armorBroken, true);
assert.strictEqual(brute2.stunTimer, 1.2);

// Fatal hit on cracked brute
const resKill = brute2.onHit(100, { x: 0, y: 1 }, 0, 300);
assert.strictEqual(resKill.bisect, true);
assert.strictEqual(brute2.isDead, true);

console.log('Armored Brute edge cases passed!');

// Stress Test 4: Menos Grande Gillian Boss Edge Cases
console.log('Testing Menos Grande Gillian Boss edge cases...');
const menos = Enemy.createMenos(0, 360);
// March past Altar standoff with variable large dt
menos.x = 350; // Altar at 640 -> dist = 290
menos.update(1.0, { x: 640, y: 360 }); // Speed 18, would move to 368 -> dist 272 <= 280
assert.strictEqual(menos.state, 'CHARGE');
assert.strictEqual(menos.x, 360); // Snapped to exact standoff (640 - 280 = 360)

// Fast-forward CHARGE
menos.update(2.5, { x: 640, y: 360 });
assert.strictEqual(menos.state, 'CERO');
assert.strictEqual(menos.isCeroActive(), true);

// Beam deflection with katana at exactly 450 px/s
const katana = new Katana();
katana.speed = 450.0;
katana.hilt = { x: 450, y: 360 };
katana.tip = { x: 450, y: 370 };
const deflected = menos.checkBladeDeflection(katana);
assert.strictEqual(deflected, true);
assert.strictEqual(menos.isDeflected, true);
assert.strictEqual(menos.state, 'STUNNED');
assert.strictEqual(menos.getCeroDamage(), 0);

// Double deflection attempt during same beam
assert.strictEqual(menos.checkBladeDeflection(katana), false);

// Stun recovery
menos.update(1.5);
assert.strictEqual(menos.state, 'MARCH');
assert.strictEqual(menos.stunTimer, 0);

// Boss death edge cases (overkill damage)
menos.hp = 50;
const overkillHit = menos.onHit(9999);
assert.strictEqual(overkillHit.dead, true);
assert.strictEqual(overkillHit.bisect, true);
assert.strictEqual(menos.hp, 0);
assert.strictEqual(menos.isDead, true);

// Hit when already dead
const ghostHit = menos.onHit(100);
assert.strictEqual(ghostHit.dead, true);
assert.strictEqual(ghostHit.bisect, false);
assert.strictEqual(ghostHit.damageDealt, 0);

console.log('Menos Grande Boss edge cases passed!');
console.log('--- ALL ADVERSARIAL STRESS TESTS PASSED SUCCESSFULLY! ---');
