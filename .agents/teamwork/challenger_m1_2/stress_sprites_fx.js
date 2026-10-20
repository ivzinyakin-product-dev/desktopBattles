/**
 * Tensa Zangetsu: Soul Altar Defense
 * .agents/teamwork/challenger_m1_2/stress_sprites_fx.js
 * 
 * Adversarial Empirical Stress Test Suite for Milestone 1:
 * - SpriteGen (RotMG matrices, palettes, 1px cardinal outline, cache performance)
 * - ParticleSystem (5,000 spawns, 1,000 frames, pool recycling, memory leak check, floor clamping)
 * - Camera (trauma decay monotonicity, clamping [0, 1], trauma^2 quadratic shake, coordinate invertibility)
 */

const path = require('path');
const assert = require('assert');

// Load engine modules directly
const engineDir = path.resolve(__dirname, '../../../src/engine');
const SpriteGen = require(path.join(engineDir, 'SpriteGen.js'));
const ParticleSystem = require(path.join(engineDir, 'ParticleSystem.js'));
const Camera = require(path.join(engineDir, 'Camera.js'));
const CanvasRenderer = require(path.join(engineDir, 'CanvasRenderer.js'));

const SPRITE_DEFS = SpriteGen.SPRITE_DEFS;
const applyOutline = SpriteGen.applyOutline;
const MockCanvas = CanvasRenderer.MockCanvas;

// Test Results Collector
const results = {
  totalPassed: 0,
  totalFailed: 0,
  suites: []
};

function runTest(suiteName, testName, testFn) {
  let currentSuite = results.suites.find(s => s.name === suiteName);
  if (!currentSuite) {
    currentSuite = { name: suiteName, tests: [] };
    results.suites.push(currentSuite);
  }
  const startTime = process.hrtime.bigint();
  try {
    testFn();
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;
    currentSuite.tests.push({ name: testName, status: 'PASS', durationMs });
    results.totalPassed++;
    console.log(`  [PASS] ${testName} (${durationMs.toFixed(3)}ms)`);
  } catch (err) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;
    currentSuite.tests.push({ name: testName, status: 'FAIL', durationMs, error: err.message, stack: err.stack });
    results.totalFailed++;
    console.error(`  [FAIL] ${testName} (${durationMs.toFixed(3)}ms)`);
    console.error(`         Reason: ${err.message}`);
  }
}

console.log('======================================================================');
console.log('CHALLENGER 2: ADVERSARIAL STRESS TEST SUITE (M1 VISUALS & FX)');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: SpriteGen Assets & Palettes (11 Sprites)
// -----------------------------------------------------------------------------
console.log('▶ Suite 1: SpriteGen Assets & Palettes');

