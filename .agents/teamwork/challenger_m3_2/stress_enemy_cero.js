/**
 * Tensa Zangetsu: Soul Altar Defense
 * .agents/teamwork/challenger_m3_2/stress_enemy_cero.js
 * 
 * Challenger 2 Adversarial Stress Test Suite for Milestone 3:
 * - High-density swarm flocking (200 Crawlers in tight cluster, 1,000 frames)
 * - Flyer evasive dodging (blade sweep harassment, cooldown, twitch explosion prevention, bounded coords)
 * - Armored Brute threshold (599 px/s ricochet vs 600 px/s crack, 1.2s stun verification)
 * - Menos Grande Gillian Cero deflection (449 px/s fail vs 450 px/s deflection, Getsuga wave collision, Altar damage)
 * 
 * Target Environment: Node.js (Runnable directly via `node stress_enemy_cero.js`)
 */

const assert = require('node:assert');
const path = require('node:path');

// Resolve project dependencies
const Enemy = require('../../../src/game/Enemy.js');
const { MenosGrande } = Enemy;
const Katana = require('../../../src/game/Katana.js');
const { GetsugaWave } = require('../../../src/game/Projectile.js');
const Vector2 = require('../../../src/engine/Vector2.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  process.stdout.write(`[TEST ${totalTests}] ${name} ... `);
  try {
    fn();
    passedTests++;
    console.log('PASSED');
  } catch (err) {
    failedTests++;
    console.log('FAILED');
    console.error('   ', err.message);
  }
}

console.log('================================================================================');
console.log('  CHALLENGER 2: ADVERSARIAL STRESS TEST SUITE (MILESTONE 3)');
console.log('  Enemy AI, Flocking Swarms, Evasion, Armor Thresholds & Cero Deflection');
console.log('================================================================================\n');

// ============================================================================
// SUITE 1: High-Density Swarm Flocking Stress (Feature 15)
// ============================================================================
console.log('--- SUITE 1: High-Density Swarm Flocking Stress (Feature 15) ---');

runTest('1.1 200 Crawlers tight cluster separation over 1,000 frames without velocity explosion or NaNs', () => {
  const count = 200;
  const crawlers = [];
  const spawnCenter = { x: 200, y: 200 };
  const initialMaxRadius = 6.0; // Packed inside tiny 6px radius

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = (i % 5) * (initialMaxRadius / 5);
    crawlers.push(Enemy.createCrawler(
      spawnCenter.x + Math.cos(angle) * r,
      spawnCenter.y + Math.sin(angle) * r
    ));
  }

  // Verify initial density
  let initMaxDist = 0;
  for (const c of crawlers) {
    initMaxDist = Math.max(initMaxDist, Math.hypot(c.x - spawnCenter.x, c.y - spawnCenter.y));
  }
  assert.ok(initMaxDist <= initialMaxRadius + 0.1, `Initial cluster radius exceeded ${initialMaxRadius}`);

  const dt = 1 / 60; // 60 FPS standard timestep
  let maxVelocitySpike = 0;
  let nanDetected = false;
  let infDetected = false;

  // Run 1,000 frames of separation physics
  for (let frame = 0; frame < 1000; frame++) {
    // Reset velocities and compute flocking repulsion
    for (let i = 0; i < count; i++) {
      const c = crawlers[i];
      c.vx = 0;
      c.vy = 0;
      const push = c.applySeparation(crawlers, 32, 120);

      const speed = Math.hypot(c.vx, c.vy);
      if (speed > maxVelocitySpike) maxVelocitySpike = speed;

      if (!Number.isFinite(c.vx) || !Number.isFinite(c.vy)) {
        if (Number.isNaN(c.vx) || Number.isNaN(c.vy)) nanDetected = true;
        else infDetected = true;
      }

      // Euler integrate separation
      c.x += c.vx * dt;
      c.y += c.vy * dt;

      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) {
        if (Number.isNaN(c.x) || Number.isNaN(c.y)) nanDetected = true;
        else infDetected = true;
      }
    }
  }

  // Calculate final dispersion
  let finalMaxDist = 0;
  let sumDist = 0;
  for (const c of crawlers) {
    const d = Math.hypot(c.x - spawnCenter.x, c.y - spawnCenter.y);
    finalMaxDist = Math.max(finalMaxDist, d);
    sumDist += d;
  }
  const avgDist = sumDist / count;

  // Assertions
  assert.strictEqual(nanDetected, false, 'NaN detected in crawler positions or velocities');
  assert.strictEqual(infDetected, false, 'Infinity detected in crawler positions or velocities');
  assert.ok(finalMaxDist > initMaxDist * 10, `Crawlers failed to disperse: final radius ${finalMaxDist.toFixed(1)} <= ${initMaxDist * 10}`);
  assert.ok(avgDist > 30, `Average distance from center (${avgDist.toFixed(1)}) should be > 30px`);

  // Max theoretical spike: 199 neighbors * 120 force = 23,880 px/s
  assert.ok(maxVelocitySpike <= 23880 + 1e-4, `Max velocity spike ${maxVelocitySpike} exceeded theoretical bound of 23,880`);
  assert.ok(maxVelocitySpike > 0, 'Velocity spike should be non-zero');
});

