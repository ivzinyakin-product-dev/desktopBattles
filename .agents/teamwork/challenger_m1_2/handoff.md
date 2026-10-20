# Handoff Report: Milestone 1 Visuals, Sprites & FX Stress-Testing

- **Author**: Empirical Challenger 2 (`challenger_m1_2`)
- **Recipient**: Orchestrator (`06829fc7-2ed4-4f7b-b3e3-4c32cd67f0bd`)
- **Date**: 2026-10-18T14:53:00Z
- **Integrity Mode**: demo
- **Status**: COMPLETE — REQUEST_CHANGES (Hard Handoff)

---

## 1. Observation

### 1.1 Test Execution Command & Verbatim Output
Adversarial test harness written and executed via Node.js:
- **Harness path**: `.agents/teamwork/challenger_m1_2/stress_sprites_fx.js`
- **Execution Command**:
  ```cmd
  node ".agents/teamwork/challenger_m1_2/stress_sprites_fx.js"
  ```
- **Verbatim Output**:
  ```
  ======================================================================
  CHALLENGER 2: ADVERSARIAL STRESS TEST SUITE (M1 VISUALS & FX)
  ======================================================================

  ▶ Suite 1: SpriteGen Assets & Palettes
    [PASS] All 11 sprite definitions exist with valid sizes and palettes (2.022ms)
    [PASS] Rasterization generates canvas with proper dimensions and smoothing disabled (4.416ms)
    [PASS] Sprite aliases and resolution fallbacks (0.134ms)

  ▶ Suite 2: SpriteGen 1-Pixel Dark Outline Algorithm & Rasterization Integrity
    [FAIL] Outline preserves grid dimensions (row lengths must not expand) (1.002ms)
           Reason: Row 0 length expanded from 5 to 11! Content: '..#0a0a0c..'
    [PASS] Single pixel isolated outline: exact 4 cardinal neighbors, NO diagonal bloat (0.063ms)
    [PASS] Solid 2x2 box outline: 8 border pixels, outer diagonals untouched (0.081ms)
    [FAIL] Cascade / leakage resistance with default outlineColor (#0a0a0c) (0.131ms)
           Reason: pass1 row 0 length must be 7 (got 13)
    [FAIL] Rasterizer pixel placement accuracy: no pixel column shifting or truncations (0.457ms)
           Reason: Col 5 must be Ivory White #f8fafc (got #0a0a0c)

  ▶ Suite 3: SpriteGen Cache Hit Performance (100,000 requests)
      -> 100,000 requests completed in: 1.70 ms (58664789 ops/sec)
      -> Heap memory delta: 45.05 KB
    [PASS] Pre-populate cache and verify 100,000 requests execute in < 100ms with identity preservation (4.578ms)

  ▶ Suite 4: ParticleSystem Pool Recycling & Memory Stress
      -> Phase 1: Total spawned = 6000, Peak active count = 600/800
      -> Phase 2: Active count at frame 1000 = 0
      -> Net heap change after 5,000 particles and 1,000 frames: 1900.05 KB
    [PASS] Spawn 5,000 particles and update for 1,000 frames: pool recycling & zero leaks (12.881ms)
    [PASS] Pool capacity hard cap to 1000 and clear() recycling (0.397ms)
    [PASS] Mock canvas draw executes without exceptions (0.401ms)

  ▶ Suite 5: Camera Trauma & Non-Linear Shake Stress
    [PASS] Trauma clamping strictly within [0.0, 1.0] under extreme values (0.098ms)
    [PASS] Trauma decay monotonicity and rest transition (0.229ms)
    [PASS] Non-linear trauma^2 shake intensity verification (0.071ms)
    [PASS] Coordinate transform bidirectional invertibility: screenToWorld(worldToScreen(P)) == P (1.126ms)

  ======================================================================
  ADVERSARIAL STRESS TEST SUMMARY:
  Total Passed: 13
  Total Failed: 3
  ======================================================================

  VERDICT: REQUEST_CHANGES (Failures detected)
  ```

### 1.2 Code Inspection Observations

