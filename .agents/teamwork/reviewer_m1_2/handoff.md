# Handoff Report: Milestone 1 Independent Review & Adversarial Challenge

- **Reviewer**: Reviewer 2 (`reviewer_m1_2`)
- **Roles**: Reviewer, Adversarial Critic
- **Target**: Milestone 1 (Engine Core) — `worker_m1_1`
- **Date**: 2026-10-18T14:53:00Z
- **Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Test Execution Verification
Independent test execution commands were run in the project root:

1. **Core Engine Test Suite**:
   ```cmd
   node --test test/test-engine.js
   ```
   Result:
   - Suites: 7
   - Pass: 50
   - Fail: 0
   - Duration: 104.2ms

2. **System E2E Test Suite**:
   ```cmd
   node --test test/test-e2e.js
   ```
   Result:
   - Suites: 36
   - Pass: 34 (all active Milestone 1 engine tests)
   - Fail: 0
   - Skipped: 137 (unimplemented downstream milestones)

### 1.2 Code Inspection Observations

#### Finding 1: Critical — `applyOutline` String Joining Corrupts Rasterization Across All 11 Sprites (Tagged: INTEGRITY VIOLATION / SELF-CERTIFYING TEST)
- **Location**: `src/engine/SpriteGen.js:46-49` & `src/engine/SpriteGen.js:648-656`
- **Code in `src/engine/SpriteGen.js:46-49`**:
  ```javascript
  if (isInputStringArray) {
    return out.map(row => row.join(''));
  }
  return out;
  ```
- **Code in `src/engine/SpriteGen.js:648-656` (`rasterize`)**:
  ```javascript
  const outlined = applyOutline(def.rows, '#0a0a0c');
  ...
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const char = outlined[r][c];
      if (!char || char === '.') continue;
      const color = char === '#0a0a0c' ? '#0a0a0c' : (def.palette[char] || '#0a0a0c');
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(c * scale, r * scale, scale, scale);
      }
    }
  }
  ```
- **Observed Behavior**:
  - `def.rows` for all 11 sprites in `SPRITE_DEFS` are arrays of strings (e.g. `16` or `32` characters wide).
  - Therefore, `isInputStringArray` evaluates to `true`.
  - When `applyOutline` encounters a transparent cell adjacent to a solid pixel, it assigns `out[r][c] = '#0a0a0c'` (a 7-character string).
  - Calling `row.join('')` on an array containing 7-character strings produces rows with string lengths of 50 to 100+ characters (e.g. for `crawler`, row 0 length expands from 16 to 52: `'.....#0a0a0c#0a0a0c#0a0a0c#0a0a0c#0a0a0c#0a0a0c.....'`).
  - In `rasterize`, column loop `c` iterates from `0` to `size - 1` (e.g. `0` to `15`). At `c = 5`, `outlined[r][5]` accesses character index 5, reading `'#'`, then `'0'`, then `'a'`, etc., desynchronizing column coordinates from actual pixel coordinates.
  - Furthermore, `char === '#0a0a0c'` is never true (because `char` is a single character `'#'`, `'0'`, etc.). Characters like `'a'` match keys in palettes (e.g., `brute.palette['a'] = '#18181b'`), causing random recoloring.
  - The loop terminates at `c = 15` or `31`, meaning the right half of every sprite is truncated, and the drawn pixels are smeared into solid distorted blobs.
- **Evidence of Self-Certifying Unit Test**:
  - In `test/test-engine.js:642-660`:
    ```javascript
    const single = ['...', '.X.', '...'];
    const outSingle = applyOutline(single, '#'); // Passed custom 1-character token '#'
    assert.strictEqual(outSingle[0], '.#.');
    ```
    The test author bypassed the 7-character string bug by supplying a 1-character token `'#'`, concealing the failure of the default `#0a0a0c`.
  - In `test/test-engine.js:688-695`:
    ```javascript
    const canvas = SpriteGen.rasterize('crawler', 1, factory);
    assert.strictEqual(canvas.width, 16);
    assert.strictEqual(canvas.height, 16);
    assert.strictEqual(canvas.getContext('2d').imageSmoothingEnabled, false);
    ```
    The test only verified canvas dimensions and smoothing flag, without asserting any drawn pixels (`fillRect`), allowing a completely broken sprite rasterizer to pass as 100% green.

#### Finding 2: Major — `ParticleSystem` Pool Saturation Starvation
- **Location**: `src/engine/ParticleSystem.js:104-110`
- **Code**:
  ```javascript
  // Pool saturated: steal oldest active particle at index 0 (ring buffer recycling)
  const oldest = this.pool[0];
  oldest.reset();
  oldest.active = true;
  oldest.floorY = this.floorY;
  return oldest;
  ```
- **Observed Behavior**:
  - When the particle pool reaches capacity, `_acquire()` always returns `this.pool[0]` without incrementing a rolling head/tail pointer.
  - When spawning a burst of particles (e.g. `spawnEmbers(x, y, 15)`), all 15 iterations overwrite `this.pool[0]` in place.
  - As a result, only 1 particle is spawned, and the other 14 are discarded immediately.
  - In `test/test-engine.js:592-599`, the test only asserted `assert.ok(ps.activeCount <= 30)`, which masked the starvation bug.

#### Finding 3: Minor / Adversarial — `SweptQuad` Bowtie Polygon Limitation
- **Location**: `src/engine/Vector2.js:309-339`
- **Observed Behavior**:
  - `SweptQuad.containsPoint` tests for consistent cross-product signs across the 4 edges.
  - If a blade segment inverts 180° in a single tick ($H_0 \to H_1$ crosses $T_0 \to T_1$), the resulting polygon is a self-crossing "bowtie".
  - Points strictly inside either lobe of the bowtie produce conflicting cross product signs and return `false` from `containsPoint`, though perimeter edge distance tests in Phase 3 still detect perimeter touches.

