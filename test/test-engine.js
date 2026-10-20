/**
 * test/test-engine.js
 * 
 * Comprehensive Unit Test Suite for Milestone 1 Engine Foundations:
 * - Vector2 & SweptQuad Continuous Collision Detection (CCD)
 * - GameLoop 120Hz Fixed Timestep Accumulator
 * - CanvasRenderer Canonical 1280x720 Virtual Viewport
 * - Camera Non-linear Trauma-Squared Shake Engine
 * - ParticleSystem Zero-Allocation Spiritual FX
 * - SpriteGen RotMG Procedural Matrices & Outline Engine
 * 
 * Target Environment: Node.js v24 Native Test Runner (`node --test test/test-engine.js`)
 * Zero external dependencies.
 */

const { describe, it, test } = require('node:test');
const assert = require('node:assert');

const Vector2 = require('../src/engine/Vector2.js');
const { SweptQuad } = Vector2;
const GameLoop = require('../src/engine/GameLoop.js');
const CanvasRenderer = require('../src/engine/CanvasRenderer.js');
const { MockCanvas, MockContext2D } = CanvasRenderer;
const Camera = require('../src/engine/Camera.js');
const ParticleSystem = require('../src/engine/ParticleSystem.js');
const { SpriteGen, SpriteCache, SPRITE_DEFS, applyOutline } = require('../src/engine/SpriteGen.js');

// ============================================================================
// 1. Vector2 & SweptQuad CCD Test Suite
// ============================================================================
describe('Vector2 2D Mathematics & Operations', () => {
  it('instantiates with default (0, 0) and custom coordinates', () => {
    const v0 = new Vector2();
    assert.strictEqual(v0.x, 0);
    assert.strictEqual(v0.y, 0);

    const v1 = new Vector2(15, -25);
    assert.strictEqual(v1.x, 15);
    assert.strictEqual(v1.y, -25);

    const vNan = new Vector2(NaN, undefined);
    assert.strictEqual(vNan.x, 0);
    assert.strictEqual(vNan.y, 0);
  });

  it('performs vector addition and subtraction without mutating source', () => {
    const a = new Vector2(10, 20);
    const b = new Vector2(3, 7);
    const sum = a.add(b);
    const diff = a.sub(b);

    assert.strictEqual(sum.x, 13);
    assert.strictEqual(sum.y, 27);
    assert.strictEqual(a.x, 10); // Unmutated
    assert.strictEqual(a.y, 20);

    assert.strictEqual(diff.x, 7);
    assert.strictEqual(diff.y, 13);
  });

  it('performs in-place mutable arithmetic (addMut, subMut, scaleMut)', () => {
    const v = new Vector2(5, 10);
    v.addMut(new Vector2(2, 3));
    assert.strictEqual(v.x, 7);
    assert.strictEqual(v.y, 13);

    v.subMut(new Vector2(1, 3));
    assert.strictEqual(v.x, 6);
    assert.strictEqual(v.y, 10);

    v.scaleMut(0.5);
    assert.strictEqual(v.x, 3);
    assert.strictEqual(v.y, 5);
  });

  it('computes magnitude and magnitude squared accurately', () => {
    const v = new Vector2(3, 4);
    assert.strictEqual(v.mag(), 5);
    assert.strictEqual(v.magSq(), 25);
  });

  it('normalizes non-zero vectors to unit length and prevents NaN on zero vector', () => {
    const v = new Vector2(0, 10);
    const norm = v.normalize();
    assert.strictEqual(norm.x, 0);
    assert.strictEqual(norm.y, 1);
    assert.strictEqual(norm.mag(), 1);

    const zero = new Vector2(0, 0);
    const zeroNorm = zero.normalize();
    assert.strictEqual(zeroNorm.x, 0);
    assert.strictEqual(zeroNorm.y, 0);
    assert.strictEqual(Number.isNaN(zeroNorm.x), false);
    assert.strictEqual(Number.isNaN(zeroNorm.y), false);
  });

  it('computes dot product and 2D scalar cross product', () => {
    const a = new Vector2(1, 0);
    const b = new Vector2(0, 1);
    assert.strictEqual(a.dot(b), 0); // Orthogonal
    assert.strictEqual(a.cross(b), 1); // CCW perpendicular

    const c = new Vector2(2, 3);
    const d = new Vector2(4, 5);
    // dot: 2*4 + 3*5 = 8 + 15 = 23
    assert.strictEqual(c.dot(d), 23);
    // cross: 2*5 - 3*4 = 10 - 12 = -2
    assert.strictEqual(c.cross(d), -2);
  });

  it('computes linear interpolation (lerp) and distance', () => {
    const start = new Vector2(100, 200);
    const end = new Vector2(200, 400);

    const mid = start.lerp(end, 0.5);
    assert.strictEqual(mid.x, 150);
    assert.strictEqual(mid.y, 300);

    assert.strictEqual(start.dist(end), Math.hypot(100, 200));
    assert.strictEqual(start.distSq(end), 100 * 100 + 200 * 200);
  });

  it('computes angle and vector rotation', () => {
    const v = new Vector2(1, 0);
    assert.strictEqual(v.angle(), 0);

    const rotated90 = v.rotate(Math.PI / 2);
    assert.ok(Math.abs(rotated90.x) < 1e-6);
    assert.ok(Math.abs(rotated90.y - 1) < 1e-6);
  });

  it('clones and checks equality with epsilon tolerance', () => {
    const orig = new Vector2(10.0000001, 20.0000001);
    const cloned = orig.clone();
    assert.notStrictEqual(orig, cloned);
    assert.ok(orig.equals(cloned));
    assert.ok(orig.equals(new Vector2(10, 20), 1e-4));
    assert.strictEqual(orig.equals(new Vector2(10.5, 20)), false);
  });
});

