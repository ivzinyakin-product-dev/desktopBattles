const fs = require('fs');
const assert = require('assert');

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

// Intercept require
const Module = require('module');
const origRequire = Module.prototype.require;
Module.prototype.require = function(path) {
  if (path.includes('SpriteGen')) {
    const m = { exports: {} };
    const f = new Function('module', 'exports', 'require', '__dirname', '__filename', code);
    f(m, m.exports, origRequire.bind(this), __dirname, __filename);
    return m.exports;
  }
  return origRequire.apply(this, arguments);
};

require('../challenger_m1_2/stress_sprites_fx.js');

console.log('--- RUNNING TEST/TEST-ENGINE.JS WITH PATCH ---');
require('../../test/test-engine.js');

console.log('--- RUNNING TEST/TEST-E2E.JS WITH PATCH ---');
require('../../test/test-e2e.js');