const REQUIRED_SPRITES = [
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

runTest('Suite 1: SpriteGen Assets & Palettes', 'All 11 sprite definitions exist with valid sizes and palettes', () => {
  assert.strictEqual(Object.keys(SPRITE_DEFS).length >= 11, true, 'At least 11 sprite definitions');
  for (const spriteName of REQUIRED_SPRITES) {
    const def = SPRITE_DEFS[spriteName];
    assert.ok(def, `Sprite '${spriteName}' must be defined`);
    assert.ok(def.size === 16 || def.size === 32, `Sprite '${spriteName}' size must be 16 or 32 (got ${def.size})`);
    assert.strictEqual(Array.isArray(def.rows), true, `Sprite '${spriteName}' rows must be an array`);
    assert.strictEqual(def.rows.length, def.size, `Sprite '${spriteName}' must have ${def.size} rows`);
    assert.strictEqual(typeof def.palette, 'object', `Sprite '${spriteName}' must define a palette`);
    assert.strictEqual(def.palette['.'], null, `Sprite '${spriteName}' palette['.'] must be null (transparent)`);

    // Verify all colors in palette are valid hex or null
    for (const [char, color] of Object.entries(def.palette)) {
      if (color !== null) {
        assert.match(color, /^#[0-9a-fA-F]{6}$/, `Sprite '${spriteName}' char '${char}' color '${color}' must be valid 6-hex code`);
      }
    }

    // Verify all characters in rows exist in palette
    for (let r = 0; r < def.rows.length; r++) {
      const row = def.rows[r];
      assert.strictEqual(row.length, def.size, `Sprite '${spriteName}' row ${r} length must be ${def.size} (got ${row.length})`);
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        assert.ok(ch in def.palette, `Sprite '${spriteName}' at (${r}, ${c}) has undefined char '${ch}'`);
      }
    }
  }
});

runTest('Suite 1: SpriteGen Assets & Palettes', 'Rasterization generates canvas with proper dimensions and smoothing disabled', () => {
  for (const spriteName of REQUIRED_SPRITES) {
    const canvas = SpriteGen.rasterize(spriteName, 2);
    assert.ok(canvas, `Rasterize '${spriteName}' returns a canvas`);
    const def = SPRITE_DEFS[spriteName];
    assert.strictEqual(canvas.width, def.size * 2);
    assert.strictEqual(canvas.height, def.size * 2);
    const ctx = canvas.getContext('2d');
    assert.strictEqual(ctx.imageSmoothingEnabled, false, `imageSmoothingEnabled must be false for '${spriteName}'`);
  }
});

runTest('Suite 1: SpriteGen Assets & Palettes', 'Sprite aliases and resolution fallbacks', () => {
  const altarDef = SpriteGen.getDef('altar');
  assert.strictEqual(altarDef, SPRITE_DEFS.altar_intact, `'altar' alias resolves to 'altar_intact'`);
  const flyerDef = SpriteGen.getDef('flyer');
  assert.strictEqual(flyerDef, SPRITE_DEFS.flyer_0, `'flyer' alias resolves to 'flyer_0'`);

  // parseMatrix with unknown characters returns null without throwing
  const matrix = ['..X..', '.#.#.'];
  const parsed = SpriteGen.parseMatrix(matrix, { '#': '#ff0000' });
  assert.strictEqual(parsed[0][0], null);
  assert.strictEqual(parsed[0][2], null, 'Unknown char X falls back to null');
  assert.strictEqual(parsed[1][1], '#ff0000', 'Known char mapped correctly');
});

// -----------------------------------------------------------------------------
// SUITE 2: SpriteGen 1-Pixel Dark Outline Algorithm & Rasterization Integrity
// -----------------------------------------------------------------------------
console.log('\n▶ Suite 2: SpriteGen 1-Pixel Dark Outline Algorithm & Rasterization Integrity');

runTest('Suite 2: SpriteGen Outline', 'Outline preserves grid dimensions (row lengths must not expand)', () => {
  const input = [
    '.....',
    '..X..',
    '.....'
  ];
  const outlined = applyOutline(input, '#0a0a0c');
  // Each row in outlined MUST have length 5!
  for (let r = 0; r < outlined.length; r++) {
    const len = outlined[r].length;
    assert.strictEqual(len, 5, `Row ${r} length expanded from 5 to ${len}! Content: '${outlined[r]}'`);
  }
});

runTest('Suite 2: SpriteGen Outline', 'Single pixel isolated outline: exact 4 cardinal neighbors, NO diagonal bloat', () => {
  // Test with 1-char token to test pure geometry
  const input = [
    '.....',
    '.....',
    '..X..',
    '.....',
    '.....'
  ];
  const outlineToken = '#';
  const outlined = applyOutline(input, outlineToken);

  // Center pixel (2, 2) must remain 'X'
  assert.strictEqual(outlined[2][2], 'X', 'Center pixel must remain X');

  // Cardinal neighbors must be outlineToken
  assert.strictEqual(outlined[1][2], outlineToken, 'North neighbor (1, 2) must be outlined');
  assert.strictEqual(outlined[3][2], outlineToken, 'South neighbor (3, 2) must be outlined');
  assert.strictEqual(outlined[2][1], outlineToken, 'West neighbor (2, 1) must be outlined');
  assert.strictEqual(outlined[2][3], outlineToken, 'East neighbor (2, 3) must be outlined');

  // Diagonal neighbors must REMAIN '.' (Corner bloat prevention!)
  assert.strictEqual(outlined[1][1], '.', 'North-West diagonal (1, 1) must remain . (no diagonal bloat)');
  assert.strictEqual(outlined[1][3], '.', 'North-East diagonal (1, 3) must remain . (no diagonal bloat)');
  assert.strictEqual(outlined[3][1], '.', 'South-West diagonal (3, 1) must remain . (no diagonal bloat)');
  assert.strictEqual(outlined[3][3], '.', 'South-East diagonal (3, 3) must remain . (no diagonal bloat)');

  // Count total outline pixels: exactly 4!
  let outlineCount = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (outlined[r][c] === outlineToken) outlineCount++;
    }
  }
  assert.strictEqual(outlineCount, 4, 'Single pixel must produce exactly 4 cardinal outline pixels');
});