describe('SweptQuad Continuous Collision Detection (CCD)', () => {
  it('creates swept quad from 4 perimeter vertices and computes bounds', () => {
    const quad = new SweptQuad(
      new Vector2(10, 20),
      new Vector2(10, 100),
      new Vector2(50, 100),
      new Vector2(50, 20)
    );
    const bounds = quad.getBounds();
    assert.strictEqual(bounds.minX, 10);
    assert.strictEqual(bounds.minY, 20);
    assert.strictEqual(bounds.maxX, 50);
    assert.strictEqual(bounds.maxY, 100);
  });

  it('detects query point strictly inside quad', () => {
    const quad = new SweptQuad(
      new Vector2(0, 0),
      new Vector2(0, 100),
      new Vector2(100, 100),
      new Vector2(100, 0)
    );
    assert.strictEqual(quad.containsPoint(new Vector2(50, 50)), true);
    assert.strictEqual(quad.containsPoint(new Vector2(150, 50)), false);
    assert.strictEqual(quad.containsPoint(new Vector2(-10, 50)), false);
  });

  it('detects circle intersection inside swept volume (preventing mouse-flick tunneling)', () => {
    // High-speed sweep from x=100 to x=600 across y=200..300
    const quad = SweptQuad.fromBladeSegments(
      new Vector2(100, 200),
      new Vector2(100, 300),
      new Vector2(600, 200),
      new Vector2(600, 300)
    );

    // Enemy circle placed mid-flight at (350, 250) with radius 12
    assert.strictEqual(quad.intersectsCircle(new Vector2(350, 250), 12), true);

    // Circle far outside bounds
    assert.strictEqual(quad.intersectsCircle(new Vector2(800, 250), 12), false);
    assert.strictEqual(quad.intersectsCircle(new Vector2(350, 50), 12), false);
  });

  it('detects circle intersection on boundary edges', () => {
    const quad = new SweptQuad(
      new Vector2(0, 0),
      new Vector2(0, 100),
      new Vector2(50, 100),
      new Vector2(50, 0)
    );
    // Center at x=55, y=50 with radius 10 (overlaps right boundary edge at x=50)
    assert.strictEqual(quad.intersectsCircle(new Vector2(55, 50), 10), true);
    // Center at x=65, y=50 with radius 10 (misses edge by 5px)
    assert.strictEqual(quad.intersectsCircle(new Vector2(65, 50), 10), false);
  });

  it('handles degenerate stationary blade (quad collapses to line segment)', () => {
    // When blade is stationary, prevHilt = currHilt, prevTip = currTip
    const quad = SweptQuad.fromBladeSegments(
      new Vector2(100, 100),
      new Vector2(100, 200),
      new Vector2(100, 100),
      new Vector2(100, 200)
    );

    // Enemy walking directly into stationary blade
    assert.strictEqual(quad.intersectsCircle(new Vector2(105, 150), 10), true);
    // Enemy 30px away from stationary blade
    assert.strictEqual(quad.intersectsCircle(new Vector2(130, 150), 10), false);
  });

  it('handles extreme 10,000 px/s mouse whip without tunneling', () => {
    const quad = SweptQuad.fromBladeSegments(
      new Vector2(0, 300),
      new Vector2(0, 400),
      new Vector2(800, 300),
      new Vector2(800, 400)
    );
    const enemyCenter = new Vector2(400, 350);
    assert.strictEqual(quad.intersectsCircle(enemyCenter, 12), true);
  });

  it('handles concave swept quads (translation + rotation) without tunneling', () => {
    // Realistic blade swing from Challenger 1:
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

    // 1. Point containment check
    assert.strictEqual(
      concaveQuad.containsPoint(internalTarget),
      true,
      'containsPoint must identify points inside concave swept quads'
    );

    // 2. Circle intersection without edge contact
    assert.strictEqual(
      concaveQuad.intersectsCircle(internalTarget, 3),
      true,
      'intersectsCircle must detect internal enemy collider in concave sweep'
    );

    // 3. Rejection of points outside the concave quad
    const outsidePointA = new Vector2(150, 250);
    const outsidePointB = new Vector2(320, 200);
    assert.strictEqual(
      concaveQuad.containsPoint(outsidePointA),
      false,
      'containsPoint must reject point outside reflex fold of concave quad'
    );
    assert.strictEqual(
      concaveQuad.containsPoint(outsidePointB),
      false,
      'containsPoint must reject point outside far bounds of quad'
    );
    assert.strictEqual(
      concaveQuad.intersectsCircle(outsidePointA, 5),
      false,
      'intersectsCircle must reject circle separated from concave quad'
    );
  });

  it('detects tangential circle corner grazes with sub-epsilon floating-point tolerance', () => {
    const quad = new SweptQuad(
      new Vector2(100, 100),
      new Vector2(200, 100),
      new Vector2(200, 200),
      new Vector2(100, 200)
    );
    const R = 15;
    const eps = 1e-4;

    // 1. Cardinal Edge Tangents (dist == R)
    assert.strictEqual(quad.intersectsCircle(new Vector2(150, 85), R), true, 'Bottom tangent (dist == R)');
    assert.strictEqual(quad.intersectsCircle(new Vector2(150, 215), R), true, 'Top tangent (dist == R)');
    assert.strictEqual(quad.intersectsCircle(new Vector2(85, 150), R), true, 'Left tangent (dist == R)');
    assert.strictEqual(quad.intersectsCircle(new Vector2(215, 150), R), true, 'Right tangent (dist == R)');

    // 2. Cardinal Edge Separations by 1e-4 must reject
    assert.strictEqual(quad.intersectsCircle(new Vector2(150, 85 - eps), R), false, 'Bottom separation rejects');
    assert.strictEqual(quad.intersectsCircle(new Vector2(150, 215 + eps), R), false, 'Top separation rejects');
    assert.strictEqual(quad.intersectsCircle(new Vector2(85 - eps, 150), R), false, 'Left separation rejects');
    assert.strictEqual(quad.intersectsCircle(new Vector2(215 + eps, 150), R), false, 'Right separation rejects');

    // 3. Exact 45-degree diagonal corner vertex tangent (IEEE-754 precision check)
    const exactCornerX = 200 + R * Math.SQRT1_2;
    const exactCornerY = 200 + R * Math.SQRT1_2;
    assert.strictEqual(
      quad.intersectsCircle(new Vector2(exactCornerX, exactCornerY), R),
      true,
      'Exact diagonal corner tangent must not be rejected by floating-point roundoff'
    );

    // 4. Diagonal corner sub-millimeter penetration vs separation
    const dInside = (R - eps) * Math.SQRT1_2;
    const dOutside = (R + eps) * Math.SQRT1_2;
    assert.strictEqual(
      quad.intersectsCircle(new Vector2(200 + dInside, 200 + dInside), R),
      true,
      'Corner penetration by 1e-4 must intersect'
    );
    assert.strictEqual(
      quad.intersectsCircle(new Vector2(200 + dOutside, 200 + dOutside), R),
      false,
      'Corner separation by 1e-4 must reject'
    );
  });
});

