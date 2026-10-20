/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/engine/SpriteGen.js
 * 
 * Procedural RotMG pixel art generator, automated 1-pixel dark outline engine,
 * and SpriteCache registry for Tensa Zangetsu: Soul Altar Defense.
 * Zero external dependencies. Browser & Node.js compatible.
 */
(function (global) {
  'use strict';

  // Automated 1-pixel dark outline generator (4-way cardinal neighbor analysis)
  // OutlineRow array subclass preserving row.includes() compatibility
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

  // Sprite Definitions & Matrices (16x16 and 32x32)
  const SPRITE_DEFS = {
    // 1. Tensa Zangetsu Katana (32x32)
    katana: {
      size: 32,
      palette: {
        '.': null,
        'k': '#0a0a0f',
        's': '#e2e8f0',
        'r': '#ff0033',
        'g': '#94a3b8',
        'h': '#18181b',
        'c': '#cbd5e1'
      },
      rows: [
        '................................',
        '................................',
        '................................',
        '..........................ss....',
        '.........................ssk....',
        '........................skk.....',
        '.......................skk......',
        '......................skk.......',
        '.....................skk........',
        '....................skk.........',
        '...................skk..........',
        '..................skkr..........',
        '.................skk............',
        '................skkr............',
        '...............skk..............',
        '..............skk...............',
        '.............skkr...............',
        '............skk.................',
        '...........skk..................',
        '..........ssgg..................',
        '.........ggsgg..................',
        '........gggggg..................',
        '.......hhgggg...................',
        '......hh.hh.....................',
        '.....hh..hh.....................',
        '....cc..........................',
        '...cc...........................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................'
      ]
    },

    // 2. Soul Altar - Intact State (32x32)
    altar_intact: {
      size: 32,
      palette: {
        '.': null,
        'b': '#1e293b',
        'f': '#334155',
        'm': '#475569',
        's': '#64748b',
        'c': '#06b6d4',
        'e': '#22d3ee',
        'w': '#ffffff'
      },
      rows: [
        '................................',
        '................................',
        '................................',
        '............cccccccc............',
        '..........ccbbbbbbbbcc..........',
        '.........cbbbeeeeeebbbc.........',
        '........cbbeewwwweebbc..........',
        '........cbbeewwwweebbc..........',
        '..ssss..cbbeewwwweebbc..ssss....',
        '..s..s...cbbbeeeeeebbbc...s..s..',
        '..s..s....ccbbbbbbbbcc....s..s..',
        '..s..s......cccccccc......s..s..',
        '..s..s....................s..s..',
        '..s..s.......ffffff.......s..s..',
        '..s..s......fmmmmff.......s..s..',
        '..s..s.....fmmmmmmff......s..s..',
        '..ssss....fmmmmmmmmff.....ssss..',
        '..bbbb...fmmmmmmmmmmff....bbbb..',
        '..bbbb..fmmmmmmmmmmmmff...bbbb..',
        '.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.',
        '.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.',
        '..bbbbbbbbbbbbbbbbbbbbbbbbbbbb..',
        '...bbbbbbbbbbbbbbbbbbbbbbbbbb...',
        '....bbbbbbbbbbbbbbbbbbbbbbbb....',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................'
      ]
    },

    // 3. Soul Altar - Damaged State (32x32)
    altar_damaged: {
      size: 32,
      palette: {
        '.': null,
        'b': '#1e293b',
        'f': '#334155',
        'm': '#475569',
        's': '#64748b',
        'c': '#06b6d4',
        'e': '#22d3ee',
        'w': '#ffffff',
        'r': '#ef4444'
      },
      rows: [
        '................................',
        '................................',
        '................................',
        '............cccccccc............',
        '..........ccbbbbbbbbcc..........',
        '.........cbbbeeeeeebbbc.........',
        '........cbbeewwwweebbc..........',
        '........cbbeewwwweebbc..........',
        '..ssss..cbbeewwwweebbc..........',
        '..s..s...cbbbeeeeeebbbc...s..s..',
        '..s..s....ccbbbbbbbbcc....s..s..',
        '..s..s......cccccccc......s..s..',
        '..s..s.......r..r.........s..s..',
        '..s..s.......ffffff.......s..s..',
        '..s..s......fmmmmff.......s..s..',
        '..s..s.....fmm.mmmff......s..s..',
        '..ssss....fmmm.mmmmff.....ssss..',
        '..bbbb...fmmmm.mmmmmff....bbbb..',
        '..bbbb..fmmmmm.mmmmmmff...bbbb..',
        '.bbbbbbbbbbbbb.bbbbbbbbbbbbbbbb.',
        '.bbbbbbbbbbbb..bbbbbbbbbbbbbbbb.',
        '..bbbbbbbbbbb.bbbbbbbbbbbbbbbb..',
        '...bbbbbbbbbb..bbbbbbbbbbbbbb...',
        '....bbbbbbbbb.bbbbbbbbbbbbbb....',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................'
      ]
    },

    // 4. Soul Altar - Critical State (32x32)
    altar_critical: {
      size: 32,
      palette: {
        '.': null,
        'b': '#1e293b',
        'f': '#334155',
        'm': '#475569',
        's': '#64748b',
        'c': '#06b6d4',
        'e': '#22d3ee',
        'w': '#ffffff',
        'r': '#ef4444'
      },
      rows: [
        '................................',
        '................................',
        '................................',
        '............cc.r.ccc............',
        '..........ccbb.r.bbbcc..........',
        '.........cbbbe...eeebbc.........',
        '........cbbeew...weebbc.........',
        '........cbbeew...weebbc.........',
        '........cbbeew...weebbc.........',
        '.........cbbbe...eeebbc...s..s..',
        '..s..s....ccbb.r.bbbcc....s..s..',
        '..s..s......cc.r.ccc......s..s..',
        '..s..s.......r...r........s..s..',
        '..s..s.......ff.fff.......s..s..',
        '..s..s......fmm.mff.......s..s..',
        '..s..s.....fmm...mmmff....s..s..',
        '..ssss....fmmm...mmmmff...ssss..',
        '..bbbb...fmmmm...mmmmmff..bbbb..',
        '..bbbb..fmmmmm...mmmmmmff.bbbb..',
        '.bbbbbbbbbbbbb...bbbbbbbbbbbbbb.',
        '.bbbbbbbbbbbb....bbbbbbbbbbbbbb.',
        '..bbbbbbbbbbb...bbbbbbbbbbbbbb..',
        '...bbbbbbbbbb....bbbbbbbbbbbb...',
        '....bbbbbbbbb...bbbbbbbbbbbb....',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................'
      ]
    },

    // 5. Hollow Crawler - Idle / Stand (16x16)
    crawler: {
      size: 16,
      palette: {
        '.': null,
        'w': '#f8fafc',
        's': '#cbd5e1',
        'e': '#09090b',
        'b': '#3b0764',
        'p': '#581c87',
        'l': '#2e1065'
      },
      rows: [
        '................',
        '.....wwwwww.....',
        '....wwwwwwww....',
        '....ws.ww.sw....',
        '....we.ww.ew....',
        '....wwwwwwww....',
        '.....wwbbww.....',
        '....pbbbbbbp....',
        '....bbbbbbbb....',
        '...lbbbbbbbbl...',
        '..l.lbb..bbl.l..',
        '.l..l......l..l.',
        '....l......l....',
        '................',
        '................',
        '................'
      ]
    },

    // 6. Hollow Crawler - Walk Frame (16x16)
    crawler_walk: {
      size: 16,
      palette: {
        '.': null,
        'w': '#f8fafc',
        's': '#cbd5e1',
        'e': '#09090b',
        'b': '#3b0764',
        'p': '#581c87',
        'l': '#2e1065'
      },
      rows: [
        '................',
        '.....wwwwww.....',
        '....wwwwwwww....',
        '....ws.ww.sw....',
        '....we.ww.ew....',
        '....wwwwwwww....',
        '.....wwbbww.....',
        '....pbbbbbbp....',
        '....bbbbbbbb....',
        '...lbbbbbbbb....',
        '..l.lbb..bbl....',
        '....l......l.l..',
        '...l........l.l.',
        '................',
        '................',
        '................'
      ]
    },

    // 7. Hollow Flyer - Frame 0 Wings Up (16x16)
    flyer_0: {
      size: 16,
      palette: {
        '.': null,
        'w': '#f8fafc',
        's': '#cbd5e1',
        'r': '#ff0033',
        'd': '#881337',
        'm': '#be123c',
        'l': '#f43f5e',
        't': '#4c1d95'
      },
      rows: [
        'l..............l',
        'ml............lm',
        'dml..........lmd',
        '.dml........lmd.',
        '..dm...ww...md..',
        '...d..wwww..d...',
        '.....w.rr.w.....',
        '.....wssssw.....',
        '......wwww......',
        '.......ss.......',
        '.......tt.......',
        '.......tt.......',
        '........t.......',
        '................',
        '................',
        '................'
      ]
    },

    // 8. Hollow Flyer - Frame 1 Wings Down (16x16)
    flyer_1: {
      size: 16,
      palette: {
        '.': null,
        'w': '#f8fafc',
        's': '#cbd5e1',
        'r': '#ff0033',
        'd': '#881337',
        'm': '#be123c',
        'l': '#f43f5e',
        't': '#4c1d95'
      },
      rows: [
        '................',
        '................',
        '.......ww.......',
        '......wwww......',
        '.....w.rr.w.....',
        'dml..wssssw..lmd',
        'ldm...wwww...mdl',
        '.ldm...ss...mdl.',
        '..ld........dl..',
        '.......tt.......',
        '.......tt.......',
        '........t.......',
        '................',
        '................',
        '................',
        '................'
      ]
    },

    // 9. Armored Brute (32x32)
    brute: {
      size: 32,
      palette: {
        '.': null,
        'y': '#fef3c7',
        'h': '#f59e0b',
        'w': '#f8fafc',
        's': '#cbd5e1',
        'e': '#09090b',
        'j': '#e2e8f0',
        'a': '#18181b',
        'p': '#27272a',
        'r': '#ff0033'
      },
      rows: [
        '................................',
        '..yy........................yy..',
        '..hyy......................yyh..',
        '...hyy....................yyh...',
        '....hyy..................yyh....',
        '.....hyy...wwwwwwwwww...yyh.....',
        '......hy..wwwwwwwwwwww..yh......',
        '.......y.wwwsswwwwsswww.y.......',
        '........wwwwsswwwwsswwww........',
        '........wwweeewwwweeewww........',
        '........wwwwwwwwwwwwwwww........',
        '..aaaa...wwwwjjjjjjwwww...aaaa..',
        '.apppaa...wwwwwwwwwwww...aapppa.',
        '.appppa....wwwwwwwwww....appppa.',
        '.appppaa....aappppaa....aappppa.',
        '.aapppaa...aappppppaa...aapppaa.',
        '..aaaaa....appprrpppa....aaaaa..',
        '...........apprrrrppa...........',
        '...........apprrrrppa...........',
        '...........appprrpppa...........',
        '...........aappppppaa...........',
        '............aaaaaaaa............',
        '..........hhhh....hhhh..........',
        '.........hhhhh....hhhhh.........',
        '.........hhhh......hhhh.........',
        '.........hhhh......hhhh.........',
        '........hhhhh......hhhhh........',
        '........hhhh........hhhh........',
        '........aaaa........aaaa........',
        '................................',
        '................................',
        '................................'
      ]
    },

    // 10. Menos Grande Gillian Boss - Normal (32x32)
    menos: {
      size: 32,
      palette: {
        '.': null,
        'k': '#09090b',
        'd': '#18181b',
        'w': '#f1f5f9',
        's': '#cbd5e1',
        'r': '#ef4444'
      },
      rows: [
        '................................',
        '................................',
        '............kkkkkkkk............',
        '...........kwwwwwwwwk...........',
        '..........kwwwwwwwwwwk..........',
        '..........kwwrwwwwrwwk..........',
        '..........kwwwwwwwwwwk..........',
        '..........kwwwsssswwwk..........',
        '...........kwwwwwwwwk...........',
        '............kwwwwwwk............',
        '............kwwwwwwk............',
        '.............kwwwwk.............',
        '.............kwwwwk.............',
        '............kkkwwkkk............',
        '...........kkk.ww.kkk...........',
        '..........kkkkk..kkkkk..........',
        '.........kkkkkk..kkkkkk.........',
        '........kkkkkkk..kkkkkkk........',
        '.......kkkkkkk....kkkkkkk.......',
        '......kkkkkkk......kkkkkkk......',
        '.....kkkkkkkd......dkkkkkkk.....',
        '....kkkkkkkdd......ddkkkkkkk....',
        '...kkkkkkkdd........ddkkkkkkk...',
        '..kkkkkkkdd..........ddkkkkkkk..',
        '.kkkkkkkdd............ddkkkkkkk.',
        '.kkkkkkdd..............ddkkkkkk.',
        '.kkkkkdd................ddkkkkk.',
        '.kkkkdd..................ddkkkk.',
        '.kkkdd....................ddkkk.',
        '.kkdd......................ddkk.',
        '................................',
        '................................'
      ]
    },

    // 11. Menos Grande Gillian Boss - Charging Cero (32x32)
    menos_cero: {
      size: 32,
      palette: {
        '.': null,
        'k': '#09090b',
        'd': '#18181b',
        'w': '#f1f5f9',
        's': '#cbd5e1',
        'r': '#ff0033',
        'p': '#ff6b81'
      },
      rows: [
        '................................',
        '................................',
        '............kkkkkkkk............',
        '...........kwwwwwwwwk...........',
        '..........kwwwwwwwwwwk..........',
        '..........kwwrwwwwrwwk..........',
        '..........kwwwwwwwwwwk..........',
        '..........kwwwsssswwwk..........',
        '...........kwwwwwwwwk...........',
        '............kwwwwwwk............',
        '............kwwwwwwk............',
        '.............kwwwwk.............',
        '............kkrrrrkk............',
        '...........kkrpppprkk...........',
        '..........kkrppwwpprkk..........',
        '.........kkkkrpppprkkkk.........',
        '........kkkkkkrrrrkkkkkk........',
        '.......kkkkkkk....kkkkkkk.......',
        '......kkkkkkk......kkkkkkk......',
        '.....kkkkkkkd......dkkkkkkk.....',
        '....kkkkkkkdd......ddkkkkkkk....',
        '...kkkkkkkdd........ddkkkkkkk...',
        '..kkkkkkkdd..........ddkkkkkkk..',
        '.kkkkkkkdd............ddkkkkkkk.',
        '.kkkkkkdd..............ddkkkkkk.',
        '.kkkkkdd................ddkkkkk.',
        '.kkkkdd..................ddkkkk.',
        '.kkkdd....................ddkkk.',
        '.kkdd......................ddkk.',
        '................................',
        '................................',
        '................................'
      ]
    }
  };

  class SpriteCache {
    constructor() {
      this._cache = new Map();
    }
    set(key, canvas) {
      this._cache.set(key, canvas);
    }
    get(key) {
      if (!this._cache.has(key)) {
        throw new Error(`SpriteCache: sprite '${key}' not found.`);
      }
      return this._cache.get(key);
    }
    has(key) {
      return this._cache.has(key);
    }
    clear() {
      this._cache.clear();
    }
  }

  const defaultCache = new SpriteCache();

  class SpriteGen {
    /**
     * Runs 4-way cardinal outline filter on a grid
     * @param {string[]|string[][]} grid
     * @param {string} [outlineColor='#0a0a0c']
     * @returns {string[]|string[][]}
     */
    static applyOutline(grid, outlineColor = '#0a0a0c') {
      return applyOutline(grid, outlineColor);
    }

    /**
     * Returns raw sprite definition
     * @param {string} name
     * @returns {Object|null}
     */
    static getDef(name) {
      let resolvedName = name;
      if (name === 'altar') resolvedName = 'altar_intact';
      if (name === 'flyer') resolvedName = 'flyer_0';
      return SPRITE_DEFS[resolvedName] || null;
    }

    /**
     * Parses a pixel matrix safely without throwing on unrecognized characters.
     * @param {string[]|string[][]} matrix
     * @param {Object} [palette={}]
     * @returns {(string|null)[][]}
     */
    static parseMatrix(matrix, palette = {}) {
      if (!Array.isArray(matrix)) return [];
      return matrix.map(row => {
        const chars = typeof row === 'string' ? row.split('') : (Array.isArray(row) ? row : []);
        return chars.map(ch => {
          if (!ch || ch === '.') return null;
          return palette[ch] || null;
        });
      });
    }

    /**
     * Rasterizes a sprite into an OffscreenCanvas (or MockCanvas)
     * @param {string|Object} spriteOrName - Key name or definition object
     * @param {number} [scale=1] - Pixel scale multiplier
     * @param {Function} [canvasFactory] - Optional canvas factory
     * @returns {Object} Canvas instance
     */
    static rasterize(spriteOrName, scale = 1, canvasFactory = null) {
      let def = typeof spriteOrName === 'string' ? SPRITE_DEFS[spriteOrName] : spriteOrName;
      if (!def && typeof spriteOrName === 'string') {
        if (spriteOrName === 'altar') def = SPRITE_DEFS.altar_intact;
        if (spriteOrName === 'flyer') def = SPRITE_DEFS.flyer_0;
      }
      if (!def) throw new Error(`SpriteGen: unknown sprite '${spriteOrName}'`);

      const size = def.size;
      const outlined = applyOutline(def.rows, '#0a0a0c');
      const targetSize = size * scale;

      let canvas;
      if (canvasFactory) {
        canvas = canvasFactory(targetSize, targetSize);
      } else if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(targetSize, targetSize);
      } else if (typeof document !== 'undefined' && document.createElement) {
        canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
      } else if (global.TZ && global.TZ.MockCanvas) {
        canvas = new global.TZ.MockCanvas(targetSize, targetSize);
      } else {
        const MockCanvasClass = (typeof module !== 'undefined' && module.exports && module.exports.MockCanvas)
          ? module.exports.MockCanvas
          : (typeof require !== 'undefined' ? (function () {
              try { return require('./CanvasRenderer').MockCanvas; } catch (e) { return null; }
            })() : null);

        if (MockCanvasClass) {
          canvas = new MockCanvasClass(targetSize, targetSize);
        } else {
          // Minimal fallback mock
          canvas = {
            width: targetSize,
            height: targetSize,
            getContext: () => ({
              fillStyle: '',
              imageSmoothingEnabled: false,
              fillRect: () => {},
              clearRect: () => {}
            })
          };
        }
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const cell = outlined[r][c];
            if (!cell || cell === '.') continue;
            const color = (cell === '#0a0a0c' || cell === '#') ? '#0a0a0c' : (def.palette[cell] || (typeof cell === 'string' && cell.startsWith('#') ? cell : '#0a0a0c'));
            if (color) {
              ctx.fillStyle = color;
              ctx.fillRect(c * scale, r * scale, scale, scale);
            }
          }
        }
      }

      return canvas;
    }

    /**
     * Alias for rasterize(name, scale)
     */
    static generate(name, scale = 1, canvasFactory = null) {
      return SpriteGen.rasterize(name, scale, canvasFactory);
    }

    /**
     * Retrieves or rasterizes a cached sprite
     * @param {string} name
     * @param {number} [scale=1]
     * @returns {Object} Canvas instance
     */
    static getSprite(name, scale = 1) {
      let resolvedName = name;
      if (name === 'altar') resolvedName = 'altar_intact';
      if (name === 'flyer') resolvedName = 'flyer_0';

      const cacheKey = `${resolvedName}_${scale}`;
      if (defaultCache.has(cacheKey)) {
        return defaultCache.get(cacheKey);
      }
      if (scale === 1 && defaultCache.has(resolvedName)) {
        return defaultCache.get(resolvedName);
      }

      const canvas = SpriteGen.rasterize(resolvedName, scale);
      defaultCache.set(cacheKey, canvas);
      if (scale === 1) {
        defaultCache.set(resolvedName, canvas);
      }
      return canvas;
    }

    /**
     * Convenience helper for Hollow Crawler sprite
     * @param {number} [scale=1]
     * @returns {Object}
     */
    static getCrawlerSprite(scale = 1) {
      return SpriteGen.getSprite('crawler', scale);
    }

    /**
     * Pre-rasterizes all core sprites into the cache
     * @param {Object} [options]
     * @param {number} [options.scale=1]
     * @param {Function} [options.canvasFactory]
     * @param {SpriteCache} [options.cache=defaultCache]
     */
    static initAll(options = {}) {
      const scale = options.scale || 1;
      const factory = options.canvasFactory || null;
      const cache = options.cache || defaultCache;

      for (const key of Object.keys(SPRITE_DEFS)) {
        const canvas = SpriteGen.rasterize(key, scale, factory);
        cache.set(key, canvas);
        cache.set(`${key}_${scale}`, canvas);
      }

      // Add common aliases
      if (cache.has('altar_intact')) {
        cache.set('altar', cache.get('altar_intact'));
      }
      if (cache.has('flyer_0')) {
        cache.set('flyer', cache.get('flyer_0'));
      }

      return cache;
    }

    /**
     * Retrieves a rasterized canvas from the default cache
     * @param {string} name
     * @returns {Object}
     */
    static get(name) {
      return defaultCache.get(name);
    }
  }

  // Universal Modular Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.SpriteGen = SpriteGen;
  global.TZ.SpriteCache = SpriteCache;
  global.TZ.defaultSpriteCache = defaultCache;
  global.TZ.SPRITE_DEFS = SPRITE_DEFS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpriteGen;
    module.exports.SpriteGen = SpriteGen;
    module.exports.SpriteCache = SpriteCache;
    module.exports.defaultCache = defaultCache;
    module.exports.SPRITE_DEFS = SPRITE_DEFS;
    module.exports.applyOutline = applyOutline;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