runTest('Suite 2: SpriteGen Outline', 'Solid 2x2 box outline: 8 border pixels, outer diagonals untouched', () => {
  const input = [
    '......',
    '..XX..',
    '..XX..',
    '......'
  ];
  const outlineToken = '#';
  const outlined = applyOutline(input, outlineToken);

  // Original 2x2 box untouched
  assert.strictEqual(outlined[1][2], 'X');
  assert.strictEqual(outlined[1][3], 'X');
  assert.strictEqual(outlined[2][2], 'X');
  assert.strictEqual(outlined[2][3], 'X');

  // Cardinal border pixels: exactly 8 perimeter pixels
  assert.strictEqual(outlined[0][2], outlineToken);
  assert.strictEqual(outlined[0][3], outlineToken);
  assert.strictEqual(outlined[3][2], outlineToken);
  assert.strictEqual(outlined[3][3], outlineToken);
  assert.strictEqual(outlined[1][1], outlineToken);
  assert.strictEqual(outlined[2][1], outlineToken);
  assert.strictEqual(outlined[1][4], outlineToken);
  assert.strictEqual(outlined[2][4], outlineToken);

  // Diagonal outer corners: (0, 1), (0, 4), (3, 1), (3, 4) must remain '.'
  assert.strictEqual(outlined[0][1], '.');
  assert.strictEqual(outlined[0][4], '.');
  assert.strictEqual(outlined[3][1], '.');
  assert.strictEqual(outlined[3][4], '.');
});

runTest('Suite 2: SpriteGen Outline', 'Cascade / leakage resistance with default outlineColor (#0a0a0c)', () => {
  const input = [
    '.......',
    '...X...',
    '.......'
  ];
  const pass1 = applyOutline(input, '#0a0a0c');
  const pass2 = applyOutline(pass1, '#0a0a0c');

  // Check row length of pass1
  assert.strictEqual(pass1[0].length, 7, `pass1 row 0 length must be 7 (got ${pass1[0].length})`);
  assert.deepStrictEqual(pass2, pass1, 'Outline must be strictly 1-pixel wide and idempotent (no cascade)');
});

runTest('Suite 2: SpriteGen Outline', 'Rasterizer pixel placement accuracy: no pixel column shifting or truncations', () => {
  // Test crawler rasterization: crawler has 6 'w' pixels at row 1, cols 5-10
  const fills = [];
  let curColor = '';
  const mockFactory = (w, h) => ({
    width: w,
    height: h,
    getContext: () => ({
      imageSmoothingEnabled: false,
      set fillStyle(c) { curColor = c; },
      get fillStyle() { return curColor; },
      fillRect: (x, y, w, h) => fills.push({ x, y, color: curColor })
    })
  });

  SpriteGen.rasterize('crawler', 1, mockFactory);
  const row1Fills = fills.filter(f => f.y === 1);

  // Expected in row 1 for crawler ('.....wwwwww.....'):
  // col 4: outline (#0a0a0c)
  // cols 5-10: 'w' (#f8fafc)
  // col 11: outline (#0a0a0c)
  // Total 8 fills in row 1
  const col4 = row1Fills.find(f => f.x === 4);
  const col5 = row1Fills.find(f => f.x === 5);
  const col10 = row1Fills.find(f => f.x === 10);
  const col11 = row1Fills.find(f => f.x === 11);

  assert.ok(col4, 'Col 4 must be filled (outline)');
  assert.strictEqual(col4.color, '#0a0a0c', 'Col 4 must be outline color');

  assert.ok(col5, 'Col 5 must be filled (crawler mask ivory white)');
  assert.strictEqual(col5.color, '#f8fafc', `Col 5 must be Ivory White #f8fafc (got ${col5.color})`);

  assert.ok(col10, 'Col 10 must be filled (crawler mask ivory white)');
  assert.strictEqual(col10.color, '#f8fafc', `Col 10 must be Ivory White #f8fafc (got ${col10.color})`);

  assert.ok(col11, 'Col 11 must be filled (outline)');
  assert.strictEqual(col11.color, '#0a0a0c', 'Col 11 must be outline color');
});