runTest('1.2 50 Crawlers spawned at EXACT identical coordinate (singular point collision) does not NaN or div-by-zero', () => {
  const crawlers = [];
  for (let i = 0; i < 50; i++) {
    crawlers.push(Enemy.createCrawler(300.0, 300.0));
  }

  for (let f = 0; f < 60; f++) {
    for (const c of crawlers) {
      c.applySeparation(crawlers);
      assert.ok(!Number.isNaN(c.vx) && !Number.isNaN(c.vy), 'NaN produced from exact coincidence');
      assert.ok(Number.isFinite(c.vx) && Number.isFinite(c.vy), 'Infinite velocity from exact coincidence');
    }
  }
});

runTest('1.3 High-density 200 Crawlers swarm advancing toward Soul Altar with separation and skittering gait', () => {
  const crawlers = [];
  const altar = { x: 640, y: 360, radius: 36 };
  for (let i = 0; i < 200; i++) {
    crawlers.push(Enemy.createCrawler(
      100 + (Math.random() - 0.5) * 20,
      100 + (Math.random() - 0.5) * 20
    ));
  }

  const dt = 1 / 60;
  let totalBreaches = 0;

  for (let frame = 0; frame < 1000; frame++) {
    for (const c of crawlers) {
      if (c.isDead) continue;
      const breach = c.update(dt, altar);
      if (breach && breach.hitAltar) {
        totalBreaches++;
        assert.strictEqual(breach.damage, 8);
      }
      const push = c.applySeparation(crawlers, 32, 120);
      c.x += push.pushX * dt;
      c.y += push.pushY * dt;

      assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y));
    }
  }

  // All or most crawlers should eventually reach the altar and deal damage
  assert.ok(totalBreaches > 150, `Expected > 150 crawlers to breach altar, got ${totalBreaches}`);
});

// ============================================================================
// SUITE 2: Flyer Evasive Dodging & Twitch Suppression (Feature 16)
// ============================================================================
console.log('\n--- SUITE 2: Flyer Evasive Dodging & Twitch Suppression (Feature 16) ---');