// ============================================================================
// 2. GameLoop 120Hz Fixed Timestep Test Suite
// ============================================================================
describe('GameLoop 120Hz Fixed Timestep Accumulator', () => {
  it('initializes with target 120Hz frequency (dt = 1/120s ~0.008333s)', () => {
    const loop = new GameLoop();
    assert.strictEqual(loop.targetFps, 120);
    assert.ok(Math.abs(loop.dt - (1 / 120)) < 1e-6);
    assert.strictEqual(loop.fixedStep, loop.dt);
    assert.strictEqual(loop.FIXED_STEP, loop.dt);
    assert.strictEqual(loop.maxAccumulator, 0.1);
  });

  it('consumes frame delta into fixed 120Hz substeps', () => {
    let updateCount = 0;
    let accumulatedDelta = 0;

    const loop = new GameLoop({
      update: (dt) => {
        updateCount++;
        accumulatedDelta += dt;
      }
    });

    // Advance 0.025 seconds (~3 substeps at 1/120 = 0.00833s)
    const res = loop.step(0.025);
    assert.strictEqual(updateCount, 3);
    assert.strictEqual(res.ticks, 3);
    assert.ok(Math.abs(accumulatedDelta - 3 * (1 / 120)) < 1e-6);
  });

  it('clamps maximum delta time to 0.1s to prevent spiral of death', () => {
    let updateCount = 0;
    const loop = new GameLoop({
      maxAccumulator: 0.1,
      update: () => { updateCount++; }
    });

    // Tab unfocused for 5 full seconds
    const res = loop.step(5.0);
    // 0.1s max accumulator / (1/120s) = 12 substeps
    assert.strictEqual(updateCount, 12);
    assert.strictEqual(res.ticks, 12);
  });

  it('computes rendering interpolation alpha factor in [0, 1)', () => {
    const loop = new GameLoop();
    // Feed half a substep: 0.5 * (1/120)
    loop.step(0.5 * (1 / 120));
    const alpha = loop.getAlpha();
    assert.ok(Math.abs(alpha - 0.5) < 0.05, `Expected alpha ~0.5, got ${alpha}`);
  });

  it('safely handles zero and negative delta time without error', () => {
    const loop = new GameLoop();
    assert.doesNotThrow(() => {
      loop.step(0);
      loop.step(-0.05);
      loop.step(NaN);
    });
    assert.strictEqual(loop.accumulator, 0);
  });

  it('supports pause and resume state transitions', () => {
    let updateCount = 0;
    const loop = new GameLoop({ update: () => { updateCount++; } });

    loop.pause();
    assert.strictEqual(loop.isPaused, true);
    loop.step(0.05);
    assert.strictEqual(updateCount, 0, 'No updates while paused');

    loop.resume();
    assert.strictEqual(loop.isPaused, false);
    loop.step(0.025);
    assert.ok(updateCount > 0, 'Updates resume normally');
  });

  it('starts and stops loop cleanly', () => {
    const loop = new GameLoop();
    loop.start();
    assert.strictEqual(loop.isRunning, true);
    loop.stop();
    assert.strictEqual(loop.isRunning, false);
  });
});