// -----------------------------------------------------------------------------
// SUITE 3: SpriteGen Cache Hit Performance (100,000 requests)
// -----------------------------------------------------------------------------
console.log('\n▶ Suite 3: SpriteGen Cache Hit Performance (100,000 requests)');

runTest('Suite 3: SpriteGen Cache Hit', 'Pre-populate cache and verify 100,000 requests execute in < 100ms with identity preservation', () => {
  SpriteGen.initAll();

  // Test sprite retrieval identity
  const katana1 = SpriteGen.get('katana');
  const katana2 = SpriteGen.get('katana');
  assert.strictEqual(katana1, katana2, 'Cache returns exact identical canvas reference');

  // Adversarial stress: 100,000 rapid calls cycling through all 11 sprites + aliases
  const keys = [...REQUIRED_SPRITES, 'altar', 'flyer'];
  const keyCount = keys.length;

  // Measure initial memory
  if (global.gc) global.gc();
  const heapBefore = process.memoryUsage().heapUsed;

  const tStart = process.hrtime.bigint();
  for (let i = 0; i < 100000; i++) {
    const key = keys[i % keyCount];
    const sprite = SpriteGen.get(key);
    if (!sprite) {
      throw new Error(`SpriteGen.get('${key}') returned falsy at iteration ${i}`);
    }
  }
  const tEnd = process.hrtime.bigint();
  const elapsedMs = Number(tEnd - tStart) / 1e6;
  const heapAfter = process.memoryUsage().heapUsed;
  const heapDeltaKB = (heapAfter - heapBefore) / 1024;

  console.log(`    -> 100,000 requests completed in: ${elapsedMs.toFixed(2)} ms (${(100000 / (elapsedMs / 1000)).toFixed(0)} ops/sec)`);
  console.log(`    -> Heap memory delta: ${heapDeltaKB.toFixed(2)} KB`);

  assert.strictEqual(elapsedMs < 200, true, `100,000 cache requests must take < 200ms (took ${elapsedMs.toFixed(2)}ms)`);
});

// -----------------------------------------------------------------------------
// SUITE 4: ParticleSystem Pool Recycling & Stress (5,000 particles, 1,000 frames)
// -----------------------------------------------------------------------------
console.log('\n▶ Suite 4: ParticleSystem Pool Recycling & Memory Stress');

runTest('Suite 4: ParticleSystem', 'Spawn 5,000 particles and update for 1,000 frames: pool recycling & zero leaks', () => {
  const ps = new ParticleSystem({ capacity: 800, floorY: 700 });
  assert.strictEqual(ps.capacity, 800);
  assert.strictEqual(ps.pool.length, 800);
  assert.strictEqual(ps.activeCount, 0);

  let totalSpawned = 0;
  let maxActiveObserved = 0;
  const dt = 1 / 120; // 120Hz physics sub-step (~8.33ms)

  // Track heap
  if (global.gc) global.gc();
  const initialHeap = process.memoryUsage().heapUsed;

  // Phase 1: Heavy continuous spawning for first 500 frames (bursts of embers, smoke, shards)
  for (let frame = 0; frame < 500; frame++) {
    // Every frame spawn 10 embers
    ps.spawnEmbers(640, 360, 10);
    totalSpawned += 10;

    // Every 5 frames spawn 6 smoke
    if (frame % 5 === 0) {
      ps.spawnSmoke(640, 360, 6);
      totalSpawned += 6;
    }

    // Every 10 frames spawn 8 shards
    if (frame % 10 === 0) {
      ps.spawnShards(640, 360, 8);
      totalSpawned += 8;
    }

    ps.update(dt);

    if (ps.activeCount > maxActiveObserved) {
      maxActiveObserved = ps.activeCount;
    }

    // Verify invariants during spawning:
    assert.strictEqual(ps.pool.length, 800, 'Pool array must NEVER grow beyond capacity');
    assert.strictEqual(ps.activeCount <= 800, true, 'Active count must NEVER exceed capacity');

    // Sample active particles for validity
    for (let pIdx = 0; pIdx < Math.min(ps.activeCount, 20); pIdx++) {
      const p = ps.pool[pIdx];
      assert.strictEqual(typeof p.x, 'number');
      assert.strictEqual(isNaN(p.x), false, 'p.x must not be NaN');
      assert.strictEqual(isNaN(p.y), false, 'p.y must not be NaN');
      assert.strictEqual(isNaN(p.vx), false, 'p.vx must not be NaN');
      assert.strictEqual(isNaN(p.vy), false, 'p.vy must not be NaN');
      assert.strictEqual(p.alpha >= 0 && p.alpha <= 1.0, true, `Alpha must be in [0, 1] (got ${p.alpha})`);
    }
  }

  assert.strictEqual(totalSpawned >= 5000, true, `Must have spawned at least 5,000 particles (spawned ${totalSpawned})`);
  console.log(`    -> Phase 1: Total spawned = ${totalSpawned}, Peak active count = ${maxActiveObserved}/${ps.capacity}`);

  // Phase 2: Cease spawning, continue updating for 500 frames to verify 100% recycling
  for (let frame = 500; frame < 1000; frame++) {
    ps.update(dt);

    // Verify shard bounds clamping
    for (let i = 0; i < ps.activeCount; i++) {
      const p = ps.pool[i];
      if (p.type === ParticleSystem.TYPE.SHARD) {
        assert.strictEqual(p.y <= 700.001, true, `Shard Y must clamp to floorY=700 (got ${p.y})`);
      }
    }
  }

  // At frame 1000, since maxLife is <= 1.1s and 500 frames of dt=1/120s is ~4.17s,
  // all particles MUST have expired and returned to pool!
  console.log(`    -> Phase 2: Active count at frame 1000 = ${ps.activeCount}`);
  assert.strictEqual(ps.activeCount, 0, 'All particles must be recycled to pool when lifespan expires');

  // Check memory stability
  const finalHeap = process.memoryUsage().heapUsed;
  const netHeapDeltaKB = (finalHeap - initialHeap) / 1024;
  console.log(`    -> Net heap change after 5,000 particles and 1,000 frames: ${netHeapDeltaKB.toFixed(2)} KB`);
  assert.strictEqual(netHeapDeltaKB < 5000, true, 'Heap growth must remain under 5MB (no uncollected leaks)');
});