runTest('2.1 Fast blade sweep within threat radius triggers reactive evasion and applies 0.65s cooldown', () => {
  const flyer = Enemy.createFlyer(500, 300);
  const bladeTip = { x: 520, y: 310 }; // dist = sqrt(20^2 + 10^2) = 22.36px < 95px
  const bladeSpeed = 500; // >= 250 px/s

  assert.strictEqual(flyer.isEvading, false);
  assert.strictEqual(flyer.evadeCooldown, 0);

  const triggered = flyer.evadeBlade(bladeTip, bladeSpeed);
  assert.strictEqual(triggered, true);
  assert.strictEqual(flyer.isEvading, true);
  assert.ok(Math.abs(flyer.evadeTimer - 0.22) < 1e-4);
  assert.ok(Math.abs(flyer.evadeCooldown - 0.65) < 1e-4);

  // Immediate subsequent sweep must be blocked by cooldown
  const secondTrigger = flyer.evadeBlade(bladeTip, bladeSpeed);
  assert.strictEqual(secondTrigger, false, 'Cooldown failed to block immediate second trigger');
});

runTest('2.2 Continuous blade harassment over 1,000 frames prevents per-frame twitch explosion via cooldown throttling', () => {
  const flyer = Enemy.createFlyer(400, 400);
  const dt = 1 / 60;
  let evasionTriggerCount = 0;
  let prevIsEvading = false;
  let maxCoord = 0;
  let nanFound = false;

  // Harass flyer for 1,000 frames with a high-speed blade constantly attached within 25px
  for (let frame = 0; frame < 1000; frame++) {
    const fakeKatana = {
      tip: { x: flyer.x - 20, y: flyer.y - 15 },
      speed: 650
    };

    // Update flyer in open arena
    flyer.update(dt, { x: 10000, y: 10000, radius: 36 }, fakeKatana);

    if (flyer.isEvading && !prevIsEvading) {
      evasionTriggerCount++;
    }
    prevIsEvading = flyer.isEvading;

    const dist = Math.hypot(flyer.x, flyer.y);
    if (dist > maxCoord) maxCoord = dist;
    if (!Number.isFinite(flyer.x) || !Number.isFinite(flyer.y)) nanFound = true;
  }

  assert.strictEqual(nanFound, false, 'NaN detected in flyer position');

  // Over 1,000 frames at dt = 1/60s (16.67 seconds), with 0.65s cooldown,
  // maximum possible triggers is floor(16.67 / 0.65) ~ 25 to 26 triggers.
  // If per-frame twitch occurred, triggers would be 1,000!
  assert.ok(evasionTriggerCount <= 28, `Twitch explosion detected! Evaded ${evasionTriggerCount} times in 1,000 frames (expected <= 28)`);
  assert.ok(evasionTriggerCount >= 20, `Evasion failed to repeat properly: only ${evasionTriggerCount} triggers (expected >= 20)`);
  
  // Coordinates remain bounded and finite
  assert.ok(maxCoord < 15000, `Flyer coordinates exploded out of bounds: maxCoord = ${maxCoord}`);
});

runTest('2.3 Sub-threshold and out-of-range blade sweeps do not trigger evasion during update', () => {
  const flyer = Enemy.createFlyer(300, 300);

  // Sub-threshold speed (200 px/s < 250 px/s)
  const slowKatana = { tip: { x: 310, y: 310 }, speed: 200 };
  flyer.update(0.016, { x: 640, y: 360 }, slowKatana);
  assert.strictEqual(flyer.isEvading, false, 'Slow blade during update incorrectly triggered evasion');

  // Out of threat radius (> 95px, e.g. 150px)
  const farKatana = { tip: { x: 450, y: 300 }, speed: 700 };
  flyer.update(0.016, { x: 640, y: 360 }, farKatana);
  assert.strictEqual(flyer.isEvading, false, 'Far blade incorrectly triggered evasion');
});

// ============================================================================
// SUITE 3: Armored Brute Carapace Thresholds (Feature 17)
// ============================================================================
console.log('\n--- SUITE 3: Armored Brute Carapace Thresholds (Feature 17) ---');