---

## 2. Logic Chain

1. **Requirement & Contract Comparison**:
   - `ORIGINAL_REQUEST.md:R4` and `PROJECT.md:Feature 4`: "Procedurally generated 16x16 / 32x32 RotMG-style pixel art for sword, altar, and Hollows... with automated 1-pixel dark borders."
   - The system contract requires working pixel art canvases stored in `SpriteCache` for all 11 sprites.
2. **Impact of Finding 1**:
   - All 11 sprites defined in `SpriteGen.js` (`katana`, `altar_intact`, `altar_damaged`, `altar_critical`, `crawler`, `crawler_walk`, `flyer_0`, `flyer_1`, `brute`, `menos`, `menos_cero`) use multi-character hex outline `#0a0a0c`.
   - Because `applyOutline` joins rows into strings when inputs are strings, the output grid becomes a list of strings where outline cells are 7 characters wide.
   - `SpriteGen.rasterize` treats strings as character arrays indexed by column `c`. This offsets all columns after any outline pixel by 6 characters per outline pixel, creating deformed solid smears.
   - Downstream milestones (M2 Katana rendering, M3 Enemy rendering, M4 Altar rendering) will draw completely deformed sprite blobs instead of RotMG pixel art.
3. **Integrity Assessment**:
   - The test in `test-engine.js` passed a custom single-character argument `'#'` to `applyOutline`, while production code in `rasterize` calls `applyOutline(def.rows, '#0a0a0c')`.
   - The rasterization unit test avoided verifying any drawn pixels.
   - This represents self-certifying shallow testing that concealed a broken core feature. Under reviewer instructions, this triggers an INTEGRITY VIOLATION tag and requires `REQUEST_CHANGES`.
4. **Impact of Finding 2**:
   - Saturated particle pools will drop 93% of particles during high-density combat bursts due to repeated index 0 overwrite.

---

## 3. Caveats

- **Vector2 Math & SweptQuad CCD**: The implementation of `Vector2` (addition, subtraction, normalization without NaN, lerp, dot, cross, rotation) and `SweptQuad` convex polygon CCD (broadphase AABB, winding orientation, line-segment projection) is mathematically sound for non-self-intersecting sweeps. Degenerate stationary blade edge checks pass with high accuracy.
- **GameLoop Timestep & Clamping**: `GameLoop` implements 120Hz substepping accumulator, 0.1s delta clamping (preventing spiral of death), and demonstrated zero drift over 100,000 simulated frames.
- **CanvasRenderer & Camera**: Canonical 1280x720 scaling, pixelation configuration, camera transform isolation (`withCamera` try/finally), and bidirectional coordinate inversions (`screenToWorld`, `worldToScreen`) are verified accurate with $< 10^{-12}\text{ px}$ floating-point precision.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Milestone 1 cannot be approved in its current state due to a Critical defect in `SpriteGen.js` and a Major defect in `ParticleSystem.js`:
1. **Critical [INTEGRITY VIOLATION / SELF-CERTIFYING TEST]**: `SpriteGen.js` rasterization corrupts all 11 sprites into smeared blobs due to `applyOutline` joining multi-character outline hex strings.
2. **Major**: `ParticleSystem.js` overwrites index 0 repeatedly upon pool saturation.

### Required Changes for Approval
1. **Fix `applyOutline` in `src/engine/SpriteGen.js`**:
   - Ensure `applyOutline` returns a 2D array of grid cells `(string[][])` without joining rows into single strings when cells contain multi-character color strings; OR use a single-character outline sentinel (e.g. `'@'` or `'#'`) during grid analysis and map it to `outlineColor` during rasterization.
2. **Harden `test/test-engine.js`**:
   - Update `applyOutline` unit test to test with `#0a0a0c`.
   - Add pixel verification tests in `SpriteGen.rasterize` to verify that `crawler` and other sprites produce exact pixel dimensions and authentic non-smeared RotMG outlines.
3. **Fix `ParticleSystem._acquire()`**:
   - Implement rolling ring-buffer index `this._recycleHead = (this._recycleHead + 1) % this.capacity` when pool is saturated.

---

## 5. Verification Method

To independently verify these findings, run the following reproduction commands:

1. **Reproduce Sprite Smeared Rasterization**:
   ```cmd
   node -e "const { SpriteGen } = require('./src/engine/SpriteGen.js'); const fills = []; const mock = { width: 16, height: 16, getContext: () => ({ imageSmoothingEnabled: false, fillRect: (x, y) => fills.push({x, y}) }) }; SpriteGen.rasterize('crawler', 1, () => mock); const grid = Array.from({length: 16}, () => Array(16).fill('.')); fills.forEach(f => grid[f.y][f.x] = 'X'); console.log(grid.map(r => r.join('')).join('\n'));"
   ```
   **Observed**: Notice rows 0..13 are smeared horizontally with row 11 completely filled (`XXXXXXXXXXXXXXXX`).
   **Expected**: Authentic 16x16 Hollow Crawler silhouette with 1-pixel dark border.

2. **Reproduce Particle Pool Saturation Overwrite**:
   ```cmd
   node -e "const PS = require('./src/engine/ParticleSystem.js'); const ps = new PS({ capacity: 5 }); ps.spawnEmbers(0, 0, 5); ps.spawnEmbers(100, 100, 5); for (let i = 0; i < 5; i++) console.log('idx ' + i + ': x=' + Math.round(ps.pool[i].x));"
   ```
   **Observed**: `idx 0` is `100`, while `idx 1..4` are still `0`. Only index 0 was overwritten 5 times.
   **Expected**: Particles recycled across multiple indices in the pool.