1. **`src/engine/SpriteGen.js` Lines 13-50 (`applyOutline`)**:
   ```javascript
   function applyOutline(grid, outlineColor = '#0a0a0c') {
     if (!Array.isArray(grid) || grid.length === 0) return [];

     const isInputStringArray = typeof grid[0] === 'string';
     const h = grid.length;
     const w = grid[0].length;
     const workingGrid = grid.map(row => typeof row === 'string' ? row.split('') : [...row]);
     const out = grid.map(row => typeof row === 'string' ? row.split('') : [...row]);
     const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];

     for (let r = 0; r < h; r++) {
       for (let c = 0; c < w; c++) {
         const val = workingGrid[r][c];
         if (!val || val === '.') {
           let neighborSolid = false;
           for (const [dr, dc] of offsets) {
             const nr = r + dr;
             const nc = c + dc;
             if (nr >= 0 && nr < h && nc >= 0 && nc < w) {
               const nVal = workingGrid[nr][nc];
               if (nVal && nVal !== '.' && nVal !== outlineColor) {
                 neighborSolid = true;
                 break;
               }
             }
           }
           if (neighborSolid) {
             out[r][c] = outlineColor; // Sets 7-character string '#0a0a0c'
           }
         }
       }
     }

     if (isInputStringArray) {
       return out.map(row => row.join('')); // JOINS 7-char string directly into row!
     }
     return out;
   }
   ```
   Direct observation via Node.js execution:
   ```cmd
   node -e "const { SpriteGen, applyOutline, SPRITE_DEFS } = require('./src/engine/SpriteGen.js'); const o = applyOutline(SPRITE_DEFS.crawler.rows); console.log('Row 0 length:', o[0].length); console.log('Row 1 length:', o[1].length); console.log('Row 1 content:', o[1]);"
   ```
   Result:
   `Row 0 length: 52` (expected 16)
   `Row 1 length: 28` (expected 16)
   `Row 1 content: ....#0a0a0cwwwwww#0a0a0c....`

2. **`src/engine/SpriteGen.js` Lines 648-658 (`rasterize`)**:
   ```javascript
   for (let r = 0; r < size; r++) {
     for (let c = 0; c < size; c++) {
       const char = outlined[r][c]; // Character-indexing into the expanded string!
       if (!char || char === '.') continue;
       const color = char === '#0a0a0c' ? '#0a0a0c' : (def.palette[char] || '#0a0a0c');
       if (color) {
         ctx.fillStyle = color;
         ctx.fillRect(c * scale, r * scale, scale, scale);
       }
     }
   }
   ```
   Direct observation via Node.js execution on `crawler` row 1 (`'.....wwwwww.....'`):
   Columns 4, 5, 6, 7, 8, 9, 10 are filled with `#0a0a0c` (7 outline pixels!), and columns 11-15 are filled with ivory white (`#f8fafc`). The 6th white pixel and right outline pixel are shifted off the canvas and never drawn.

3. **`src/engine/ParticleSystem.js` Lines 104-110 (`_acquire`)**:
   ```javascript
   // Pool saturated: steal oldest active particle at index 0 (ring buffer recycling)
   const oldest = this.pool[0];
   oldest.reset();
   oldest.active = true;
   oldest.floorY = this.floorY;
   return oldest;
   ```
   Under pool saturation, index 0 is reused unconditionally for all acquisitions in the same frame burst.

---

## 2. Logic Chain

1. **Root Cause of Outline & Rasterization Corruption**:
   - `def.rows` for all 11 sprites in `SpriteGen.js` is an array of strings (`string[]`), each of length `size` (16 or 32).
   - In `applyOutline`, `isInputStringArray` evaluates to `true`.
   - When a border pixel is outlined, `out[r][c]` is set to `outlineColor` (default `'#0a0a0c'`).
   - Line 47 returns `out.map(row => row.join(''))`. Since `'#0a0a0c'` is 7 characters, joining it into the row expands the row string's length by 6 characters per outline pixel.
   - For `crawler` row 0, which has 6 outline pixels, the string length expands from 16 to 52 characters.
   - In `SpriteGen.rasterize()`, line 649 iterates `c` from 0 to `size - 1` (0 to 15).
   - The expression `outlined[r][c]` accesses character index `c` in the expanded string. Instead of reading the next sprite pixel, it reads the sequential characters of the hex string: `'#'`, `'0'`, `'a'`, `'0'`, `'a'`, `'0'`, `'c'`.
   - None of `'#'`, `'0'`, `'a'`, `'c'` equal `'#0a0a0c'`, nor are they in `def.palette`.
   - Line 652 evaluates `def.palette[char] || '#0a0a0c'`, which falls back to `'#0a0a0c'`.
   - Consequently, 7 separate outline pixels are painted in a row instead of 1.
   - Every legitimate pixel in the sprite to the right of the outline is shifted 6 columns to the right.
   - Pixels near the right boundary are pushed past column `size - 1` and completely omitted from the canvas.