runTest('3.1 599 px/s hit: 100% ricochet rate across 100 trials, armorBroken stays false, 15 chip damage', () => {
  const trials = 100;
  for (let i = 0; i < trials; i++) {
    const brute = Enemy.createBrute(100, 100);
    const cutAngle = (i / trials) * Math.PI * 2;
    const res = brute.onHit(25, { x: -Math.sin(cutAngle), y: Math.cos(cutAngle) }, cutAngle, 599);

    assert.strictEqual(res.ricochet, true, `Trial ${i}: Expected ricochet=true at 599 px/s`);
    assert.strictEqual(res.cracked, false, `Trial ${i}: Expected cracked=false at 599 px/s`);
    assert.strictEqual(res.bisect, false, `Trial ${i}: Expected bisect=false at 599 px/s`);
    assert.strictEqual(brute.armorBroken, false, `Trial ${i}: Expected armorBroken=false at 599 px/s`);
    assert.strictEqual(res.armorBroken, false, `Trial ${i}: Expected res.armorBroken=false`);
    assert.strictEqual(res.damage, 15, `Trial ${i}: Expected exactly 15 chip damage`);
    assert.strictEqual(brute.hp, 75, `Trial ${i}: Expected hp=75 (90 - 15)`);
    assert.strictEqual(brute.stunTimer, 0, `Trial ${i}: Stun timer should remain 0 on ricochet`);
  }
});

runTest('3.2 600 px/s hit: 100% carapace crack rate across 100 trials, armorBroken becomes true, 1.2s stun verified', () => {
  const trials = 100;
  for (let i = 0; i < trials; i++) {
    const brute = Enemy.createBrute(100, 100);
    const cutAngle = (i / trials) * Math.PI * 2;
    const res = brute.onHit(25, { x: -Math.sin(cutAngle), y: Math.cos(cutAngle) }, cutAngle, 600);

    assert.strictEqual(res.ricochet, false, `Trial ${i}: Expected ricochet=false at 600 px/s`);
    assert.strictEqual(res.cracked, true, `Trial ${i}: Expected cracked=true at 600 px/s`);
    assert.strictEqual(res.bisect, false, `Trial ${i}: Expected bisect=false on first crack`);
    assert.strictEqual(brute.armorBroken, true, `Trial ${i}: Expected armorBroken=true at 600 px/s`);
    assert.strictEqual(res.armorBroken, true, `Trial ${i}: Expected res.armorBroken=true`);
    assert.strictEqual(res.damage, 25, `Trial ${i}: Expected full 25 damage`);
    assert.strictEqual(brute.hp, 65, `Trial ${i}: Expected hp=65 (90 - 25)`);
    assert.ok(Math.abs(brute.stunTimer - 1.2) < 1e-4, `Trial ${i}: Expected stunTimer=1.2s, got ${brute.stunTimer}`);

    // Verify 1.2s stun halts movement in update()
    const initX = brute.x;
    const initY = brute.y;
    brute.update(0.5, { x: 640, y: 360 });
    assert.strictEqual(brute.x, initX, 'Stunned brute moved during update');
    assert.strictEqual(brute.y, initY, 'Stunned brute moved during update');
    assert.strictEqual(brute.vx, 0, 'Stunned brute vx should be 0');
    assert.strictEqual(brute.vy, 0, 'Stunned brute vy should be 0');
    assert.ok(Math.abs(brute.stunTimer - 0.7) < 1e-4, 'Stun timer did not decrement properly');
  }
});

runTest('3.3 Subsequent slash after armor break triggers clean bisection regardless of swing speed', () => {
  const brute = Enemy.createBrute(100, 100);
  brute.onHit(25, { x: 0, y: 1 }, 0, 700); // Crack carapace
  assert.strictEqual(brute.armorBroken, true);

  // Subsequent hit at low speed (150 px/s)
  const res2 = brute.onHit(25, { x: 0, y: 1 }, 0, 150);
  assert.strictEqual(res2.bisect, true);
  assert.strictEqual(brute.isDead, true);
  assert.strictEqual(res2.ricochet, false);
});