// ============================================================================
// 3. CanvasRenderer Virtual Viewport Test Suite
// ============================================================================
describe('CanvasRenderer Virtual Viewport & Pixelation', () => {
  it('configures canonical 1280x720 virtual dimensions and pixelated styling', () => {
    const canvas = new MockCanvas(1280, 720);
    const renderer = new CanvasRenderer(canvas, { width: 1280, height: 720 });
    assert.strictEqual(renderer.width, 1280);
    assert.strictEqual(renderer.height, 720);
    assert.strictEqual(renderer.aspectRatio, 1280 / 720);
    assert.strictEqual(canvas.style.imageRendering, 'pixelated');
  });

  it('disables image smoothing across all 2D contexts', () => {
    const canvas = new MockCanvas(1280, 720);
    const renderer = new CanvasRenderer(canvas);
    assert.strictEqual(renderer.ctx.imageSmoothingEnabled, false);

    const offscreen = renderer.createOffscreenCanvas(32, 32);
    assert.strictEqual(offscreen.getContext('2d').imageSmoothingEnabled, false);
  });

  it('transforms screen client coordinates to virtual coordinates (screenToVirtual & toVirtualCoords)', () => {
    const canvas = new MockCanvas(640, 360);
    canvas._rect = { left: 50, top: 20, width: 640, height: 360, right: 690, bottom: 380 };
    const renderer = new CanvasRenderer(canvas, { width: 1280, height: 720 });

    // Midpoint of displayed canvas (370, 200) -> virtual midpoint (640, 360)
    const v1 = renderer.screenToVirtual(370, 200);
    assert.strictEqual(Math.round(v1.x), 640);
    assert.strictEqual(Math.round(v1.y), 360);

    const v2 = renderer.toVirtualCoords(370, 200);
    assert.strictEqual(Math.round(v2.x), 640);
    assert.strictEqual(Math.round(v2.y), 360);

    // Clamps boundary extremes
    const outMin = renderer.screenToVirtual(-100, -100);
    assert.strictEqual(outMin.x, 0);
    assert.strictEqual(outMin.y, 0);

    const outMax = renderer.screenToVirtual(9999, 9999);
    assert.strictEqual(outMax.x, 1280);
    assert.strictEqual(outMax.y, 720);
  });

  it('clear() paints full canvas with specified background color', () => {
    const canvas = new MockCanvas(1280, 720);
    const renderer = new CanvasRenderer(canvas);
    renderer.clear('#1e1e24');

    const lastCall = canvas.getContext('2d')._calls.filter(c => c.fn === 'fillRect').pop();
    assert.ok(lastCall);
    assert.deepStrictEqual(lastCall.args, [0, 0, 1280, 720]);
    assert.strictEqual(lastCall.fillStyle, '#1e1e24');
  });

  it('withCamera isolates world transform and guarantees context restoration', () => {
    const canvas = new MockCanvas(1280, 720);
    const renderer = new CanvasRenderer(canvas);
    const mockCamera = { x: 12, y: -8, angle: 0.04 };

    let executed = false;
    renderer.withCamera(mockCamera, (ctx) => {
      executed = true;
      assert.strictEqual(ctx, renderer.ctx);
    });
    assert.strictEqual(executed, true);

    const calls = canvas.getContext('2d')._calls;
    assert.ok(calls.some(c => c.fn === 'save'));
    assert.ok(calls.some(c => c.fn === 'restore'));
    assert.ok(calls.some(c => c.fn === 'translate' && c.args[0] === 12 && c.args[1] === -8));
  });

  it('drawSprite translates, rotates, scales, and restores correctly', () => {
    const canvas = new MockCanvas(1280, 720);
    const renderer = new CanvasRenderer(canvas);
    const sprite = new MockCanvas(32, 32);

    renderer.drawSprite(sprite, 200, 300, 64, 64, Math.PI / 4, 0.8, true);

    const calls = canvas.getContext('2d')._calls;
    assert.ok(calls.some(c => c.fn === 'translate' && c.args[0] === 200 && c.args[1] === 300));
    assert.ok(calls.some(c => c.fn === 'scale' && c.args[0] === -1 && c.args[1] === 1));
    assert.ok(calls.some(c => c.fn === 'drawImage'));
  });
});

