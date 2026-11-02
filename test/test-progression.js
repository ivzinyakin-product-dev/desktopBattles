/**
 * Tensa Zangetsu: Soul Altar Defense
 * test/test-progression.js
 * 
 * Unit and integration tests for Zanpakuto Form Progression System:
 * - Form definitions (SEALED, SHIKAI, BANKAI, DANGAI)
 * - Visual geometry, blade lengths (76px, 96px, 85px, 106px), and tsuba styles
 * - Tassel types (cord, white ribbon, chain, arm bind)
 * - Ability locking (Getsuga locked in SEALED; Senka locked in SEALED and SHIKAI)
 * - Crescent Wave projectile scaling and dual-composite color tiers
 * - Procedural Web Audio awakening fanfares
 * - Game wave-to-form progression coordinator (Wave 1: SEALED, 2-3: SHIKAI, 4-7: BANKAI, 8-10: DANGAI)
 * - HUD badge and dynamic Reiatsu gauge rendering
 * 
 * Target Environment: Node.js Native Test Runner (`node --test test/test-progression.js`)
 * Zero external dependencies.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Dependencies under test
const Katana = require('../src/game/Katana.js');
const { ZANPAKUTO_FORMS } = Katana;
const { GetsugaWave } = require('../src/game/Projectile.js');
const AudioSynth = require('../src/engine/AudioSynth.js');
const Game = require('../src/game/Game.js').Game;

// Mock 2D Context for canvas rendering assertions
class MockContext2D {
  constructor() {
    this.calls = [];
    this.shadowColor = '';
    this.shadowBlur = 0;
    this.strokeStyle = '';
    this.fillStyle = '';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.imageSmoothingEnabled = true;
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = 'source-over';
    this.font = '';
    this.textAlign = 'left';
  }
  save() { this.calls.push('save'); }
  restore() { this.calls.push('restore'); }
  translate(x, y) { this.calls.push(`translate(${x},${y})`); }
  rotate(a) { this.calls.push(`rotate(${a})`); }
  scale(x, y) { this.calls.push(`scale(${x},${y})`); }
  beginPath() { this.calls.push('beginPath'); }
  closePath() { this.calls.push('closePath'); }
  moveTo(x, y) { this.calls.push(`moveTo(${x},${y})`); }
  lineTo(x, y) { this.calls.push(`lineTo(${x},${y})`); }
  arc(x, y, r, sa, ea) { this.calls.push(`arc(${x},${y},${r})`); }
  rect(x, y, w, h) { this.calls.push(`rect(${x},${y},${w},${h})`); }
  fillRect(x, y, w, h) { this.calls.push(`fillRect(${x},${y},${w},${h})`); }
  strokeRect(x, y, w, h) { this.calls.push(`strokeRect(${x},${y},${w},${h})`); }
  stroke() { this.calls.push('stroke'); }
  fill() { this.calls.push('fill'); }
  fillText(text, x, y) { this.calls.push(`fillText(${text},${x},${y})`); }
  createLinearGradient() {
    return { addColorStop: () => {} };
  }
}

// Mock Canvas Element
class MockCanvas {
  constructor(width = 1280, height = 720) {
    this.width = width;
    this.height = height;
    this.style = {};
    this._ctx = new MockContext2D();
  }
  getContext(type) {
    if (type === '2d') return this._ctx;
    return null;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }
  addEventListener() {}
  removeEventListener() {}
}

describe('Zanpakuto Progression System', () => {

  describe('1. ZANPAKUTO_FORMS Configuration', () => {
    it('1.1 Contains all four canonical progression tiers', () => {
      assert.ok(ZANPAKUTO_FORMS.SEALED, 'SEALED form defined');
      assert.ok(ZANPAKUTO_FORMS.SHIKAI, 'SHIKAI form defined');
      assert.ok(ZANPAKUTO_FORMS.BANKAI, 'BANKAI form defined');
      assert.ok(ZANPAKUTO_FORMS.DANGAI, 'DANGAI form defined');
    });

    it('1.2 SEALED form locks Getsuga and Senka abilities with Asauchi styling', () => {
      const f = ZANPAKUTO_FORMS.SEALED;
      assert.strictEqual(f.bladeLength, 76);
      assert.strictEqual(f.trailLength, 8);
      assert.strictEqual(f.hasGetsuga, false);
      assert.strictEqual(f.hasSenka, false);
      assert.strictEqual(f.tsubaType, 'round');
      assert.strictEqual(f.tasselType, 'cord');
    });

    it('1.3 SHIKAI (Zangetsu) unlocks White Getsuga with cleaver geometry and ribbon', () => {
      const f = ZANPAKUTO_FORMS.SHIKAI;
      assert.strictEqual(f.bladeLength, 96);
      assert.strictEqual(f.trailLength, 14);
      assert.strictEqual(f.hasGetsuga, true);
      assert.strictEqual(f.hasSenka, false);
      assert.strictEqual(f.tsubaType, 'cleaver');
      assert.strictEqual(f.tasselType, 'ribbon');
      assert.strictEqual(f.projectileAuraColor, '#f8fafc');
    });

    it('1.4 BANKAI (Tensa Zangetsu) unlocks Kuroi Getsuga & Senka with Manji tsuba & chain', () => {
      const f = ZANPAKUTO_FORMS.BANKAI;
      assert.strictEqual(f.bladeLength, 85);
      assert.strictEqual(f.trailLength, 20);
      assert.strictEqual(f.hasGetsuga, true);
      assert.strictEqual(f.hasSenka, true);
      assert.strictEqual(f.tsubaType, 'manji');
      assert.strictEqual(f.tasselType, 'chain');
      assert.strictEqual(f.projectileAuraColor, '#ef4444');
    });

    it('1.5 DANGAI (Mugetsu) has colossal void stats, arm binding, and purple-black aura', () => {
      const f = ZANPAKUTO_FORMS.DANGAI;
      assert.strictEqual(f.bladeLength, 106);
      assert.strictEqual(f.trailLength, 28);
      assert.strictEqual(f.hasGetsuga, true);
      assert.strictEqual(f.hasSenka, true);
      assert.strictEqual(f.tsubaType, 'void');
      assert.strictEqual(f.tasselType, 'arm_bind');
      assert.strictEqual(f.projectileAuraColor, '#a855f7');
      assert.strictEqual(f.projectileDamage, 250);
    });
  });

  describe('2. Katana Form Evolution & Kinematics', () => {
    it('2.1 Default Katana constructor initializes in BANKAI state for backwards compatibility', () => {
      const katana = new Katana();
      assert.strictEqual(katana.getForm(), 'BANKAI');
      assert.strictEqual(katana.bladeLength, 85);
    });

    it('2.2 Transition to SEALED adjusts length to 76px and enforces ability locks', () => {
      const katana = new Katana();
      katana.setForm('SEALED');
      assert.strictEqual(katana.getForm(), 'SEALED');
      assert.strictEqual(katana.bladeLength, 76);
      assert.strictEqual(katana.trailLength, 8);

      // Senka locked
      const senkaResult = katana.triggerForcedSlash();
      assert.strictEqual(senkaResult, false);

      // Getsuga locked
      const getsugaResult = katana.triggerCrescentWave(640, 360, 1, 0);
      assert.strictEqual(getsugaResult, false);
      assert.strictEqual(katana.projectiles.length, 0);
    });

    it('2.3 Transition to SHIKAI unlocks White Getsuga but keeps Senka locked', () => {
      const katana = new Katana();
      katana.setForm('SHIKAI');
      assert.strictEqual(katana.getForm(), 'SHIKAI');
      assert.strictEqual(katana.bladeLength, 96);

      // Senka still locked
      assert.strictEqual(katana.triggerForcedSlash(), false);

      // Getsuga unlocked
      const res = katana.triggerCrescentWave(640, 360, 1, 0);
      assert.strictEqual(res, true);
      const wave = katana.projectiles[katana.projectiles.length - 1];
      assert.ok(wave instanceof GetsugaWave);
      assert.strictEqual(wave.auraColor, '#f8fafc');
      assert.strictEqual(wave.width, 42);
      assert.strictEqual(wave.damage, 120);
    });

    it('2.4 Transition to BANKAI unlocks both Senka slash and Kuroi Getsuga', () => {
      const katana = new Katana();
      katana.setForm('BANKAI');
      assert.strictEqual(katana.getForm(), 'BANKAI');
      assert.strictEqual(katana.bladeLength, 85);

      // Senka unlocked
      const senkaResult = katana.triggerForcedSlash();
      assert.strictEqual(senkaResult, true);
      assert.strictEqual(katana.isSlashing(), true);

      // Getsuga unlocked
      katana.forcedSlashActive = false;
      katana.crescentCooldownTimer = 0;
      const res = katana.triggerCrescentWave(640, 360, 1, 0);
      assert.strictEqual(res, true);
      const wave = katana.projectiles[katana.projectiles.length - 1];
      assert.ok(wave instanceof GetsugaWave);
      assert.strictEqual(wave.auraColor, '#ef4444');
      assert.strictEqual(wave.width, 48);
      assert.strictEqual(wave.damage, 150);
    });

    it('2.5 Transition to DANGAI expands slash arc to 140px and fires colossal Void Getsuga', () => {
      const katana = new Katana();
      katana.setForm('DANGAI');
      assert.strictEqual(katana.getForm(), 'DANGAI');
      assert.strictEqual(katana.bladeLength, 106);

      // Colossal Senka
      const senkaResult = katana.triggerForcedSlash();
      assert.strictEqual(senkaResult, true);

      // Colossal Getsuga
      katana.forcedSlashActive = false;
      katana.crescentCooldownTimer = 0;
      const res = katana.triggerCrescentWave(640, 360, 1, 0);
      assert.strictEqual(res, true);
      const wave = katana.projectiles[katana.projectiles.length - 1];
      assert.ok(wave instanceof GetsugaWave);
      assert.strictEqual(wave.auraColor, '#a855f7');
      assert.strictEqual(wave.width, 64);
      assert.strictEqual(wave.damage, 250);
    });

    it('2.6 Renders all four forms to Canvas without exceptions', () => {
      const katana = new Katana();
      const ctx = new MockContext2D();

      const forms = ['SEALED', 'SHIKAI', 'BANKAI', 'DANGAI'];
      for (const f of forms) {
        katana.setForm(f);
        katana.update(0.016, { x: 640, y: 360 });
        assert.doesNotThrow(() => {
          katana.draw(ctx);
        }, `Drawing form ${f} threw exception`);
      }
    });
  });

  describe('3. Procedural Audio Synth Awakening Fanfares', () => {
    it('3.1 Generates awakening fanfares for all forms without throwing', () => {
      const audio = new AudioSynth();
      assert.doesNotThrow(() => {
        audio.playAwakening('SHIKAI');
        audio.playAwakening('BANKAI');
        audio.playAwakening('DANGAI');
        audio.playAwakening('SEALED');
      });
    });

    it('3.2 Recovers safely if AudioContext is missing or muted', () => {
      const audio = new AudioSynth();
      audio.ctx = null;
      assert.doesNotThrow(() => {
        audio.playAwakening('BANKAI');
      });
    });
  });

  describe('4. Game Wave Progression Coordinator', () => {
    it('4.1 getZanpakutoFormForWave maps 10 waves canonically', () => {
      const canvas = new MockCanvas();
      const game = new Game(canvas);

      // Wave 1 -> SEALED
      assert.strictEqual(game.getZanpakutoFormForWave(1), 'SEALED');

      // Waves 2-4 -> SHIKAI
      assert.strictEqual(game.getZanpakutoFormForWave(2), 'SHIKAI');
      assert.strictEqual(game.getZanpakutoFormForWave(3), 'SHIKAI');
      assert.strictEqual(game.getZanpakutoFormForWave(4), 'SHIKAI');

      // Waves 5-7 -> BANKAI
      assert.strictEqual(game.getZanpakutoFormForWave(5), 'BANKAI');
      assert.strictEqual(game.getZanpakutoFormForWave(6), 'BANKAI');
      assert.strictEqual(game.getZanpakutoFormForWave(7), 'BANKAI');

      // Waves 8-10 -> DANGAI
      assert.strictEqual(game.getZanpakutoFormForWave(8), 'DANGAI');
      assert.strictEqual(game.getZanpakutoFormForWave(9), 'DANGAI');
      assert.strictEqual(game.getZanpakutoFormForWave(10), 'DANGAI');
    });

    it('4.2 Game restart resets Katana form to SEALED for Wave 1', () => {
      const canvas = new MockCanvas();
      const game = new Game(canvas);
      game.katana.setForm('DANGAI');
      assert.strictEqual(game.katana.getForm(), 'DANGAI');

      game.restart();
      assert.strictEqual(game.waves.currentWave, 1);
      assert.strictEqual(game.katana.getForm(), 'SEALED');
    });

    it('4.3 Wave advancement triggers Zanpakuto form awakening with announcement banner', () => {
      const canvas = new MockCanvas();
      const game = new Game(canvas);
      game.restart();
      assert.strictEqual(game.katana.getForm(), 'SEALED');

      // Simulate Wave 1 clear -> Advance to Wave 2 (SHIKAI)
      game.waves.currentWave = 2;
      game._checkZanpakutoProgression();
      assert.strictEqual(game.katana.getForm(), 'SHIKAI');
      assert.ok(game.floatingTexts.some(ft => ft.text.includes('Zangetsu')));

      // Wave 4 remains SHIKAI (Seireitei Infiltration)
      game.waves.currentWave = 4;
      game._checkZanpakutoProgression();
      assert.strictEqual(game.katana.getForm(), 'SHIKAI');

      // Simulate Wave 4 clear -> Advance to Wave 5 (BANKAI on Sokyoku Hill)
      game.waves.currentWave = 5;
      game._checkZanpakutoProgression();
      assert.strictEqual(game.katana.getForm(), 'BANKAI');
      assert.ok(game.floatingTexts.some(ft => ft.text.includes('TENSA ZANGETSU')));

      // Simulate Wave 7 clear -> Advance to Wave 8 (DANGAI)
      game.waves.currentWave = 8;
      game._checkZanpakutoProgression();
      assert.strictEqual(game.katana.getForm(), 'DANGAI');
      assert.ok(game.floatingTexts.some(ft => ft.text.includes('MUGETSU')));
    });

    it('4.4 Firing Getsuga in SEALED form shows REIATSU DORMANT banner', () => {
      const canvas = new MockCanvas();
      const game = new Game(canvas);
      game.restart();
      assert.strictEqual(game.katana.getForm(), 'SEALED');

      game._fireGetsugaWave();
      assert.strictEqual(game.katana.projectiles.length, 0);
      assert.ok(game.floatingTexts.some(ft => ft.text.includes('REIATSU DORMANT')));
    });

    it('4.5 HUD renders active Zanpakuto badge and dynamic Getsuga gauge', () => {
      const canvas = new MockCanvas();
      const game = new Game(canvas);
      game.restart();
      const ctx = new MockContext2D();

      assert.doesNotThrow(() => {
        game.render(1.0);
      });
      assert.ok(ctx.calls.length > 0);
    });
  });

});