runTest('3.4 GetsugaWave projectile and Senka forced slash crack armor unconditionally', () => {
  // Getsuga wave
  const brute1 = Enemy.createBrute(100, 100);
  const res1 = brute1.onHit(60, { x: 0, y: 1 }, 0, 0, { isGetsugaWave: true });
  assert.strictEqual(res1.cracked, true);
  assert.strictEqual(brute1.armorBroken, true);
  assert.ok(Math.abs(brute1.stunTimer - 1.2) < 1e-4);

  // Senka forced slash
  const brute2 = Enemy.createBrute(100, 100);
  const res2 = brute2.onHit(40, { x: 0, y: 1 }, 0, 0, { isForcedSlash: true });
  assert.strictEqual(res2.cracked, true);
  assert.strictEqual(brute2.armorBroken, true);
  assert.ok(Math.abs(brute2.stunTimer - 1.2) < 1e-4);
});

// ============================================================================
// SUITE 4: Menos Grande Gillian Cero Deflection & Beam Clash (Features 18 & 19)
// ============================================================================
console.log('\n--- SUITE 4: Menos Grande Gillian Cero Deflection & Beam Clash (Features 18 & 19) ---');

runTest('4.1 Katana sweep at 449 px/s fails to deflect Cero; Altar damaged for 35 HP; Boss not stunned', () => {
  const altarPos = { x: 640, y: 360, radius: 36 };
  const menos = Enemy.createMenos(640, 80); // 280px north of Altar
  
  // Advance to update aimAngle toward altar
  menos.update(0.016, altarPos);
  assert.ok(Math.abs(menos.aimAngle - Math.PI / 2) < 1e-3, 'Boss did not aim south at Altar');

  // Trigger Cero firing state
  menos.state = 'CERO';
  assert.strictEqual(menos.isCeroActive(), true);

  // Position Katana directly across Cero beam path
  const katana = new Katana(altarPos.x, altarPos.y);
  katana.hilt = { x: 640, y: 200 };
  katana.tip = { x: 640, y: 285 };
  katana.speed = 449; // Strictly sub-threshold (< 450)
  assert.strictEqual(katana.canDeflectCero(), false);

  // Run boss update step with katana
  const evt = menos.update(0.016, altarPos, katana);

  assert.strictEqual(menos.isDeflected, false, 'Cero should NOT be deflected at 449 px/s');
  assert.strictEqual(menos.stunTimer, 0, 'Boss should NOT be stunned at 449 px/s');
  assert.notStrictEqual(evt, null, 'Altar damage event must be generated');
  assert.strictEqual(evt.type, 'cero');
  assert.strictEqual(evt.damage, 35, 'Altar must sustain 35 Cero damage');
  assert.strictEqual(menos.getCeroDamage(), 35);
});

runTest('4.2 Katana sweep at 450 px/s successfully deflects Cero; 0 Altar damage; Boss stunned for 1.5s', () => {
  const altarPos = { x: 640, y: 360, radius: 36 };
  const menos = Enemy.createMenos(640, 80);
  
  menos.update(0.016, altarPos);
  menos.state = 'CERO';

  const katana = new Katana(altarPos.x, altarPos.y);
  katana.hilt = { x: 640, y: 200 };
  katana.tip = { x: 640, y: 285 };
  katana.speed = 450; // Threshold (>= 450)
  assert.strictEqual(katana.canDeflectCero(), true);

  const evt = menos.update(0.016, altarPos, katana);

  assert.strictEqual(menos.isDeflected, true, 'Cero must be deflected at 450 px/s');
  assert.strictEqual(menos.state, 'STUNNED', 'Boss must transition to STUNNED state');
  assert.ok(Math.abs(menos.stunTimer - 1.5) < 1e-4, `Expected 1.5s boss stun, got ${menos.stunTimer}`);
  assert.strictEqual(evt, null, 'Altar damage event must be null upon deflection');
  assert.strictEqual(menos.getCeroDamage(), 0, 'Cero damage must be 0 after deflection');

  // Verify deflected angle redirects upward by 45 degrees (-PI/4)
  const expectedDeflectedAngle = menos.aimAngle - Math.PI / 4;
  assert.ok(Math.abs(menos.deflectedAngle - expectedDeflectedAngle) < 1e-4, 'Beam deflection angle incorrect');

  // Subsequent frames during Cero must not damage Altar
  for (let f = 0; f < 30; f++) {
    const subEvt = menos.update(0.016, altarPos, katana);
    assert.strictEqual(subEvt, null, 'Altar took subsequent damage while deflected');
    assert.strictEqual(menos.getCeroDamage(), 0);
  }
});