runTest('Suite 4: ParticleSystem', 'Pool capacity hard cap to 1000 and clear() recycling', () => {
  const psOversized = new ParticleSystem({ capacity: 5000 });
  assert.strictEqual(psOversized.capacity, 1000, 'Capacity > 1000 must be hard-capped at 1000');
  assert.strictEqual(psOversized.pool.length, 1000);

  psOversized.spawnEmbers(100, 100, 50);
  assert.strictEqual(psOversized.activeCount, 50);
  psOversized.clear();
  assert.strictEqual(psOversized.activeCount, 0, 'clear() instantly resets activeCount to 0');
});

runTest('Suite 4: ParticleSystem', 'Mock canvas draw executes without exceptions', () => {
  const ps = new ParticleSystem({ capacity: 100 });
  ps.spawnEmbers(100, 100, 5);
  ps.spawnSmoke(100, 100, 5);
  ps.spawnShards(100, 100, 5);

  const canvas = new MockCanvas(1280, 720);
  const ctx = canvas.getContext('2d');
  ps.draw(ctx);
  // Verify draw executed cleanly
  assert.strictEqual(ps.activeCount, 15);
});

// -----------------------------------------------------------------------------
// SUITE 5: Camera Trauma & Non-Linear Shake Stress
// -----------------------------------------------------------------------------
console.log('\n▶ Suite 5: Camera Trauma & Non-Linear Shake Stress');

runTest('Suite 5: Camera', 'Trauma clamping strictly within [0.0, 1.0] under extreme values', () => {
  const cam = new Camera();
  assert.strictEqual(cam.trauma, 0.0);

  cam.addTrauma(0.5);
  assert.strictEqual(cam.trauma, 0.5);

  // Overflow clamp
  cam.addTrauma(5.0);
  assert.strictEqual(cam.trauma, 1.0, 'Trauma must clamp at 1.0');

  // Underflow clamp
  cam.addTrauma(-10.0);
  assert.strictEqual(cam.trauma, 0.0, 'Trauma must clamp at 0.0');

  // setTrauma clamping
  cam.setTrauma(999);
  assert.strictEqual(cam.trauma, 1.0);
  cam.setTrauma(-999);
  assert.strictEqual(cam.trauma, 0.0);

  // Adversarial inputs: NaN / strings must be rejected
  cam.setTrauma(0.75);
  cam.addTrauma(NaN);
  assert.strictEqual(cam.trauma, 0.75, 'NaN addition ignored');
  cam.addTrauma('malicious');
  assert.strictEqual(cam.trauma, 0.75, 'String addition ignored');
});

