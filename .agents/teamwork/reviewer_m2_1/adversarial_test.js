/**
 * Adversarial Stress Test Suite for Milestone 2
 * Reviewer: reviewer_m2_1
 */

const assert = require('node:assert');
const Katana = require('../../../src/game/Katana.js');
const { GetsugaWave, Projectile } = require('../../../src/game/Projectile.js');
const Vector2 = require('../../../src/engine/Vector2.js');
const { SweptQuad } = Vector2;

console.log('Running Adversarial Stress Tests...');

// 1. Extreme inputs & NaN / Infinity resilience
{
  const katana = new Katana(640, 360);
  
  // Test NaN / Infinity mouse inputs
  katana.onMouseMove(NaN, NaN);
  assert.ok(!Number.isNaN(katana.targetMouse.x), 'targetMouse.x should not be NaN');
  assert.ok(!Number.isNaN(katana.targetMouse.y), 'targetMouse.y should not be NaN');

  katana.onMouseMove(Infinity, -Infinity);
  assert.strictEqual(katana.targetMouse.x, 1280, 'targetMouse.x clamped to 1280');
  assert.strictEqual(katana.targetMouse.y, 0, 'targetMouse.y clamped to 0');

  // Test zero dt, negative dt, NaN dt
  katana.update(0);
  katana.update(-0.016);
  katana.update(NaN);
  assert.ok(!Number.isNaN(katana.hilt.x), 'hilt.x must survive invalid dt');
  assert.ok(!Number.isNaN(katana.hilt.y), 'hilt.y must survive invalid dt');
  assert.ok(!Number.isNaN(katana.speed), 'speed must survive invalid dt');
  assert.ok(!Number.isNaN(katana.angle), 'angle must survive invalid dt');
  console.log('✔ Test 1: Mouse NaN/Infinity and invalid dt handling passed');
}

// 2. Exact Altar Center Coincidence (Singularity at dx=0, dy=0)
{
  const katana = new Katana(640, 360);
  katana.hilt = { x: 640, y: 360 };
  katana.speed = 0;
  katana.updateStance(640, 360);
  assert.ok(!Number.isNaN(katana.angle), 'Katana angle at altar center must not be NaN');
  katana.update(0.016, 640, 360);
  assert.ok(!Number.isNaN(katana.angle), 'Katana update at altar center must not be NaN');
  assert.ok(!Number.isNaN(katana.tip.x), 'Tip X must not be NaN');
  assert.ok(!Number.isNaN(katana.tip.y), 'Tip Y must not be NaN');
  console.log('✔ Test 2: Exact Altar Center singularity test passed');
}

// 3. Forced Slash and Crescent Wave Spamming under high concurrency/load
{
  const katana = new Katana(640, 360);
  let forcedSuccess = 0;
  let forcedBlocked = 0;
  for (let i = 0; i < 1000; i++) {
    if (katana.triggerForcedSlash()) forcedSuccess++;
    else forcedBlocked++;
  }
  assert.strictEqual(forcedSuccess, 1, 'Only 1 forced slash should succeed immediately');
  assert.strictEqual(forcedBlocked, 999, '999 should be throttled by cooldown');

  let waveSuccess = 0;
  let waveBlocked = 0;
  for (let i = 0; i < 1000; i++) {
    if (katana.triggerCrescentWave()) waveSuccess++;
    else waveBlocked++;
  }
  assert.strictEqual(waveSuccess, 1, 'Only 1 crescent wave should succeed immediately');
  assert.strictEqual(waveBlocked, 999, '999 should be throttled by cooldown');
  assert.strictEqual(katana.projectiles.length, 1, 'Only 1 projectile in pool');
  console.log('✔ Test 3: Input spamming and cooldown gating passed');
}

// 4. Verlet Tassel Stability under Violent Multi-Axis Teleports & Huge dt
{
  const katana = new Katana(640, 360);
  // Simulate 100 frames of chaotic violent teleportation
  for (let f = 0; f < 100; f++) {
    katana.hilt.x = Math.random() * 1280;
    katana.hilt.y = Math.random() * 720;
    katana.angle = (Math.random() - 0.5) * Math.PI * 2;
    katana._updateTipAndPommel();
    katana.updateTasselPhysics(0.008);
    
    // Check all nodes are finite and within reasonable bounds
    for (let i = 0; i < katana.tasselNodes.length; i++) {
      const node = katana.tasselNodes[i];
      assert.ok(Number.isFinite(node.x), `Node ${i} X must be finite`);
      assert.ok(Number.isFinite(node.y), `Node ${i} Y must be finite`);
      if (i > 0) {
        const prev = katana.tasselNodes[i - 1];
        const dist = Math.hypot(node.x - prev.x, node.y - prev.y);
        assert.ok(dist <= 10.0, `Link distance ${i} (${dist}) must not explode under violent teleport`);
      }
    }
  }
  console.log('✔ Test 4: Violent Verlet tassel teleportation stability passed');
}

// 5. Projectile Edge Cases
{
  // Zero direction vector
  const zeroWave = new GetsugaWave(100, 100, 0, 0);
  assert.strictEqual(zeroWave.isDead, true, 'Zero direction wave should be marked dead');
  zeroWave.update(0.016);
  assert.strictEqual(zeroWave.isDead, true);

  // Negative life
  const negWave = new GetsugaWave(100, 100, 1, 0, { life: -1 });
  assert.strictEqual(negWave.isDead, true, 'Negative life wave should be marked dead');

  // Large travel distance & memory pruning
  const katana = new Katana();
  katana.triggerCrescentWave();
  assert.strictEqual(katana.projectiles.length, 1);
  // Advance beyond lifespan
  katana.update(2.0);
  assert.strictEqual(katana.projectiles.length, 0, 'Dead wave should be pruned from array');

  // Multi-hit prevention with duplicate enemy
  const wave = new GetsugaWave(200, 200, 1, 0);
  const dummyEnemy = { x: 220, y: 200, radius: 20, hp: 100, onHit: () => {} };
  assert.strictEqual(wave.checkHit(dummyEnemy), true);
  assert.strictEqual(wave.checkHit(dummyEnemy), false, 'Same enemy hit must be rejected');
  assert.strictEqual(wave.pierceCount, 1);

  // Broadphase vs Narrowphase circle checks
  assert.strictEqual(wave.intersectsCircle(NaN, NaN, 10), false);
  assert.strictEqual(wave.intersectsCircle(200, 200, -5), false);
  assert.strictEqual(wave.intersectsCircle(200, 200, 0), false);

  console.log('✔ Test 5: Projectile edge cases and safety checks passed');
}

// 6. Contract conformance checks
{
  const katana = new Katana(640, 360);
  assert.strictEqual(typeof katana.isSlashing(), 'boolean');
  assert.strictEqual(typeof katana.canDeflectCero(), 'boolean');
  
  const seg = katana.getBladeSegment();
  assert.ok('hilt' in seg && 'tip' in seg && 'prevHilt' in seg && 'prevTip' in seg);
  
  const quad = katana.getSweptQuad();
  assert.ok(quad instanceof SweptQuad);
  assert.strictEqual(typeof quad.intersectsCircle, 'function');

  console.log('✔ Test 6: Contract method signatures and return types verified');
}

console.log('ALL ADVERSARIAL STRESS TESTS COMPLETED SUCCESSFULLY!');