runTest('4.3 Left-Click Forced Slash (Senka Arc) deflects Cero regardless of manual speed', () => {
  const altarPos = { x: 640, y: 360, radius: 36 };
  const menos = Enemy.createMenos(640, 80);
  menos.update(0.016, altarPos);
  menos.state = 'CERO';

  const katana = new Katana(altarPos.x, altarPos.y);
  katana.hilt = { x: 640, y: 200 };
  katana.tip = { x: 640, y: 285 };
  katana.speed = 50; // Low manual speed
  katana.isForcedSlashing = true; // Senka active
  assert.strictEqual(katana.canDeflectCero(), true);

  const evt = menos.update(0.016, altarPos, katana);
  assert.strictEqual(menos.isDeflected, true);
  assert.strictEqual(evt, null);
  assert.ok(Math.abs(menos.stunTimer - 1.5) < 1e-4);
});

runTest('4.4 Kuroi Getsuga crescent wave projectile colliding with Cero beam deflects/nullifies Cero and dissipates wave', () => {
  const altarPos = { x: 640, y: 360, radius: 36 };
  const menos = Enemy.createMenos(640, 80);
  menos.update(0.016, altarPos);
  menos.state = 'CERO';

  const katana = new Katana(altarPos.x, altarPos.y);
  katana.hilt = { x: 100, y: 100 }; // Katana far away
  katana.tip = { x: 100, y: 185 };
  katana.speed = 0;

  // Unleash crescent wave advancing directly up into the Cero beam
  const wave = new GetsugaWave(640, 240, 0, -1);
  katana.projectiles = [wave];
  assert.strictEqual(wave.isDead, false);

  const evt = menos.update(0.016, altarPos, katana);

  assert.strictEqual(menos.isDeflected, true, 'Getsuga wave failed to deflect Cero beam');
  assert.strictEqual(wave.isDead, true, 'Getsuga wave should be consumed/dissipated upon clash');
  assert.strictEqual(evt, null, 'Altar damage must be null');
  assert.ok(Math.abs(menos.stunTimer - 1.5) < 1e-4, 'Boss should be stunned for 1.5s');
});

runTest('4.5 Boss recovers from 1.5s stun and transitions back to MARCH without stuck state or NaNs', () => {
  const altarPos = { x: 640, y: 360, radius: 36 };
  const menos = Enemy.createMenos(640, 80);
  menos.update(0.016, altarPos);
  menos.state = 'STUNNED';
  menos.stunTimer = 1.5;

  // Step through stun duration (1.5s / 0.05s = 30 steps)
  for (let step = 0; step < 30; step++) {
    menos.update(0.05, altarPos);
  }

  assert.strictEqual(menos.stunTimer, 0, 'Stun timer did not count down to 0');
  assert.strictEqual(menos.state, 'MARCH', 'Boss did not recover to MARCH state');
  assert.ok(Number.isFinite(menos.x) && Number.isFinite(menos.y), 'Boss coords corrupted');
});

// ============================================================================
// SUMMARY & EXIT
// ============================================================================
console.log('\n================================================================================');
console.log(`  RESULTS: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`);
console.log('================================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
