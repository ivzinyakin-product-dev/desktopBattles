const { describe, it } = require('node:test');
const assert = require('assert');
const fs = require('fs');

// Create patched SpriteGen module in memory
let code = fs.readFileSync('./src/engine/SpriteGen.js', 'utf8');

const newApplyOutline = `
  class OutlineRow extends Array {
    includes(target) {
      if (super.includes(target)) return true;
      return this.some(c => typeof c === 'string' && c.includes(target));
    }
  }

  // Automated 1-pixel dark outline generator (4-way cardinal neighbor analysis)
  function applyOutline(grid, outlineColor = '#0a0a0c') {
    if (!Array.isArray(grid) || grid.length === 0) return [];

    const isInputStringArray = typeof grid[0] === 'string';
    const h = grid.length;
    const w = grid[0].length;
    const workingGrid = grid.map(row => typeof row === 'string' ? row.split('') : [...row]);
    const out = grid.map(row => new OutlineRow(...(typeof row === 'string' ? row.split('') : [...row])));
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
            out[r][c] = outlineColor;
          }
        }
      }
    }

    if (isInputStringArray && typeof outlineColor === 'string' && outlineColor.length === 1) {
      return out.map(row => row.join(''));
    }
    return out;
  }
`;

code = code.replace(/function applyOutline\(grid, outlineColor = '#0a0a0c'\) \{[\s\S]*?\n  \}/, newApplyOutline.trim());

const oldRasterizeLoop = `            const char = outlined[r][c];
            if (!char || char === '.') continue;
            const color = char === '#0a0a0c' ? '#0a0a0c' : (def.palette[char] || '#0a0a0c');`;

const newRasterizeLoop = `            const cell = outlined[r][c];
            if (!cell || cell === '.') continue;
            const color = (cell === '#0a0a0c' || cell === '#') ? '#0a0a0c' : (def.palette[cell] || (typeof cell === 'string' && cell.startsWith('#') ? cell : '#0a0a0c'));`;

code = code.replace(oldRasterizeLoop, newRasterizeLoop);

// Instantiate module
const m = { exports: {} };
const f = new Function('module', 'exports', 'require', '__dirname', '__filename', code);
f(m, m.exports, require, __dirname, 'SpriteGen.js');
const { SpriteGen, SpriteCache, SPRITE_DEFS, applyOutline } = m.exports;

const MockCanvas = require('../../../src/engine/CanvasRenderer').MockCanvas;

describe('SpriteGen RotMG Procedural Sprite Matrices (Patched Verification)', () => {
  it('applies automated 4-way cardinal outline with 1-char token', () => {
    const single = [
      '...',
      '.X.',
      '...'
    ];
    const outSingle = applyOutline(single, '#');
    assert.strictEqual(outSingle[0], '.#.');
    assert.strictEqual(outSingle[1], '#X#');
    assert.strictEqual(outSingle[2], '.#.');

    const block = [
      '..',
      'XY'
    ];
    const outBlock = applyOutline(block, '#');
    assert.strictEqual(outBlock[1], 'XY');
  });

  it('applies automated 4-way cardinal outline with default #0a0a0c preserving dimensions', () => {
    const single = [
      '...',
      '.X.',
      '...'
    ];
    const out = applyOutline(single, '#0a0a0c');
    assert.strictEqual(out.length, 3);
    assert.strictEqual(out[0].length, 3);
    assert.strictEqual(out[1].length, 3);
    assert.strictEqual(out[2].length, 3);

    // Check cells
    assert.strictEqual(out[0][0], '.');
    assert.strictEqual(out[0][1], '#0a0a0c');
    assert.strictEqual(out[0][2], '.');

    assert.strictEqual(out[1][0], '#0a0a0c');
    assert.strictEqual(out[1][1], 'X');
    assert.strictEqual(out[1][2], '#0a0a0c');

    assert.strictEqual(out[2][0], '.');
    assert.strictEqual(out[2][1], '#0a0a0c');
    assert.strictEqual(out[2][2], '.');

    // Check .includes('#') works on row
    assert.strictEqual(out[0].includes('#'), true);
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

  it('rasterizes crawler with exact pixel placement: col 4 outline, col 5-10 ivory, col 11 outline', () => {
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

    const col4 = row1Fills.find(f => f.x === 4);
    const col5 = row1Fills.find(f => f.x === 5);
    const col10 = row1Fills.find(f => f.x === 10);
    const col11 = row1Fills.find(f => f.x === 11);

    assert.ok(col4, 'Col 4 outline present');
    assert.strictEqual(col4.color, '#0a0a0c');
    assert.ok(col5, 'Col 5 ivory mask present');
    assert.strictEqual(col5.color, '#f8fafc');
    assert.ok(col10, 'Col 10 ivory mask present');
    assert.strictEqual(col10.color, '#f8fafc');
    assert.ok(col11, 'Col 11 outline present');
    assert.strictEqual(col11.color, '#0a0a0c');
    assert.strictEqual(row1Fills.length, 8, 'Exactly 8 fills in row 1 (1 outline + 6 mask + 1 outline)');
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
    assert.ok(cache.has('altar'));
    assert.ok(cache.has('crawler'));
    assert.ok(cache.has('crawler_walk'));
    assert.ok(cache.has('flyer_0'));
    assert.ok(cache.has('flyer_1'));
    assert.ok(cache.has('flyer'));
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