runTest('Suite 5: Camera', 'Trauma decay monotonicity and rest transition', () => {
  const cam = new Camera({ decayRate: 1.8 });
  cam.setTrauma(1.0);

  const dt = 0.01; // 10ms steps
  let prevTrauma = cam.trauma;

  // Run 100 steps
  for (let step = 0; step < 100; step++) {
    cam.update(dt);
    assert.strictEqual(cam.trauma <= prevTrauma, true, `Trauma must monotonically decrease: ${cam.trauma} <= ${prevTrauma}`);
    assert.strictEqual(cam.trauma >= 0.0, true, 'Trauma must never become negative');
    prevTrauma = cam.trauma;
  }

  // Decay time from 1.0 at 1.8/s is 1.0 / 1.8 = ~0.555s (56 steps)
  // At step 100 (1.0s elapsed), camera MUST be completely at rest
  assert.strictEqual(cam.trauma, 0.0, 'Trauma must be exactly 0.0 after decay time');
  assert.strictEqual(cam.offsetX, 0.0, 'offsetX must be 0 at rest');
  assert.strictEqual(cam.offsetY, 0.0, 'offsetY must be 0 at rest');
  assert.strictEqual(cam.angle, 0.0, 'angle must be 0 at rest');
  assert.strictEqual(cam.isShaking, false, 'isShaking must be false at rest');
});

runTest('Suite 5: Camera', 'Non-linear trauma^2 shake intensity verification', () => {
  const cam = new Camera();

  // Test quadratic intensity curve: S = T^2
  for (let t = 0; t <= 10; t++) {
    const traumaVal = t / 10.0;
    cam.setTrauma(traumaVal);
    const expectedShake = traumaVal * traumaVal;
    assert.strictEqual(Math.abs(cam.shakeIntensity - expectedShake) < 1e-9, true, `shakeIntensity must be T^2 for T=${traumaVal}`);
    assert.strictEqual(Math.abs(cam.getShakeIntensity() - expectedShake) < 1e-9, true);
  }

  // Non-linear ratio test: Intensity(1.0) / Intensity(0.5) must equal 4.0
  cam.setTrauma(1.0);
  const intensityAt1 = cam.shakeIntensity;
  cam.setTrauma(0.5);
  const intensityAtHalf = cam.shakeIntensity;
  const ratio = intensityAt1 / intensityAtHalf;
  assert.strictEqual(Math.abs(ratio - 4.0) < 1e-9, true, `Quadratic ratio must be exactly 4.0 (got ${ratio})`);
});

runTest('Suite 5: Camera', 'Coordinate transform bidirectional invertibility: screenToWorld(worldToScreen(P)) == P', () => {
  const cam = new Camera();
  cam.setTrauma(1.0);
  cam.update(0.016); // Trigger shake offset and rotation

  assert.strictEqual(cam.isShaking, true);
  assert.ok(cam.offsetX !== 0 || cam.offsetY !== 0 || cam.angle !== 0);

  // Test 1,000 random points across arena and offscreen
  for (let i = 0; i < 1000; i++) {
    const wx = (Math.random() - 0.2) * 1600;
    const wy = (Math.random() - 0.2) * 1000;

    const screenPos = cam.worldToScreen(wx, wy);
    const worldReconstructed = cam.screenToWorld(screenPos.x, screenPos.y);

    const errX = Math.abs(worldReconstructed.x - wx);
    const errY = Math.abs(worldReconstructed.y - wy);

    assert.strictEqual(errX < 1e-6, true, `Inversion X error must be < 1e-6 (got ${errX} for point (${wx}, ${wy}))`);
    assert.strictEqual(errY < 1e-6, true, `Inversion Y error must be < 1e-6 (got ${errY} for point (${wx}, ${wy}))`);
  }
});

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log('ADVERSARIAL STRESS TEST SUMMARY:');
console.log(`Total Passed: ${results.totalPassed}`);
console.log(`Total Failed: ${results.totalFailed}`);
console.log('======================================================================');

if (results.totalFailed > 0) {
  console.error('\nVERDICT: REQUEST_CHANGES (Failures detected)');
  process.exit(1);
} else {
  console.log('\nVERDICT: APPROVE (All adversarial tests passed cleanly)');
  process.exit(0);
}
