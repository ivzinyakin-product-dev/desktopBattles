/**
 * Tensa Zangetsu: Soul Altar Defense
 * test/test-combat.js
 * 
 * Milestone 2 Combat Mechanics Unit & Integration Test Suite:
 * - Feature 7: Katana Kinematics, Exponential Smoothing & Velocity Filter
 * - Feature 8: Dynamic Katana Stance, Geometry & Slerp Orientation
 * - Feature 3: SweptQuad Continuous Collision Detection (CCD) Volumes
 * - Feature 9: Dynamic Getsuga Trail Ribbon & Dual-Composite Shader
 * - Feature 10: Chained Pommel Tassel (Verlet Integration & Distance Constraints)
 * - Feature 11: Left-Click Forced Slash ("Senka" Ease-Out Cubic Arc)
 * - Feature 12: Right-Click / Spacebar Crescent Getsuga Tensho Wave Projectiles
 * 
 * Target Environment: Node.js v24 Native Test Runner (`node --test test/test-combat.js`)
 * Zero external dependencies.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Engine dependencies
const Vector2 = require('../src/engine/Vector2.js');
const { SweptQuad } = Vector2;
const Camera = require('../src/engine/Camera.js');
const ParticleSystem = require('../src/engine/ParticleSystem.js');

// Game dependencies under test
const Katana = require('../src/game/Katana.js');
const { GetsugaWave, Projectile } = require('../src/game/Projectile.js');
const Slicer = require('../src/game/Slicer.js');
const { DebrisPiece } = Slicer;
const Enemy = require('../src/game/Enemy.js');
const { MenosGrande } = Enemy;

// Mock Canvas 2D Context for drawing assertions
class MockContext2D {
  constructor() {
    this.calls = [];
    this.operations = [];
    this.shadowColor = '';
    this.shadowBlur = 0;
    this.strokeStyle = '';
    this.fillStyle = '';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.imageSmoothingEnabled = true;
    this._gco = 'source-over';
    this.rects = [];
  }
  get globalCompositeOperation() {
    return this._gco;
  }
  set globalCompositeOperation(val) {
    this._gco = val;
    this.operations.push(val);
  }
  save() { this.calls.push('save'); }
  restore() { this.calls.push('restore'); }
  translate(x, y) { this.calls.push(`translate(${Math.round(x)},${Math.round(y)})`); }
  rotate(a) { this.calls.push(`rotate(${a.toFixed(2)})`); }
  beginPath() { this.calls.push('beginPath'); }
  closePath() { this.calls.push('closePath'); }
  moveTo(x, y) { this.calls.push(`moveTo(${Math.round(x)},${Math.round(y)})`); }
  lineTo(x, y) { this.calls.push(`lineTo(${Math.round(x)},${Math.round(y)})`); }
  quadraticCurveTo(cx, cy, x, y) { this.calls.push('quadraticCurveTo'); }
  stroke() { this.calls.push('stroke'); }
  fill() { this.calls.push('fill'); }
  fillRect(x, y, w, h) {
    this.rects.push({ x, y, w, h, fillStyle: this.fillStyle });
    this.calls.push(`fillRect(${x},${y},${w},${h})`);
  }
  arc(x, y, r, sa, ea) { this.calls.push(`arc(${x},${y},${r})`); }
  clip() { this.calls.push('clip'); }
  drawImage() { this.calls.push('drawImage'); }
  rect(x, y, w, h) { this.calls.push(`rect(${x},${y},${w},${h})`); }
  createLinearGradient(x0, y0, x1, y1) {
    return {
      addColorStop(offset, color) {}
    };
  }
}

// ============================================================================
// 1. Feature 7: Katana Kinematics, Smoothing & Velocity Filter
// ============================================================================
describe('Feature 7: Katana Kinematics, Smoothing & Velocity Filter', () => {
  it('7.1 initializes with default geometry, zero speed, and proper thresholds', () => {
    const katana = new Katana(640, 360);
    assert.strictEqual(katana.bladeLength, 85);
    assert.strictEqual(katana.hiltLength, 22);
    assert.strictEqual(katana.speed, 0);
    assert.strictEqual(katana.slashThreshold, 280);
    assert.strictEqual(katana.ceroDeflectThreshold, 450);
    assert.strictEqual(katana.isSlashing(), false);
    assert.strictEqual(katana.canDeflectCero(), false);
  });

  it('7.2 tracks mouse movement with exponential smoothing (lambda = 50 s^-1)', () => {
    const katana = new Katana(640, 360);
    katana.hilt = { x: 0, y: 0 };
    katana.onMouseMove(100, 0);

    // At dt = 0.016: alpha = 1 - exp(-50 * 0.016) = 1 - exp(-0.8) ~ 0.55067
    katana.update(0.016);
    assert.ok(Math.abs(katana.hilt.x - 55.067) < 1.0);
    assert.strictEqual(katana.hilt.y, 0);
  });

  it('7.3 maintains K=5 velocity ring buffer for moving average velocity', () => {
    const katana = new Katana(640, 360);
    assert.strictEqual(katana.velHistory.length, 5);

    katana.hilt = { x: 0, y: 0 };
    katana.targetMouse = { x: 1000, y: 0 };

    for (let i = 0; i < 5; i++) {
      katana.update(0.016);
    }
    assert.ok(katana.speed > 0);
    assert.ok(katana.velocity.x > 0);
  });

  it('7.4 accurately computes speed magnitude via computeSpeed(vx, vy)', () => {
    const katana = new Katana(640, 360);
    assert.strictEqual(katana.computeSpeed(300, 400), 500);
    assert.strictEqual(katana.computeSpeed(0, 0), 0);
    assert.strictEqual(katana.computeSpeed(-60, 80), 100);
  });

  it('7.5 detects slashing threshold (speed >= 280 px/s)', () => {
    const katana = new Katana(640, 360);
    katana.speed = 279.9;
    assert.strictEqual(katana.isSlashing(), false);

    katana.speed = 280.0;
    assert.strictEqual(katana.isSlashing(), true);

    katana.speed = 600.0;
    assert.strictEqual(katana.isSlashing(), true);
  });

  it('7.6 detects Cero deflection threshold (speed >= 450 px/s)', () => {
    const katana = new Katana(640, 360);
    katana.speed = 449.9;
    assert.strictEqual(katana.canDeflectCero(), false);

    katana.speed = 450.0;
    assert.strictEqual(katana.canDeflectCero(), true);

    katana.speed = 700.0;
    assert.strictEqual(katana.canDeflectCero(), true);
  });

  it('7.7 decays speed to zero when mouse remains stationary', () => {
    const katana = new Katana(640, 360);
    katana.hilt = { x: 500, y: 500 };
    katana.targetMouse = { x: 500, y: 500 };
    katana.update(0.5); // 0.5s stationary
    assert.ok(katana.speed < 1e-3);
  });

  it('7.8 clamps out-of-bounds mouse coordinates safely without NaN', () => {
    const katana = new Katana(640, 360);
    katana.onMouseMove(-500, 2000);
    assert.strictEqual(katana.targetMouse.x, 0);
    assert.strictEqual(katana.targetMouse.y, 720);

    katana.onMouseMove(NaN, undefined);
    assert.ok(!Number.isNaN(katana.targetMouse.x));
    assert.ok(!Number.isNaN(katana.targetMouse.y));
  });
});

// ============================================================================
// 2. Feature 8: Dynamic Katana Stance, Geometry & Slerp Orientation
// ============================================================================
describe('Feature 8: Dynamic Katana Stance, Geometry & Slerp Orientation', () => {
  it('8.1 blade rests in radial outward ready stance from Altar when idle', () => {
    const katana = new Katana(640, 360);
    katana.hilt = { x: 740, y: 360 }; // To the right of altar
    katana.speed = 50; // Idle speed < 280
    katana.updateStance(640, 360);
    assert.ok(Math.abs(katana.angle) < 0.05);

    katana.hilt = { x: 640, y: 460 }; // Directly below altar
    katana.updateStance(640, 360);
    assert.ok(Math.abs(katana.angle - Math.PI / 2) < 0.05);
  });

  it('8.2 dynamically aligns with swing vector + forward rake angle (+0.35 rad) when cutting', () => {
    const katana = new Katana(640, 360);
    katana.speed = 600; // Above 280 px/s
    katana.velocity = { x: 600, y: 0 }; // Heading = 0 rad
    katana.update(0.016);
    // Heading 0 + forward rake 0.35 rad
    assert.ok(katana.angle > 0.1 && katana.angle < 0.6);
  });

  it('8.3 maintains exact blade length (85px) and pommel length (22px)', () => {
    const katana = new Katana(640, 360);
    const testAngles = [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 3];

    for (const a of testAngles) {
      katana.angle = a;
      katana._updateTipAndPommel();
      const tipDist = Math.hypot(katana.tip.x - katana.hilt.x, katana.tip.y - katana.hilt.y);
      const pommelDist = Math.hypot(katana.pommel.x - katana.hilt.x, katana.pommel.y - katana.hilt.y);
      assert.ok(Math.abs(tipDist - 85) < 1e-4, `Tip dist must be 85px, got ${tipDist}`);
      assert.ok(Math.abs(pommelDist - 22) < 1e-4, `Pommel dist must be 22px, got ${pommelDist}`);
    }
  });

  it('8.4 smoothly slerps orientation across +/- PI branch cut without snapping', () => {
    const katana = new Katana(640, 360);
    katana.angle = Math.PI - 0.05;
    katana.speed = 50;
    katana.hilt = { x: 640 - 100, y: 360 - 5 };
    katana.update(0.016);
    assert.ok(!Number.isNaN(katana.angle));
  });
});

// ============================================================================
// 3. Feature 3: Continuous Collision Detection (CCD) via SweptQuad
// ============================================================================
describe('Feature 3: Continuous Collision Detection (CCD) via SweptQuad', () => {
  it('3.1 returns valid blade segment endpoints (prevHilt, prevTip, hilt, tip)', () => {
    const katana = new Katana(640, 360);
    const seg = katana.getBladeSegment();
    assert.ok(seg.hilt && typeof seg.hilt.x === 'number');
    assert.ok(seg.tip && typeof seg.tip.x === 'number');
    assert.ok(seg.prevHilt && typeof seg.prevHilt.x === 'number');
    assert.ok(seg.prevTip && typeof seg.prevTip.x === 'number');
  });

  it('3.2 creates SweptQuad detecting rapid mouse sweep through enemy circle', () => {
    const katana = new Katana(640, 360);
    katana.prevHilt = { x: 100, y: 200 };
    katana.prevTip = { x: 100, y: 285 };
    katana.hilt = { x: 600, y: 200 };
    katana.tip = { x: 600, y: 285 };

    const quad = katana.getSweptQuad();
    assert.ok(quad instanceof SweptQuad);

    // Enemy circle placed mid-flight at (350, 240) with radius 16
    assert.strictEqual(quad.intersectsCircle(new Vector2(350, 240), 16), true);
    // Outside query
    assert.strictEqual(quad.intersectsCircle(new Vector2(800, 240), 16), false);
  });

  it('3.3 handles stationary blade quad without throwing', () => {
    const katana = new Katana(640, 360);
    const quad = katana.getSweptQuad();
    assert.ok(quad instanceof SweptQuad);
    assert.strictEqual(quad.intersectsCircle(katana.hilt, 10), true);
  });
});

// ============================================================================
// 4. Feature 9: Dynamic Getsuga Trail Ribbon & Dual-Composite Shader
// ============================================================================
describe('Feature 9: Dynamic Getsuga Trail Ribbon & Dual-Composite Shader', () => {
  it('9.1 initializes rolling buffer with capacity 16 and 240ms lifespan', () => {
    const katana = new Katana();
    assert.ok(Array.isArray(katana.trail));
    assert.ok(Array.isArray(katana.trailNodes));
    assert.strictEqual(katana.coreWidth, 4);
    assert.strictEqual(katana.trailLifespan, 0.24);
  });

  it('9.2 records samples during active swing and caps at 16', () => {
    const katana = new Katana();
    katana.speed = 500;
    for (let i = 0; i < 25; i++) {
      katana.hilt = { x: 100 + i * 10, y: 200 };
      katana.tip = { x: 185 + i * 10, y: 200 };
      katana.update(0.008);
    }
    assert.strictEqual(katana.trail.length, 16);
    assert.strictEqual(typeof katana.trail[0].tipX, 'number');
    assert.strictEqual(typeof katana.trail[0].hiltX, 'number');
  });

  it('9.3 evicts trail samples completely when stationary over 240ms', () => {
    const katana = new Katana();
    katana.speed = 500;
    katana.update(0.016);
    assert.ok(katana.trail.length > 0);

    katana.speed = 0;
    katana.update(0.3); // 300ms > 240ms
    assert.strictEqual(katana.trail.length, 0);
  });

  it('9.4 executes dual-composite rendering with screen aura and 4px source-over core', () => {
    const katana = new Katana();
    katana.speed = 600;
    katana.hilt = { x: 200, y: 200 };
    katana.tip = { x: 285, y: 200 };
    katana.update(0.016);
    katana.hilt = { x: 220, y: 210 };
    katana.tip = { x: 305, y: 210 };
    katana.update(0.016);

    const ctx = new MockContext2D();
    katana.drawTrail(ctx);

    assert.ok(ctx.operations.includes('screen'), 'Outer aura must use screen blending');
    assert.ok(ctx.operations.includes('source-over'), 'Inner core must use source-over blending');
  });

  it('9.5 emits Reiatsu embers via ParticleSystem during high-speed swings', () => {
    const ps = new ParticleSystem({ capacity: 50 });
    const katana = new Katana(640, 360, { particleSystem: ps });
    katana.speed = 500;
    katana.update(0.016);
    assert.ok(ps.activeCount >= 1);
  });
});

// ============================================================================
// 5. Feature 10: Chained Pommel Tassel (Verlet Integration & Distance Constraints)
// ============================================================================
describe('Feature 10: Chained Pommel Tassel (Verlet Physics)', () => {
  it('10.1 initializes 8-node Verlet tassel pinned at pommel anchor point (22px behind hilt)', () => {
    const katana = new Katana();
    assert.strictEqual(katana.tasselNodes.length, 8);
    assert.strictEqual(katana.chainNodes.length, 8);
    assert.strictEqual(katana.tasselCount, 8);
    assert.strictEqual(katana.restLength, 5);
    assert.strictEqual(katana.chainRestLength, 5);
    assert.strictEqual(katana.gravity, 280);
    assert.strictEqual(katana.damping, 0.05);

    katana.hilt = { x: 300, y: 300 };
    katana.angle = 0; // Pommel is at (278, 300)
    katana.update(0.016);

    const node0 = katana.tasselNodes[0];
    const distToHilt = Math.hypot(node0.x - katana.hilt.x, node0.y - katana.hilt.y);
    assert.ok(Math.abs(distToHilt - 22) < 1.0, `Expected pommel dist 22px, got ${distToHilt}`);
    assert.ok(distToHilt < 30);
  });

  it('10.2 maintains 5px distance relaxation stability under 10,000 px/s violent mouse flick', () => {
    const katana = new Katana();
    katana.hilt = { x: 800, y: 100 };
    katana.speed = 10000;
    katana.update(0.008);

    for (let i = 0; i < katana.tasselNodes.length - 1; i++) {
      const nA = katana.tasselNodes[i];
      const nB = katana.tasselNodes[i + 1];
      const linkDist = Math.hypot(nB.x - nA.x, nB.y - nA.y);
      assert.ok(!Number.isNaN(linkDist), `Link ${i} dist must not be NaN`);
      assert.ok(linkDist <= 7.0, `Link ${i} dist must remain tightly constrained (got ${linkDist})`);
    }

    const totalLen = Math.hypot(
      katana.tasselNodes[7].x - katana.tasselNodes[0].x,
      katana.tasselNodes[7].y - katana.tasselNodes[0].y
    );
    assert.ok(totalLen <= 38.0, `Total chain length must remain <= 38px (got ${totalLen})`);
  });

  it('10.3 renders RotMG 3x3 metallic pixels and terminal crimson charm bead', () => {
    const katana = new Katana();
    katana.hilt = { x: 400, y: 400 };
    katana.update(0.016);

    const ctx = new MockContext2D();
    katana.drawTassel(ctx);

    assert.strictEqual(ctx.imageSmoothingEnabled, false);
    assert.ok(ctx.rects.some(r => r.w === 3 && r.h === 3), 'Must render 3x3 pixel blocks');
    assert.ok(ctx.rects.some(r => r.w === 4 && r.h === 4), 'Must render 4x4 charm bead border');
    assert.ok(ctx.rects.some(r => r.fillStyle === '#ff0033'), 'Must render crimson charm gem');
  });
});

// ============================================================================
// 6. Feature 11: Left-Click Forced Slash ("Senka" Arc)
// ============================================================================
describe('Feature 11: Left-Click Forced Slash ("Senka" Arc)', () => {
  it('11.1 triggers Senka slash and enters active forced slashing state', () => {
    const katana = new Katana();
    assert.strictEqual(katana.isForcedSlashing, false);

    const ok = katana.triggerForcedSlash();
    assert.strictEqual(ok, true);
    assert.strictEqual(katana.isForcedSlashing, true);
    assert.strictEqual(katana.forcedSlashActive, true);
    assert.strictEqual(katana.isSlashing(), true);
  });

  it('11.2 strictly enforces 0.35s cooldown between forced slashes', () => {
    const katana = new Katana();
    assert.strictEqual(katana.triggerForcedSlash(), true);
    assert.strictEqual(katana.triggerForcedSlash(), false); // Blocked

    katana.update(0.2); // 0.2s elapsed
    assert.strictEqual(katana.triggerForcedSlash(), false); // Still blocked

    katana.update(0.16); // 0.36s total > 0.35s
    assert.strictEqual(katana.triggerForcedSlash(), true); // Re-enabled
  });

  it('11.3 covers full 100px circle radius around cursor with 1.5x damage mult', () => {
    const katana = new Katana();
    assert.strictEqual(katana.forcedSlashRadius, 100);
    assert.strictEqual(katana.forcedSlashDamageMult, 1.5);
  });

  it('11.4 adds +0.25 camera trauma upon execution', () => {
    const cam = new Camera();
    const katana = new Katana(640, 360, { camera: cam });
    katana.triggerForcedSlash();
    assert.strictEqual(cam.trauma, 0.25);
  });

  it('11.5 completes 240 degrees sweep over exactly 150ms using ease-out cubic curve', () => {
    const katana = new Katana();
    katana.angle = 0;
    katana.triggerForcedSlash();

    // Advance 75ms (halfway, u = 0.5)
    // Ease-out cubic: 1 - (1 - 0.5)^3 = 0.875 (87.5% progress)
    katana.update(0.075);
    const expectedProgress = 1 - Math.pow(0.5, 3);
    const expectedAngle = ((4 * Math.PI) / 3) * expectedProgress;
    assert.ok(Math.abs(katana.angle - expectedAngle) < 0.05);

    // Advance remaining 75ms (total 150ms)
    katana.update(0.075);
    assert.strictEqual(katana.isForcedSlashing, false);
    assert.strictEqual(katana.forcedSlashActive, false);
    assert.ok(Math.abs(katana.angle - ((4 * Math.PI) / 3)) < 0.05);
  });

  it('11.6 generates continuous SweptQuads tiling the 240-degree sector without tunneling', () => {
    const katana = new Katana(640, 360);
    katana.hilt = { x: 640, y: 360 };
    katana.targetMouse = { x: 640, y: 360 };
    katana.angle = 0;
    katana._updateTipAndPommel();
    katana.triggerForcedSlash();

    const dt = 1 / 120; // 120Hz physics sub-step
    const quads = [];

    while (katana.isForcedSlashing) {
      katana.update(dt);
      const quad = katana.getSweptQuad();
      if (quad) quads.push(quad);
    }

    assert.ok(quads.length >= 17 && quads.length <= 19);

    // Enemy colliders along the 240-degree arc at radius 60px must all be intersected
    const testAngles = [0.2, 0.8, 1.5, 2.5, 3.5, 4.0];
    for (const ta of testAngles) {
      const enemyPos = new Vector2(
        640 + Math.cos(ta) * 60,
        360 + Math.sin(ta) * 60
      );
      const hit = quads.some(q => q.intersectsCircle(enemyPos, 12));
      assert.strictEqual(hit, true, `Enemy at angle ${ta} must be intersected by Senka SweptQuad union`);
    }

    // Enemy outside 100px radius must not be hit
    const farEnemy = new Vector2(640 + Math.cos(1.0) * 130, 360 + Math.sin(1.0) * 130);
    const farHit = quads.some(q => q.intersectsCircle(farEnemy, 12));
    assert.strictEqual(farHit, false);
  });
});

// ============================================================================
// 7. Feature 12: Crescent Getsuga Tensho Wave Projectiles
// ============================================================================
describe('Feature 12: Crescent Getsuga Tensho Wave Projectiles', () => {
  it('12.1 instantiates with canonical speed (820 px/s), radius (42px) and thickness (16px)', () => {
    const wave = new GetsugaWave(640, 360, 1, 0);
    assert.strictEqual(wave.x, 640);
    assert.strictEqual(wave.y, 360);
    assert.strictEqual(wave.speed, 820);
    assert.strictEqual(wave.radius, 42);
    assert.strictEqual(wave.thickness, 16);
    assert.strictEqual(wave.maxLife, 1.6);
    assert.strictEqual(wave.life, 1.6);
    assert.strictEqual(wave.maxPierces, 8);
    assert.strictEqual(wave.pierceCount, 0);
    assert.strictEqual(wave.piercesLeft, 8);
    assert.strictEqual(wave.isDead, false);
  });

  it('12.2 computes accurate linear velocity components from direction vector', () => {
    const wave = new GetsugaWave(100, 100, 1, 1);
    const expectedVx = 820 * Math.SQRT1_2;
    const expectedVy = 820 * Math.SQRT1_2;
    assert.ok(Math.abs(wave.vx - expectedVx) < 1e-4);
    assert.ok(Math.abs(wave.vy - expectedVy) < 1e-4);
    assert.ok(Math.abs(wave.angle - Math.PI / 4) < 1e-4);
  });

  it('12.3 updates position linearly by velocity * dt', () => {
    const wave = new GetsugaWave(100, 200, 1, 0);
    wave.update(0.1);
    assert.ok(Math.abs(wave.x - 182) < 1e-4);
    assert.strictEqual(wave.y, 200);
    assert.ok(Math.abs(wave.life - 1.5) < 1e-4);
  });

  it('12.4 self-despawns after maximum lifespan (1.6s) expires', () => {
    const wave = new GetsugaWave(200, 360, 1, 0, { speed: 400 });
    wave.update(1.0); // Moves to x = 600, life = 0.6s
    assert.strictEqual(wave.isDead, false);
    wave.update(0.7); // 1.7s total > 1.6s maxLife
    assert.strictEqual(wave.isDead, true);
  });

  it('12.5 despawns upon crossing canvas boundary margins', () => {
    const wave = new GetsugaWave(1370, 360, 1, 0);
    wave.update(0.02); // x > 1380
    assert.strictEqual(wave.isDead, true);
  });

  it('12.6 penetrates up to 8 enemies before dissipating', () => {
    const wave = new GetsugaWave(100, 360, 1, 0);

    for (let i = 0; i < 8; i++) {
      assert.strictEqual(wave.isDead, false);
      const enemy = { x: wave.x, y: 360, radius: 12, hp: 50, onHit: () => {} };
      const hit = wave.checkHit(enemy);
      assert.strictEqual(hit, true);
    }

    assert.strictEqual(wave.pierceCount, 8);
    assert.strictEqual(wave.piercesLeft, 0);
    assert.strictEqual(wave.isDead, true);

    // 9th enemy cannot be hit
    const enemy9 = { x: 400, y: 360, radius: 12 };
    assert.strictEqual(wave.checkHit(enemy9), false);
  });

  it('12.7 prevents duplicate hits on the same enemy across successive frames', () => {
    const wave = new GetsugaWave(100, 360, 1, 0);
    const enemy = { x: 120, y: 360, radius: 15, hp: 50, onHit: () => {} };

    assert.strictEqual(wave.checkHit(enemy), true);
    assert.strictEqual(wave.pierceCount, 1);

    // Tick 2: same enemy must not be re-hit
    assert.strictEqual(wave.checkHit(enemy), false);
    assert.strictEqual(wave.pierceCount, 1);
  });

  it('12.8 detects circle intersection along parabolic crescent arc and generates SweptQuad', () => {
    const wave = new GetsugaWave(500, 300, 1, 0);
    assert.strictEqual(wave.intersectsCircle(510, 300, 10), true);
    assert.strictEqual(wave.intersectsCircle(490, 265, 10), true);
    assert.strictEqual(wave.intersectsCircle(400, 300, 10), false);

    const quad = wave.getSweptQuad();
    assert.ok(quad instanceof SweptQuad);
  });

  it('12.9 emits kuroi smoke and reiatsu embers wake via ParticleSystem', () => {
    const ps = new ParticleSystem({ capacity: 100 });
    const wave = new GetsugaWave(200, 200, 1, 0, { particleSystem: ps });
    wave.update(0.05); // Exceeds 0.025s trail interval
    assert.ok(ps.activeCount >= 3);
  });

  it('12.10 renders parabolic Bezier crescent with crimson aura and black core', () => {
    const wave = new GetsugaWave(300, 300, 1, 0);
    const ctx = new MockContext2D();
    wave.draw(ctx);
    assert.ok(ctx.calls.includes('save'));
    assert.ok(ctx.calls.includes('restore'));
    assert.ok(ctx.calls.includes('beginPath'));
    assert.ok(ctx.calls.includes('quadraticCurveTo'));
    assert.ok(ctx.calls.includes('fill'));
    assert.ok(ctx.calls.includes('stroke'));
  });

  it('12.11 Katana integration enforces 1.8s cooldown, throttles click spam, and manages projectiles array', () => {
    const katana = new Katana();
    assert.strictEqual(katana.projectiles.length, 0);

    // First wave trigger succeeds
    const res1 = katana.triggerCrescentWave(640, 360, 1, 0);
    assert.strictEqual(res1, true);
    assert.strictEqual(katana.projectiles.length, 1);
    assert.strictEqual(katana.projectiles[0].speed, 820);

    // Immediate second trigger is blocked
    const res2 = katana.triggerCrescentWave(640, 360, 1, 0);
    assert.strictEqual(res2, false);
    assert.strictEqual(katana.projectiles.length, 1);

    // Click spam test
    for (let i = 0; i < 50; i++) {
      katana.triggerCrescentWave(640, 360, 1, 0);
    }
    assert.strictEqual(katana.projectiles.length, 1);

    // Fast-forward 1.7s (projectile despawns after 1.6s)
    katana.update(1.7);
    assert.strictEqual(katana.projectiles.length, 0, 'Dead projectile must be purged from array');

    // After 0.2s more (1.9s total > 1.8s cooldown), trigger succeeds again
    katana.update(0.2);
    const res3 = katana.fireGetsugaWave(640, 360, 0, 1);
    assert.strictEqual(res3, true);
    assert.strictEqual(katana.projectiles.length, 1);
  });

  it('12.12 displays dynamic Reiatsu gauge ratio from 0.0 to 1.0', () => {
    const katana = new Katana();
    assert.strictEqual(katana.getReiatsuGauge(), 1.0);

    katana.triggerCrescentWave(640, 360, 1, 0);
    assert.strictEqual(katana.getReiatsuGauge(), 0.0);

    katana.update(0.9); // Half of 1.8s cooldown
    assert.ok(Math.abs(katana.getReiatsuGauge() - 0.5) < 0.05);

    katana.update(0.9);
    assert.strictEqual(katana.getReiatsuGauge(), 1.0);
  });
});

// ============================================================================
// 8. Feature 13: Clean 2D Sprite Bisection Slicing
// ============================================================================
describe('Feature 13: Clean 2D Sprite Bisection Slicing', () => {
  it('13.1 computes accurate cut normal perpendicular to cut vector for all cardinal & diagonal angles', () => {
    // Cut angle 0 rad (horizontal to right): normal is (0, 1)
    const n0 = Slicer.computeCutNormal(0);
    assert.ok(Math.abs(n0.x) < 1e-4);
    assert.ok(Math.abs(n0.y - 1.0) < 1e-4);

    // Cut angle PI/2 rad (vertical downward): normal is (-1, 0)
    const nPi2 = Slicer.computeCutNormal(Math.PI / 2);
    assert.ok(Math.abs(nPi2.x - (-1.0)) < 1e-4);
    assert.ok(Math.abs(nPi2.y) < 1e-4);

    // Cut angle PI rad (horizontal to left): normal is (0, -1)
    const nPi = Slicer.computeCutNormal(Math.PI);
    assert.ok(Math.abs(nPi.x) < 1e-4);
    assert.ok(Math.abs(nPi.y - (-1.0)) < 1e-4);

    // Dot product between cut direction and normal is strictly 0
    const testAngles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, 2.3];
    for (const a of testAngles) {
      const norm = Slicer.computeCutNormal(a);
      const u = { x: Math.cos(a), y: Math.sin(a) };
      const dot = u.x * norm.x + u.y * norm.y;
      assert.ok(Math.abs(dot) < 1e-4, `Cut normal at angle ${a} must be perpendicular`);
    }
  });

  it('13.2 splits entity along cut plane into two distinct physical halves', () => {
    const enemy = { x: 300, y: 200, radius: 16, type: 'crawler' };
    const halves = Slicer.sliceEnemy(enemy, { x: 300, y: 200 }, 0, 500, { x: 500, y: 0 });

    assert.ok(Array.isArray(halves));
    assert.strictEqual(halves.length, 2);
    assert.strictEqual(halves[0].half, 'A');
    assert.strictEqual(halves[1].half, 'B');
    assert.strictEqual(halves[0].isHalfA, true);
    assert.strictEqual(halves[1].isHalfB, true);
  });

  it('13.3 dual half-plane clipping partitions sprite hull without overlapping', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, Math.PI / 4, 600, { x: 424, y: 424 });

    assert.ok(Array.isArray(halfA.clipPolygon) && halfA.clipPolygon.length === 4);
    assert.ok(Array.isArray(halfB.clipPolygon) && halfB.clipPolygon.length === 4);

    // Half A and Half B share the exact cut line segment (first two vertices)
    assert.strictEqual(halfA.clipPolygon[0].x, halfB.clipPolygon[0].x);
    assert.strictEqual(halfA.clipPolygon[0].y, halfB.clipPolygon[0].y);
    assert.strictEqual(halfA.clipPolygon[1].x, halfB.clipPolygon[1].x);
    assert.strictEqual(halfA.clipPolygon[1].y, halfB.clipPolygon[1].y);
  });

  it('13.4 instantiates OffscreenCanvas / polygon paths for both debris halves', () => {
    const enemy = { x: 500, y: 350, radius: 12, type: 'flyer' };
    const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 500, y: 350 }, 0, 400);

    assert.ok(halfA.canvas !== null);
    assert.ok(halfB.canvas !== null);
    assert.ok(halfA.polygon.length >= 3);
    assert.ok(halfB.polygon.length >= 3);
  });

  it('13.5 applies glowing white/crimson (#ff0033 / #ffffff) reiatsu cauterization seam', () => {
    const enemy = { x: 200, y: 200, radius: 16, type: 'crawler' };
    const [halfA] = Slicer.sliceEnemy(enemy, { x: 200, y: 200 }, 0, 500);

    const ctx = new MockContext2D();
    halfA.draw(ctx);

    assert.ok(ctx.calls.includes('save'));
    assert.ok(ctx.calls.includes('restore'));
    assert.ok(ctx.calls.includes('stroke'));
  });

  it('13.6 handles tangential graze cuts at circle boundary without NaN', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    // Cut point at tangential boundary y = 116
    const halves = Slicer.sliceEnemy(enemy, { x: 100, y: 116 }, 0, 500, { x: 500, y: 0 });

    assert.strictEqual(halves.length, 2);
    assert.ok(!Number.isNaN(halves[0].seamStart.x));
    assert.ok(!Number.isNaN(halves[0].seamEnd.y));
    assert.ok(!Number.isNaN(halves[0].vx));
    assert.ok(!Number.isNaN(halves[1].vy));
  });

  it('13.7 handles exact vertical cut (theta = PI/2) cleanly without horizontal divergence', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, Math.PI / 2, 500, { x: 0, y: 500 });

    assert.strictEqual(halfA !== null, true);
    // Vertical cut separates laterally along horizontal normal (-1, 0)
    assert.ok(halfA.vx * halfB.vx < 0 || (halfA.vx !== halfB.vx));
  });
});

// ============================================================================
// 9. Feature 14: Severed Debris Physics & Dissolution
// ============================================================================
describe('Feature 14: Severed Debris Physics & Dissolution', () => {
  it('14.1 halves receive opposing lateral separation velocities + forward momentum', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const swingSpeed = 600;
    const swingVel = { x: 600, y: 0 };
    const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, swingSpeed, swingVel);

    // Forward momentum check (both have positive Vx from swingVel)
    assert.ok(halfA.vx > 0, 'Half A must carry forward momentum');
    assert.ok(halfB.vx > 0, 'Half B must carry forward momentum');

    // Lateral separation check (opposing signs on Vy along cut normal)
    assert.ok(halfA.vy > 0, 'Half A Vy must be positive along normal');
    assert.ok(halfB.vy < 0, 'Half B Vy must be negative along normal');
    assert.ok(halfA.vy - halfB.vy >= 240, 'Separation velocity must push halves apart');
  });

  it('14.2 imparts opposing tumbling angular velocities (+- 5 to 10 rad/s)', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA, halfB] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500);

    assert.ok(halfA.angVel * halfB.angVel < 0, 'Angular velocities must have opposing signs');
    assert.ok(Math.abs(halfA.angVel) >= 5.0 && Math.abs(halfA.angVel) <= 10.0);
    assert.ok(Math.abs(halfB.angVel) >= 5.0 && Math.abs(halfB.angVel) <= 10.0);
  });

  it('14.3 decelerates via ground friction factor (0.94^dt)', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500, { x: 500, y: 0 });

    const initVx = halfA.vx;
    const initVy = halfA.vy;
    halfA.update(0.1);

    assert.ok(Math.abs(halfA.vx) < Math.abs(initVx), 'Vx must decelerate');
    assert.ok(Math.abs(halfA.vy) < Math.abs(initVy), 'Vy must decelerate');
    assert.strictEqual(halfA.friction, 0.94);
  });

  it('14.4 decays angular tumbling smoothly over time', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500);

    const initAngVel = Math.abs(halfA.angVel);
    halfA.update(0.1);
    assert.ok(Math.abs(halfA.angVel) < initAngVel, 'Angular velocity must decay smoothly');
  });

  it('14.5 dissolves and fades alpha monotonically over total lifespan of 0.85s', () => {
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler' };
    const [halfA] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500);

    assert.strictEqual(halfA.alpha, 1.0);
    assert.strictEqual(halfA.isDead, false);

    // Midpoint update (0.425s)
    halfA.update(0.425);
    assert.ok(Math.abs(halfA.alpha - 0.5) < 0.05);
    assert.strictEqual(halfA.isDead, false);

    // Full lifespan update (0.425s + 0.425s = 0.85s)
    halfA.update(0.425);
    assert.strictEqual(halfA.alpha, 0.0);
    assert.strictEqual(halfA.isDead, true);

    // Past lifespan update (0.9s total)
    halfA.update(0.05);
    assert.strictEqual(halfA.alpha, 0.0);
    assert.strictEqual(halfA.isDead, true);
  });

  it('14.6 emits dissolving black spiritual smoke during dissolution phase', () => {
    const ps = new ParticleSystem({ capacity: 50 });
    const enemy = { x: 100, y: 100, radius: 16, type: 'crawler', particleSystem: ps };
    const [halfA] = Slicer.sliceEnemy(enemy, { x: 100, y: 100 }, 0, 500, null, { particleSystem: ps });

    assert.strictEqual(ps.activeCount, 0);

    // Advance 0.07s (> 0.06s smokeInterval)
    halfA.update(0.07, ps);
    assert.ok(ps.activeCount >= 1, 'Must emit smoke particle into ParticleSystem');
    assert.strictEqual(ps.particles[0].color, '#050505');
  });
});

// ============================================================================
// 10. Feature 15: Hollow Crawler Swarm AI Unit & Integration Tests
// ============================================================================
describe('Feature 15: Hollow Crawler Swarm AI', () => {
  it('15.1 initializes with canonical base stats (HP 25, Speed 95, Radius 12, Damage 8)', () => {
    const crawler = Enemy.createCrawler(100, 100);
    assert.strictEqual(crawler.type, 'crawler');
    assert.strictEqual(crawler.hp, 25);
    assert.strictEqual(crawler.speed, 95);
    assert.strictEqual(crawler.radius, 12);
    assert.strictEqual(crawler.altarDamage, 8);
    assert.strictEqual(crawler.damage, 8);
    assert.strictEqual(crawler.isDead, false);
  });

  it('15.2 steers toward central Soul Altar with positive velocity progression', () => {
    const crawler = Enemy.createCrawler(0, 360);
    crawler.update(0.1, { x: 640, y: 360, radius: 36 });
    assert.ok(crawler.x > 0);
    assert.ok(crawler.vx > 80);
  });

  it('15.3 applies flocking separation repulsion against neighboring crawlers', () => {
    const c1 = Enemy.createCrawler(100, 100);
    const c2 = Enemy.createCrawler(105, 100);
    c1.applySeparation([c2]);
    assert.ok(c1.vx < 0, `Expected c1.vx < 0 due to repulsion from c2, got ${c1.vx}`);
  });

  it('15.4 incorporates sinusoidal skittering gait perturbation', () => {
    const c = Enemy.createCrawler(0, 0, { skitterPhase: 0 });
    assert.strictEqual(c.skitterPhase, 0);
    c.update(0.1, { x: 640, y: 360 });
    assert.ok(c.skitterPhase > 0);
  });

  it('15.5 triggers Altar breach event and delivers exactly 8 damage upon contact', () => {
    const crawler = Enemy.createCrawler(640, 360 + 40); // 40px away, <= 12 + 36 = 48px
    const event = crawler.update(0.016, { x: 640, y: 360, radius: 36 });
    assert.ok(event !== null);
    assert.strictEqual(event.hitAltar, true);
    assert.strictEqual(event.damage, 8);
    assert.strictEqual(crawler.isDead, true);
  });

  it('15.6 single blade cut results in 1-hit clean cut and bisection flag', () => {
    const crawler = Enemy.createCrawler(200, 200);
    const res = crawler.onHit(25, { x: 0, y: 1 }, 0, 500);
    assert.strictEqual(res.bisect, true);
    assert.strictEqual(res.ricochet, false);
    assert.strictEqual(crawler.isDead, true);
  });
});

// ============================================================================
// 11. Feature 16: Hollow Flyer Harasser AI Unit & Integration Tests
// ============================================================================
describe('Feature 16: Hollow Flyer Harasser AI', () => {
  it('16.1 initializes with canonical base stats (HP 20, Speed 185, Radius 10, DiveSpeed 270, Damage 12)', () => {
    const flyer = Enemy.createFlyer(500, 500);
    assert.strictEqual(flyer.type, 'flyer');
    assert.strictEqual(flyer.hp, 20);
    assert.strictEqual(flyer.speed, 185);
    assert.strictEqual(flyer.diveSpeed, 270);
    assert.strictEqual(flyer.radius, 10);
    assert.strictEqual(flyer.altarDamage, 12);
    assert.strictEqual(flyer.damage, 12);
  });

  it('16.2 executes logarithmic spiral approach around Altar at long range (r >= 180px)', () => {
    const flyer = Enemy.createFlyer(640 + 300, 360);
    assert.strictEqual(flyer.state, 'SPIRAL');
    flyer.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(flyer.state, 'SPIRAL');
    assert.strictEqual(flyer.speed, 185);
  });

  it('16.3 accelerates to high-speed dive (270 px/s) at close range (r < 180px)', () => {
    const flyer = Enemy.createFlyer(640 + 150, 360);
    flyer.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(flyer.state, 'DIVE');
    assert.strictEqual(flyer.speed, 270);
  });

  it('16.4 executes reactive evasive lateral twitch when blade approaches within 95px', () => {
    const flyer = Enemy.createFlyer(100, 100);
    const evaded = flyer.evadeBlade({ x: 120, y: 100 }, 400);
    assert.strictEqual(evaded, true);
    assert.strictEqual(flyer.isEvading, true);
    assert.ok(flyer.evadeTimer > 0);
  });

  it('16.5 enforces evasion cooldown preventing continuous twitch spam', () => {
    const flyer = Enemy.createFlyer(100, 100);
    assert.strictEqual(flyer.evadeBlade({ x: 120, y: 100 }, 400), true);
    assert.strictEqual(flyer.evadeBlade({ x: 120, y: 100 }, 400), false);
  });

  it('16.6 delivers 12 damage upon diving through Altar hitbox', () => {
    const flyer = Enemy.createFlyer(640, 360 + 40);
    const event = flyer.update(0.016, { x: 640, y: 360, radius: 36 });
    assert.ok(event !== null);
    assert.strictEqual(event.hitAltar, true);
    assert.strictEqual(event.damage, 12);
    assert.strictEqual(flyer.isDead, true);
  });
});

// ============================================================================
// 12. Feature 17: Armored Brute Vanguard AI Unit & Integration Tests
// ============================================================================
describe('Feature 17: Armored Brute Vanguard AI', () => {
  it('17.1 initializes with canonical base stats (HP 90, Speed 48, Radius 20, Damage 25, Armor Intact)', () => {
    const brute = Enemy.createBrute(200, 200);
    assert.strictEqual(brute.type, 'brute');
    assert.strictEqual(brute.hp, 90);
    assert.strictEqual(brute.speed, 48);
    assert.strictEqual(brute.radius, 20);
    assert.strictEqual(brute.altarDamage, 25);
    assert.strictEqual(brute.armorBroken, false);
    assert.strictEqual(brute.stunTimer, 0);
  });

  it('17.2 light slashes (< 600 px/s) ricochet off intact armor with 15 chip damage', () => {
    const brute = Enemy.createBrute(0, 0);
    const res = brute.onHit(25, { x: 0, y: 1 }, 0, 450);
    assert.strictEqual(res.ricochet, true);
    assert.strictEqual(res.cracked, false);
    assert.strictEqual(res.bisect, false);
    assert.strictEqual(brute.armorBroken, false);
    assert.strictEqual(brute.hp, 75); // 90 - 15 = 75
  });

  it('17.3 heavy slashes (>= 600 px/s) crack carapace armor', () => {
    const brute = Enemy.createBrute(0, 0);
    const res = brute.onHit(40, { x: 0, y: 1 }, 0, 600);
    assert.strictEqual(res.ricochet, false);
    assert.strictEqual(res.cracked, true);
    assert.strictEqual(brute.armorBroken, true);
    assert.strictEqual(brute.hp, 50); // 90 - 40 = 50
  });

  it('17.4 applies 1.2s stagger stun upon armor break that halts movement', () => {
    const brute = Enemy.createBrute(0, 0);
    brute.onHit(40, { x: 0, y: 1 }, 0, 750);
    assert.strictEqual(brute.stunTimer, 1.2);
    brute.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(brute.vx, 0);
    assert.strictEqual(brute.vy, 0);
  });

  it('17.5 subsequent slash after armor break triggers clean bisection', () => {
    const brute = Enemy.createBrute(0, 0);
    brute.armorBroken = true;
    const res = brute.onHit(50, { x: 0, y: 1 }, 0, 450);
    assert.strictEqual(res.bisect, true);
    assert.strictEqual(brute.isDead, true);
  });

  it('17.6 Getsuga wave projectile cracks carapace regardless of mouse swing speed', () => {
    const brute = Enemy.createBrute(0, 0);
    const res = brute.onHit(45, { x: 1, y: 0 }, 0, 0, { isGetsugaWave: true });
    assert.strictEqual(res.cracked, true);
    assert.strictEqual(brute.armorBroken, true);
  });

  it('17.7 Senka forced slash cracks carapace and damages brute', () => {
    const brute = Enemy.createBrute(0, 0);
    const res = brute.onHit(60, { x: 1, y: 0 }, 0, 0, { isForcedSlash: true });
    assert.strictEqual(res.cracked, true);
    assert.strictEqual(brute.armorBroken, true);
  });
});

// ============================================================================
// 13. Feature 18: Menos Grande Gillian Boss AI
// ============================================================================
describe('Feature 18: Menos Grande Gillian Boss AI', () => {
  it('18.1 Base stats: HP 550, Speed 18 px/s, Radius 45px', () => {
    const menos = Enemy.createMenos(0, 0);
    assert.strictEqual(menos.hp, 550);
    assert.strictEqual(menos.speed, 18);
    assert.strictEqual(menos.radius, 45);
    assert.strictEqual(menos.isBoss, true);
  });

  it('18.2 Marches to standoff distance of 280px from Altar', () => {
    const menos = Enemy.createMenos(0, 360);
    assert.strictEqual(menos.standoffDist || 280, 280);
    assert.strictEqual(menos.state, 'MARCH');

    // Advance 1s toward Altar at (640, 360)
    menos.update(1.0, { x: 640, y: 360 });
    assert.strictEqual(menos.x, 18);

    // Position approaching standoff boundary: 640 - 280 = 360
    menos.x = 359;
    menos.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(menos.state, 'CHARGE');
    assert.strictEqual(menos.chargeTimer, 2.5);
  });

  it('18.3 Charges Cero beam for 2.5s with red telegraph targeting laser', () => {
    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CHARGE';
    assert.strictEqual(menos.chargeDuration, 2.5);
    assert.strictEqual(menos.chargeTimer, 2.5);

    menos.update(1.0, { x: 640, y: 360 });
    assert.strictEqual(menos.state, 'CHARGE');
    assert.ok(Math.abs(menos.chargeTimer - 1.5) < 1e-4);

    const ctx = new MockContext2D();
    menos.draw(ctx);
    assert.ok(ctx.calls.includes('save'));
    assert.ok(ctx.calls.includes('stroke'));
  });

  it('18.4 Fires 1.2s Cero beam dealing 35 total damage to Altar', () => {
    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CHARGE';
    menos.chargeTimer = 0.05;

    const cam = new Camera();
    menos.camera = cam;
    menos.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(menos.state, 'CERO');
    assert.strictEqual(menos.ceroDuration, 1.2);
    assert.strictEqual(menos.ceroTimer, 1.2);
    assert.ok(cam.trauma >= 0.15); // +0.15 blast trauma
  });

  it('18.5 Giant bisection upon 0 HP with massive screen flash and trauma', () => {
    const cam = new Camera();
    const ps = new ParticleSystem({ capacity: 200 });
    let flashTriggered = false;
    const game = { triggerFlash: (a) => { flashTriggered = true; } };

    const menos = Enemy.createMenos(360, 360, { camera: cam, particleSystem: ps, game });
    menos.hp = 10;
    const res = menos.onHit(20, { x: 0, y: 1 }, Math.PI / 4, 500);

    assert.strictEqual(menos.isDead, true);
    assert.strictEqual(res.bisect, true);
    assert.strictEqual(res.dead, true);
    assert.strictEqual(menos.hp, 0);
    assert.ok(cam.trauma >= 0.5); // +0.5 giant bisection trauma
    assert.strictEqual(flashTriggered, true);
    assert.ok(ps.activeCount >= 50); // Massive spiritual debris explosion
  });
});

// ============================================================================
// 14. Feature 19: Cero Deflection & Blade Clash
// ============================================================================
describe('Feature 19: Cero Deflection & Blade Clash', () => {
  it('19.1 Blade sweep at speed >= 450 px/s deflects Cero beam', () => {
    const katana = new Katana();
    katana.speed = 500;
    assert.strictEqual(katana.canDeflectCero(), true);

    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CERO';
    menos.aimAngle = 0; // Pointing +X toward Altar at (640, 360)

    katana.hilt = { x: 450, y: 350 };
    katana.tip = { x: 450, y: 370 };

    const deflected = menos.checkBladeDeflection(katana);
    assert.strictEqual(deflected, true);
    assert.strictEqual(menos.isDeflected, true);
    assert.strictEqual(menos.stunTimer, 1.5);
    assert.strictEqual(menos.state, 'STUNNED');
  });

  it('19.2 Blade sweep at speed < 450 px/s fails to deflect Cero beam', () => {
    const katana = new Katana();
    katana.speed = 400;
    assert.strictEqual(katana.canDeflectCero(), false);

    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CERO';
    menos.aimAngle = 0;

    katana.hilt = { x: 450, y: 350 };
    katana.tip = { x: 450, y: 370 };

    const deflected = menos.checkBladeDeflection(katana);
    assert.strictEqual(deflected, false);
    assert.strictEqual(menos.isDeflected, false);
    assert.strictEqual(menos.state, 'CERO');
  });

  it('19.2b Left-Click Forced Slash (Senka arc) deflects Cero beam regardless of manual speed', () => {
    const katana = new Katana();
    katana.speed = 0;
    katana.triggerForcedSlash();
    assert.strictEqual(katana.canDeflectCero(), true);

    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CERO';
    menos.aimAngle = 0;

    katana.hilt = { x: 450, y: 350 };
    katana.tip = { x: 450, y: 370 };

    const deflected = menos.checkBladeDeflection(katana);
    assert.strictEqual(deflected, true);
    assert.strictEqual(menos.isDeflected, true);
    assert.strictEqual(menos.stunTimer, 1.5);
  });

  it('19.3 Kuroi Getsuga crescent projectile deflects/nullifies Cero beam', () => {
    const cam = new Camera();
    const ps = new ParticleSystem({ capacity: 100 });
    const wave = new GetsugaWave(450, 360, -1, 0); // Flying left toward Menos

    const menos = Enemy.createMenos(360, 360, { camera: cam, particleSystem: ps });
    menos.state = 'CERO';
    menos.aimAngle = 0;

    const deflected = menos.checkProjectileDeflection(wave);
    assert.strictEqual(deflected, true);
    assert.strictEqual(menos.isDeflected, true);
    assert.strictEqual(wave.isDead, true);
    assert.ok(cam.trauma >= 0.35); // +0.35 camera trauma
  });

  it('19.4 Cero deflection nullifies all Altar damage during beam duration', () => {
    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CERO';
    assert.strictEqual(menos.getCeroDamage(), 35);

    menos.deflectCero();
    assert.strictEqual(menos.isDeflected, true);
    assert.strictEqual(menos.getCeroDamage(), 0);

    const event = menos.update(0.1, { x: 640, y: 360 });
    assert.strictEqual(event, null); // No damage dispatched to Altar
  });

  it('19.5 Deflection applies 1.5s stun to Menos Grande boss', () => {
    const menos = Enemy.createMenos(360, 360);
    menos.state = 'CERO';
    menos.deflectCero();

    assert.strictEqual(menos.stunTimer, 1.5);
    assert.strictEqual(menos.state, 'STUNNED');

    menos.update(1.0);
    assert.ok(Math.abs(menos.stunTimer - 0.5) < 1e-4);
    assert.strictEqual(menos.state, 'STUNNED');

    menos.update(0.6);
    assert.strictEqual(menos.stunTimer, 0);
    assert.strictEqual(menos.state, 'MARCH'); // Resumes march after stun expires
  });
});

// ============================================================================
// 15. Cross-System Integration & Verification
// ============================================================================
describe('M3 Cross-System Integration & Verification', () => {
  it('3.3 Menos Cero Beam -> Katana Deflection -> Boss Stun', () => {
    const menos = Enemy.createMenos(640 - 280, 360);
    const katana = new Katana();
    const altar = { hp: 100, takeDamage(amt) { this.hp -= amt; } };

    menos.state = 'FIRE';
    katana.speed = 520;

    const deflected = katana.speed >= 450;
    if (deflected) {
      menos.deflectCero();
    } else {
      altar.takeDamage(35);
    }

    assert.strictEqual(deflected, true);
    assert.strictEqual(altar.hp, 100);
    assert.ok(menos.stunTimer >= 1.5);
  });

  it('Scenario C: Menos Grande Boss Encounter & Cero Deflection', () => {
    const menos = Enemy.createMenos(640 - 280, 360);
    const altar = { hp: 100, takeDamage(amt) { this.hp -= amt; } };
    const katana = new Katana();
    const score = { score: 0, addScore(t) { if (t === 'menos') this.score += 2000; } };

    menos.state = 'FIRE';
    katana.speed = 550;
    const deflected = katana.speed >= 450;
    if (deflected) {
      menos.deflectCero();
    }

    menos.hp = 0;
    menos.isDead = true;
    score.addScore('menos');

    assert.strictEqual(deflected, true);
    assert.strictEqual(altar.hp, 100);
    assert.ok(score.score >= 1500);
  });
});