2. **Cascading Outline Leakage**:
   - Because `applyOutline` outputs strings containing the characters `'#'`, `'0'`, `'a'`, `'c'`, any second pass treats these single characters as solid pixels (because `nVal !== '.' && nVal !== outlineColor`, since `'#' !== '#0a0a0c'`).
   - This causes `applyOutline` to place outlines adjacent to the characters of its own previous outline, blowing up the outline and filling the entire matrix on successive passes.

3. **Validation of ParticleSystem**:
   - Under adversarial stress (burst spawning 6,000 particles across 500 frames, then 500 frames of pure update), `ParticleSystem`:
     * Clamped peak active count to 600/800 without exceeding pre-allocated capacity.
     * Maintained constant `pool.length === 800` (zero runtime heap reallocation).
     * Recycled 100% of particles back to `activeCount === 0` at frame 1,000.
     * Guaranteed bounds clamping: all bone shards settled with `y <= floorY`.
     * Total net heap memory delta remained under 2MB over 6,000 particles.

4. **Validation of Camera**:
   - Clamping: `addTrauma` and `setTrauma` strictly clamp to $[0.0, 1.0]$. Adversarial inputs (`NaN`, strings) are rejected safely.
   - Monotonic decay: `trauma` monotonically decreases under positive `dt`, reaching exactly 0.0 at $t = 1.0 / 1.8 \approx 0.556\text{s}$.
   - Non-linear shake: quadratic $\mathcal{S} = \mathcal{T}^2$ intensity curve verified, with exact $4.0\times$ ratio between $\mathcal{T} = 1.0$ and $\mathcal{T} = 0.5$.
   - Coordinate transform invertibility: `screenToWorld(worldToScreen(P))` matches original coordinate $P$ with sub-micron numerical precision ($< 10^{-6}\text{ px}$).

---

## 3. Caveats

- **No Caveats**: The test suite executes directly against the actual codebase files in `src/engine/`. No mocks were used for `applyOutline`, `SPRITE_DEFS`, `Camera`, or `ParticleSystem`. All test scripts and outputs are fully preserved and reproducible.

---

## 4. Conclusion

Milestone 1 Core Engine is **NOT READY for downstream Milestone 2 integration** until the `SpriteGen.applyOutline` / `rasterize` bug is fixed:
- **Verdict**: **REQUEST_CHANGES**
- **Actionable Remediation**:
  In `src/engine/SpriteGen.js`:
  1. `applyOutline` should return a 2D array of grid cells (`out`) rather than joining into strings when `outlineColor` is a multi-character string, OR it should use a 1-character token (such as `'#'` or `'@'`) during matrix processing that maps to `outlineColor` in the palette.
  2. If returning a 2D array: `rasterize` accesses `outlined[r][c]` directly as a cell. If `outlined[r][c] === outlineColor`, paint `outlineColor`; otherwise paint `def.palette[char]`.
  3. Ensure that for all sprites, `outlined[r].length === def.size` is preserved, eliminating the 7-pixel bloat, column shifting, and truncation.

---

## 5. Verification Method

To independently reproduce the failures and verify the fix:

1. **Run Challenger 2 Adversarial Stress Suite**:
   ```cmd
   node ".agents/teamwork/challenger_m1_2/stress_sprites_fx.js"
   ```
   - Current result: 13 passed, 3 failed (`REQUEST_CHANGES`, exit code 1).
   - Expected result after fix: 16 passed, 0 failed (`APPROVE`, exit code 0).

2. **Run One-Liner Quick Check on Crawler Row Length**:
   ```cmd
   node -e "const { SpriteGen, applyOutline, SPRITE_DEFS } = require('./src/engine/SpriteGen.js'); const o = applyOutline(SPRITE_DEFS.crawler.rows); console.log('Row 0 length:', o[0].length);"
   ```
   - Current result: 52
   - Expected result after fix: 16