// ============================================================================
// 4. Camera Trauma-Squared Shake Test Suite
// ============================================================================
describe('Camera Trauma-Squared Screen Shake Engine', () => {
  it('initializes in resting state (trauma = 0, no shake)', () => {
    const cam = new Camera();
    assert.strictEqual(cam.trauma, 0.0);
    assert.strictEqual(cam.shakeIntensity, 0.0);
    assert.strictEqual(cam.getShakeIntensity(), 0.0);
    assert.strictEqual(cam.isShaking, false);
    assert.strictEqual(cam.offsetX, 0.0);
    assert.strictEqual(cam.offsetY, 0.0);
    assert.strictEqual(cam.angle, 0.0);
  });

  it('clamps trauma addition and manual assignments to [0.0, 1.0]', () => {
    const cam = new Camera();
    cam.addTrauma(0.6);
    assert.strictEqual(cam.trauma, 0.6);
    assert.ok(Math.abs(cam.shakeIntensity - 0.36) < 1e-6); // 0.6^2

    cam.addTrauma(0.8);
    assert.strictEqual(cam.trauma, 1.0, 'Trauma must clamp at 1.0');
    assert.strictEqual(cam.shakeIntensity, 1.0);

    cam.addTrauma(-2.0);
    assert.strictEqual(cam.trauma, 0.0, 'Negative trauma clamps to 0.0');

    cam.setTrauma(1.5);
    assert.strictEqual(cam.trauma, 1.0);
  });

  it('decays trauma linearly over time at 1.8 / second', () => {
    const cam = new Camera({ decayRate: 1.8 });
    cam.setTrauma(1.0);

    // After 0.25s, trauma drops by 1.8 * 0.25 = 0.45 -> 0.55
    cam.update(0.25);
    assert.ok(Math.abs(cam.trauma - 0.55) < 1e-4);
    assert.strictEqual(cam.isShaking, true);

    // After 0.4s more, trauma decays completely to 0.0
    cam.update(0.4);
    assert.strictEqual(cam.trauma, 0.0);
    assert.strictEqual(cam.isShaking, false);
    assert.strictEqual(cam.offsetX, 0.0);
    assert.strictEqual(cam.offsetY, 0.0);
    assert.strictEqual(cam.angle, 0.0);
  });

  it('applies and restores context transformation with center-pivot rotation', () => {
    const cam = new Camera();
    cam.setTrauma(0.8);
    cam.update(0.016);

    const calls = [];
    const mockCtx = {
      save() { calls.push('save'); },
      restore() { calls.push('restore'); },
      translate(x, y) { calls.push(`translate(${Math.round(x)},${Math.round(y)})`); },
      rotate(a) { calls.push(`rotate(${a.toFixed(3)})`); }
    };

    cam.apply(mockCtx);
    assert.strictEqual(calls[0], 'save');
    assert.ok(calls.some(c => c.startsWith('translate')));

    cam.restore(mockCtx);
    assert.strictEqual(calls[calls.length - 1], 'restore');
  });

  it('shake() convenience wrapper guarantees context restore on error', () => {
    const cam = new Camera();
    cam.setTrauma(0.5);
    cam.update(0.016);

    let restored = false;
    const mockCtx = {
      save() {},
      restore() { restored = true; },
      translate() {},
      rotate() {}
    };

    assert.throws(() => {
      cam.shake(mockCtx, () => {
        throw new Error('Render crash');
      });
    }, /Render crash/);

    assert.strictEqual(restored, true, 'Context must be restored even if callback throws');
  });

  it('performs bidirectional coordinate inversion (screenToWorld and worldToScreen)', () => {
    const cam = new Camera();
    cam.setTrauma(0.8);
    cam.update(0.05);

    const worldPoint = { x: 500, y: 320 };
    const screenPoint = cam.worldToScreen(worldPoint.x, worldPoint.y);
    const inverted = cam.screenToWorld(screenPoint.x, screenPoint.y);

    assert.ok(Math.abs(worldPoint.x - inverted.x) < 1e-9);
    assert.ok(Math.abs(worldPoint.y - inverted.y) < 1e-9);
  });

  it('resets camera state completely', () => {
    const cam = new Camera();
    cam.setTrauma(0.9);
    cam.update(0.016);
    cam.reset();

    assert.strictEqual(cam.trauma, 0.0);
    assert.strictEqual(cam.offsetX, 0.0);
    assert.strictEqual(cam.offsetY, 0.0);
    assert.strictEqual(cam.angle, 0.0);
    assert.strictEqual(cam.isShaking, false);
  });
});

// ============================================================================
// 5. ParticleSystem Spiritual FX Test Suite
// ============================================================================
describe('ParticleSystem Zero-Allocation Spiritual FX', () => {
  it('pre-allocates fixed pool without runtime allocation', () => {
    const ps = new ParticleSystem({ capacity: 500, floorY: 700 });
    assert.strictEqual(ps.activeCount, 0);
    assert.strictEqual(ps.capacity, 500);
    assert.strictEqual(ps.pool.length, 500);
    assert.strictEqual(ps.particles.length, 0);
  });

  it('spawnEmbers generates high-velocity Reiatsu sparks', () => {
    const ps = new ParticleSystem({ capacity: 100 });
    ps.spawnEmbers(150, 250, 15, Math.PI / 3, '#ff0033');

    assert.strictEqual(ps.activeCount, 15);
    assert.strictEqual(ps.particles.length, 15);

    const ember = ps.particles[0];
    assert.strictEqual(ember.type, ParticleSystem.TYPE.EMBER);
    assert.strictEqual(ember.color, '#ff0033');
    assert.ok(Math.hypot(ember.vx, ember.vy) > 150, 'Embers must have high initial velocity');
  });

  it('spawnSmoke generates expanding upward-drifting miasma', () => {
    const ps = new ParticleSystem({ capacity: 100 });
    ps.spawnSmoke(200, 300, 8);
    assert.strictEqual(ps.activeCount, 8);

    const smoke = ps.particles[0];
    assert.strictEqual(smoke.type, ParticleSystem.TYPE.SMOKE);
    assert.ok(smoke.vy < 0, 'Smoke must drift upward (negative vy)');

    const initialRadius = smoke.radius;
    ps.update(0.2);
    assert.ok(smoke.radius > initialRadius, 'Smoke radius must expand');
    assert.ok(smoke.alpha < 0.85, 'Smoke alpha must fade');
  });

  it('spawnShards features ballistic gravity and floor bounce', () => {
    const ps = new ParticleSystem({ capacity: 100, floorY: 650 });
    ps.spawnShards(200, 500, 5);
    assert.strictEqual(ps.activeCount, 5);

    const shard = ps.particles[0];
    assert.strictEqual(shard.type, ParticleSystem.TYPE.SHARD);
    assert.strictEqual(shard.gravity, 520);

    // Force shard near floor with downward velocity
    shard.y = 649;
    shard.vy = 200;
    ps.update(0.016);

    assert.strictEqual(shard.y, 650, 'Clamped to floor');
    assert.ok(shard.vy < 0, 'Velocity reverses upwards on bounce');
  });

  it('recycles expired particles in O(1) via swap-and-pop', () => {
    const ps = new ParticleSystem({ capacity: 50 });
    ps.spawnEmbers(100, 100, 20);
    assert.strictEqual(ps.activeCount, 20);

    // Fast-forward beyond ember lifespan (0.5s max)
    ps.update(1.5);
    assert.strictEqual(ps.activeCount, 0);
    assert.strictEqual(ps.particles.length, 0);
    assert.strictEqual(ps.pool.length, 50, 'Pool length never changes');
  });

  it('gracefully recycles oldest particles when pool saturates', () => {
    const ps = new ParticleSystem({ capacity: 30 });
    for (let k = 0; k < 10; k++) {
      ps.spawnEmbers(100, 100, 10);
    }
    assert.ok(ps.activeCount <= 30);
    assert.ok(ps.particles.length <= 30);
  });

  it('recycles all pool slots smoothly during saturated bursts via rolling circular head pointer', () => {
    const ps = new ParticleSystem({ capacity: 5 });
    assert.strictEqual(ps.activeCount, 0);
    assert.strictEqual(ps.capacity, 5);
    assert.strictEqual(ps.maxParticles, 5);
    assert.strictEqual(ps.oldestIndex, 0);

    // Fill pool to saturation with burst at (10, 10)
    ps.spawnEmbers(10, 10, 5);
    assert.strictEqual(ps.activeCount, 5);
    for (let i = 0; i < 5; i++) {
      assert.ok(Math.abs(ps.pool[i].x - 10) <= 6, `Initial particle ${i} must be near x=10`);
      assert.strictEqual(ps.pool[i].active, true);
    }

    // Saturated burst: spawn 5 new particles at (200, 200)
    // Rolling circular pointer recycles slots 0, 1, 2, 3, 4 sequentially.
    ps.spawnEmbers(200, 200, 5);
    assert.strictEqual(ps.activeCount, 5, 'activeCount remains capped at capacity');
    for (let i = 0; i < 5; i++) {
      assert.ok(
        Math.abs(ps.pool[i].x - 200) <= 6,
        `Slot ${i} must be recycled with burst particle near x=200 (got ${ps.pool[i].x})`
      );
    }
    assert.strictEqual(ps.oldestIndex, 0, 'Head pointer wraps around smoothly');

    // Fractional saturated burst: spawn 2 particles at (500, 500)
    ps.spawnEmbers(500, 500, 2);
    assert.strictEqual(ps.activeCount, 5);
    assert.ok(Math.abs(ps.pool[0].x - 500) <= 6, 'Slot 0 recycled in 2-particle burst');
    assert.ok(Math.abs(ps.pool[1].x - 500) <= 6, 'Slot 1 recycled in 2-particle burst');
    assert.ok(Math.abs(ps.pool[2].x - 200) <= 6, 'Slot 2 retained from previous burst');
    assert.ok(Math.abs(ps.pool[3].x - 200) <= 6, 'Slot 3 retained from previous burst');
    assert.ok(Math.abs(ps.pool[4].x - 200) <= 6, 'Slot 4 retained from previous burst');
    assert.strictEqual(ps.oldestIndex, 2, 'Head pointer advanced by exactly 2');

    // Clear resets active count and rolling pointer
    ps.clear();
    assert.strictEqual(ps.activeCount, 0);
    assert.strictEqual(ps.oldestIndex, 0);
  });

  it('executes batched two-pass rendering (source-over and screen)', () => {
    const ps = new ParticleSystem({ capacity: 100 });
    ps.spawnEmbers(100, 100, 5);
    ps.spawnSmoke(100, 100, 5);
    ps.spawnShards(100, 100, 5);

    const ops = [];
    const mockCtx = {
      save() {},
      restore() {},
      beginPath() {},
      arc() {},
      fill() {},
      fillRect() {},
      translate() {},
      rotate() {},
      globalAlpha: 1.0,
      set globalCompositeOperation(val) { ops.push(val); },
      get globalCompositeOperation() { return ops[ops.length - 1] || 'source-over'; }
    };

    ps.draw(mockCtx);
    assert.ok(ops.includes('source-over'));
    assert.ok(ops.includes('screen'));
  });

  it('clear() deactivates all active particles', () => {
    const ps = new ParticleSystem({ capacity: 50 });
    ps.spawnEmbers(100, 100, 20);
    assert.strictEqual(ps.activeCount, 20);

    ps.clear();
    assert.strictEqual(ps.activeCount, 0);
    assert.strictEqual(ps.particles.length, 0);
  });
});

// ============================================================================
// 6. SpriteGen Procedural RotMG Sprites Test Suite
// ============================================================================
describe('SpriteGen RotMG Procedural Sprite Matrices', () => {
  it('applies automated 4-way cardinal outline to non-transparent pixels', () => {
    const single = [
      '...',
      '.X.',
      '...'
    ];
    const outSingle = applyOutline(single, '#');
    assert.strictEqual(outSingle[0], '.#.');
    assert.strictEqual(outSingle[1], '#X#');
    assert.strictEqual(outSingle[2], '.#.');

    // Solid pixels are preserved
    const block = [
      '..',
      'XY'
    ];
    const outBlock = applyOutline(block, '#');
    assert.strictEqual(outBlock[1], 'XY');
  });

  it('preserves exact grid dimensions (16x16 / 32x32) with 1-pixel dark outline and zero pixel shift', () => {
    // 1. applyOutline with default 7-character hex '#0a0a0c' must NOT expand row length
    const testGrid = [
      '.....',
      '..X..',
      '.....'
    ];
    const outlined = applyOutline(testGrid, '#0a0a0c');
    assert.strictEqual(outlined.length, 3, 'Output row count must match input');
    for (let r = 0; r < outlined.length; r++) {
      const rowLen = outlined[r].length;
      assert.strictEqual(rowLen, 5, `Row ${r} must preserve width 5, got ${rowLen}`);
    }

    // 2. All 11 sprite definitions must preserve exact size (16 or 32) when applyOutline is run
    for (const [name, def] of Object.entries(SPRITE_DEFS)) {
      const spriteOutlined = applyOutline(def.rows, '#0a0a0c');
      assert.strictEqual(spriteOutlined.length, def.size, `${name}: row count must equal ${def.size}`);
      for (let r = 0; r < def.size; r++) {
        const rowLen = spriteOutlined[r].length;
        assert.strictEqual(
          rowLen,
          def.size,
          `${name}: row ${r} length must be exactly ${def.size} (got ${rowLen}) without multi-char string expansion`
        );
      }
    }

    // 3. Pixel placement verification: rasterize 'crawler' and verify exact un-shifted columns
    const fills = [];
    let curFill = '';
    const mockFactory = (w, h) => ({
      width: w,
      height: h,
      getContext: () => ({
        imageSmoothingEnabled: false,
        set fillStyle(val) { curFill = val; },
        get fillStyle() { return curFill; },
        fillRect: (x, y, w, h) => fills.push({ x, y, color: curFill })
      })
    });

    SpriteGen.rasterize('crawler', 1, mockFactory);
    const row1Fills = fills.filter(f => f.y === 1);
    const col4 = row1Fills.find(f => f.x === 4);
    const col5 = row1Fills.find(f => f.x === 5);
    const col10 = row1Fills.find(f => f.x === 10);
    const col11 = row1Fills.find(f => f.x === 11);

    assert.ok(col4, 'Row 1, col 4 must be filled (outline)');
    assert.strictEqual(col4.color, '#0a0a0c', 'Col 4 must be outline color #0a0a0c');
    assert.ok(col5, 'Row 1, col 5 must be filled (crawler mask ivory white)');
    assert.strictEqual(col5.color, '#f8fafc', `Col 5 must be #f8fafc (got ${col5.color})`);
    assert.ok(col10, 'Row 1, col 10 must be filled (crawler mask ivory white)');
    assert.strictEqual(col10.color, '#f8fafc', `Col 10 must be #f8fafc (got ${col10.color})`);
    assert.ok(col11, 'Row 1, col 11 must be filled (outline)');
    assert.strictEqual(col11.color, '#0a0a0c', 'Col 11 must be outline color #0a0a0c');

    // 4. Idempotence / cascade resistance: two successive passes of applyOutline must be identical
    const pass1 = applyOutline(testGrid, '#0a0a0c');
    const pass2 = applyOutline(pass1, '#0a0a0c');
    assert.deepStrictEqual(pass2, pass1, 'applyOutline must be idempotent (no cascade / leakage on multiple passes)');
  });

  it('contains all 11 required sprite definitions with valid dimensions', () => {
    const required = [
      'katana',
      'altar_intact',
      'altar_damaged',
      'altar_critical',
      'crawler',
      'crawler_walk',
      'flyer_0',
      'flyer_1',
      'brute',
      'menos',
      'menos_cero'
    ];

    for (const name of required) {
      const def = SPRITE_DEFS[name];
      assert.ok(def, `Sprite '${name}' must be defined`);
      assert.strictEqual(def.rows.length, def.size, `'${name}' row count must equal size`);
      assert.ok(
        def.rows.every(row => row.length === def.size),
        `'${name}' every row length must equal ${def.size}`
      );
    }
  });

  it('rasterizes sprite using MockCanvas and disables image smoothing', () => {
    const factory = (w, h) => new MockCanvas(w, h);
    const canvas = SpriteGen.rasterize('crawler', 1, factory);

    assert.strictEqual(canvas.width, 16);
    assert.strictEqual(canvas.height, 16);
    assert.strictEqual(canvas.getContext('2d').imageSmoothingEnabled, false);
  });

  it('SpriteCache stores and retrieves cached sprite canvases', () => {
    const cache = new SpriteCache();
    const mock = new MockCanvas(32, 32);
    cache.set('katana', mock);

    assert.strictEqual(cache.has('katana'), true);
    assert.strictEqual(cache.get('katana'), mock);
    assert.throws(() => cache.get('unknown_sprite'), /not found/);
  });

  it('initAll() pre-populates default cache with all 11 sprites and aliases', () => {
    const factory = (w, h) => new MockCanvas(w, h);
    const cache = new SpriteCache();
    SpriteGen.initAll({ canvasFactory: factory, cache });

    assert.ok(cache.has('katana'));
    assert.ok(cache.has('altar_intact'));
    assert.ok(cache.has('altar_damaged'));
    assert.ok(cache.has('altar_critical'));
    assert.ok(cache.has('altar')); // Alias
    assert.ok(cache.has('crawler'));
    assert.ok(cache.has('crawler_walk'));
    assert.ok(cache.has('flyer_0'));
    assert.ok(cache.has('flyer_1'));
    assert.ok(cache.has('flyer')); // Alias
    assert.ok(cache.has('brute'));
    assert.ok(cache.has('menos'));
    assert.ok(cache.has('menos_cero'));
  });

  it('getSprite returns cached identity across successive calls', () => {
    const s1 = SpriteGen.getSprite('crawler');
    const s2 = SpriteGen.getSprite('crawler');
    assert.strictEqual(s1, s2, 'Successive calls must return cached identity');
  });

  it('parseMatrix handles invalid characters gracefully with fallback null', () => {
    assert.doesNotThrow(() => {
      const parsed = SpriteGen.parseMatrix(['?#?'], { '#': '#ff0000' });
      assert.strictEqual(parsed[0][0], null);
      assert.strictEqual(parsed[0][1], '#ff0000');
      assert.strictEqual(parsed[0][2], null);
    });
  });
});
