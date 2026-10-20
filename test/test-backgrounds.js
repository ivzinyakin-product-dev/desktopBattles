/**
 * Tensa Zangetsu: Soul Altar Defense
 * test/test-backgrounds.js
 * 
 * Test suite for BackgroundManager (Feature: Chronological Bleach Story Backgrounds):
 * - Wave to location mapping (Waves 1 to 50 across 7 narrative arcs)
 * - Procedural canvas rasterization for all 7 locations
 * - Smooth cross-fade transition state machine
 * - Cinematic chapter banners (Kanji, titles, timer lifecycle)
 * - Ambient spiritual particle simulation & boundary wrapping
 * - Game coordinator integration and reset
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Mock Canvas & 2D Context for Headless Node.js
class MockContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1.0;
    this.shadowColor = '';
    this.shadowBlur = 0;
    this.font = '';
    this.textAlign = 'left';
    this.calls = [];
  }
  save() { this.calls.push(['save']); }
  restore() { this.calls.push(['restore']); }
  beginPath() { this.calls.push(['beginPath']); }
  closePath() { this.calls.push(['closePath']); }
  moveTo(x, y) { this.calls.push(['moveTo', x, y]); }
  lineTo(x, y) { this.calls.push(['lineTo', x, y]); }
  arc(x, y, r, sa, ea) { this.calls.push(['arc', x, y, r, sa, ea]); }
  fillRect(x, y, w, h) { this.calls.push(['fillRect', x, y, w, h]); }
  strokeRect(x, y, w, h) { this.calls.push(['strokeRect', x, y, w, h]); }
  stroke() { this.calls.push(['stroke']); }
  fill() { this.calls.push(['fill']); }
  drawImage(img, x, y, w, h) { this.calls.push(['drawImage', x, y, w, h]); }
  fillText(text, x, y) { this.calls.push(['fillText', text, x, y]); }
  measureText(text) { return { width: (text || '').length * 8 }; }
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
}

class MockCanvas {
  constructor(width = 1280, height = 720) {
    this.width = width;
    this.height = height;
    this.style = {};
    this.ctx = new MockContext2D(this);
  }
  getContext(t) { return t === '2d' ? this.ctx : null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
  addEventListener() {}
  removeEventListener() {}
}

global.TZ = global.TZ || {};
global.TZ.MockCanvas = MockCanvas;

const { BackgroundManager, LOCATIONS } = require('../src/engine/BackgroundManager.js');

describe('BackgroundManager: Chronological Bleach Story Stages', () => {

  describe('1. Wave to Narrative Location Mapping', () => {
    let bg;
    beforeEach(() => { bg = new BackgroundManager(); });

    it('1.1 maps Waves 1, 2, 3 to Karakura Town (Substitute Shinigami Arc)', () => {
      assert.strictEqual(bg.getLocationForWave(1), 'karakura');
      assert.strictEqual(bg.getLocationForWave(2), 'karakura');
      assert.strictEqual(bg.getLocationForWave(3), 'karakura');
    });

    it('1.2 maps Waves 4, 5, 6 to Rukongai Outskirts (Soul Society Infiltration)', () => {
      assert.strictEqual(bg.getLocationForWave(4), 'rukongai');
      assert.strictEqual(bg.getLocationForWave(5), 'rukongai');
      assert.strictEqual(bg.getLocationForWave(6), 'rukongai');
    });

    it('1.3 maps Waves 7, 8, 9 to Seireitei Infiltration (Gotei 13 Fortress)', () => {
      assert.strictEqual(bg.getLocationForWave(7), 'seireitei');
      assert.strictEqual(bg.getLocationForWave(8), 'seireitei');
      assert.strictEqual(bg.getLocationForWave(9), 'seireitei');
    });

    it('1.4 maps Waves 10, 11, 12 to The Sōkyoku Hill (Execution Grounds & Bankai)', () => {
      assert.strictEqual(bg.getLocationForWave(10), 'sokyoku');
      assert.strictEqual(bg.getLocationForWave(11), 'sokyoku');
      assert.strictEqual(bg.getLocationForWave(12), 'sokyoku');
    });

    it('1.5 maps Waves 13, 14, 15 to Hueco Mundo (White Sand Dunes)', () => {
      assert.strictEqual(bg.getLocationForWave(13), 'huecomundo');
      assert.strictEqual(bg.getLocationForWave(14), 'huecomundo');
      assert.strictEqual(bg.getLocationForWave(15), 'huecomundo');
    });

    it('1.6 maps Waves 16, 17, 18, 19 to Las Noches Palace (Espada Colonnades)', () => {
      assert.strictEqual(bg.getLocationForWave(16), 'lasnoches');
      assert.strictEqual(bg.getLocationForWave(17), 'lasnoches');
      assert.strictEqual(bg.getLocationForWave(18), 'lasnoches');
      assert.strictEqual(bg.getLocationForWave(19), 'lasnoches');
    });

    it('1.7 maps Waves 20 and higher to Fake Karakura Town (Endgame War)', () => {
      assert.strictEqual(bg.getLocationForWave(20), 'fakekarakura');
      assert.strictEqual(bg.getLocationForWave(25), 'fakekarakura');
      assert.strictEqual(bg.getLocationForWave(50), 'fakekarakura');
      assert.strictEqual(bg.getLocationForWave(100), 'fakekarakura');
    });

    it('1.8 gracefully clamps invalid, zero, or negative waves to Karakura', () => {
      assert.strictEqual(bg.getLocationForWave(0), 'karakura');
      assert.strictEqual(bg.getLocationForWave(-5), 'karakura');
      assert.strictEqual(bg.getLocationForWave(null), 'karakura');
      assert.strictEqual(bg.getLocationForWave(undefined), 'karakura');
    });
  });

  describe('2. Procedural Canvases & Location Metadata', () => {
    it('2.1 defines all 7 required story locations with kanji and titles', () => {
      const required = ['karakura', 'rukongai', 'seireitei', 'sokyoku', 'huecomundo', 'lasnoches', 'fakekarakura'];
      for (const key of required) {
        assert.ok(LOCATIONS[key], `Missing config for ${key}`);
        assert.ok(LOCATIONS[key].kanji, `Missing kanji for ${key}`);
        assert.ok(LOCATIONS[key].title, `Missing title for ${key}`);
        assert.ok(LOCATIONS[key].desc, `Missing description for ${key}`);
        assert.ok(LOCATIONS[key].accentColor, `Missing accent color for ${key}`);
      }
    });

    it('2.2 pre-renders and caches offscreen canvases for all 7 locations', () => {
      const bg = new BackgroundManager();
      const keys = Object.keys(LOCATIONS);
      assert.strictEqual(keys.length, 7);
      for (const k of keys) {
        assert.ok(bg.cache[k], `Canvas not cached for ${k}`);
        assert.strictEqual(bg.cache[k].width, 1280);
        assert.strictEqual(bg.cache[k].height, 720);
      }
    });

    it('2.3 draw() successfully renders on mock context without throwing', () => {
      const bg = new BackgroundManager();
      const mockCanvas = new MockCanvas();
      const ctx = mockCanvas.getContext('2d');
      assert.doesNotThrow(() => {
        bg.draw(ctx);
      });
      assert.ok(ctx.calls.length > 0);
    });
  });

  describe('3. Smooth Cross-Fade Transitions', () => {
    let bg;
    beforeEach(() => { bg = new BackgroundManager(); });

    it('3.1 initiates transition when changing to a new location', () => {
      bg.transitionTo('rukongai');
      assert.strictEqual(bg.currentLocationKey, 'karakura');
      assert.strictEqual(bg.targetLocationKey, 'rukongai');
      assert.strictEqual(bg.transitionProgress, 0.0);
    });

    it('3.2 linearly progresses transition over transitionDuration (1.5s)', () => {
      bg.transitionTo('rukongai');
      bg.update(0.75); // Half duration
      assert.ok(Math.abs(bg.transitionProgress - 0.5) < 0.01);

      bg.update(0.75); // Full duration
      assert.strictEqual(bg.transitionProgress, 1.0);
      assert.strictEqual(bg.currentLocationKey, 'rukongai');
    });

    it('3.3 onWaveChange automatically triggers transition only on biome shift', () => {
      // Wave 1 -> Wave 2: same biome (karakura -> karakura) -> no transition
      bg.onWaveChange(2);
      assert.strictEqual(bg.transitionProgress, 1.0);
      assert.strictEqual(bg.targetLocationKey, 'karakura');

      // Wave 2 -> Wave 4: biome shift (karakura -> rukongai) -> triggers transition
      bg.onWaveChange(4);
      assert.strictEqual(bg.transitionProgress, 0.0);
      assert.strictEqual(bg.targetLocationKey, 'rukongai');
    });

    it('3.4 reset() cleanly returns to Karakura with transition complete', () => {
      bg.onWaveChange(10); // Sokyoku
      bg.update(2.0);
      assert.strictEqual(bg.currentLocationKey, 'sokyoku');

      bg.reset();
      assert.strictEqual(bg.currentLocationKey, 'karakura');
      assert.strictEqual(bg.targetLocationKey, 'karakura');
      assert.strictEqual(bg.transitionProgress, 1.0);
    });
  });

  describe('4. Cinematic Chapter Banners', () => {
    let bg;
    beforeEach(() => { bg = new BackgroundManager(); });

    it('4.1 initializes with initial banner for Wave 1 Karakura Town', () => {
      assert.ok(bg.bannerTimer > 0);
      assert.strictEqual(bg.bannerLocation.id, 'karakura');
    });

    it('4.2 triggerBanner sets bannerTimer to canonical duration (2.8s)', () => {
      bg.triggerBanner('seireitei');
      assert.strictEqual(bg.bannerTimer, 2.8);
      assert.strictEqual(bg.bannerLocation.id, 'seireitei');
      assert.strictEqual(bg.bannerLocation.kanji, '瀞霊廷');
    });

    it('4.3 bannerTimer decays linearly and clamps at 0', () => {
      bg.triggerBanner('sokyoku');
      bg.update(1.0);
      assert.ok(Math.abs(bg.bannerTimer - 1.8) < 0.01);
      bg.update(3.0);
      assert.strictEqual(bg.bannerTimer, 0);
    });

    it('4.4 drawBanner renders letterbox and text when bannerTimer > 0', () => {
      bg.triggerBanner('huecomundo');
      const mockCanvas = new MockCanvas();
      const ctx = mockCanvas.getContext('2d');
      bg.drawBanner(ctx);

      const hasFillText = ctx.calls.some(c => c[0] === 'fillText' && c[1].includes('УЭКО МУНДО'));
      assert.ok(hasFillText, 'Banner should render Russian chapter title');
    });

    it('4.5 drawBanner is a no-op when bannerTimer is 0', () => {
      bg.bannerTimer = 0;
      const mockCanvas = new MockCanvas();
      const ctx = mockCanvas.getContext('2d');
      bg.drawBanner(ctx);
      assert.strictEqual(ctx.calls.length, 0);
    });
  });

  describe('5. Ambient Spiritual Particles', () => {
    let bg;
    beforeEach(() => { bg = new BackgroundManager(); });

    it('5.1 initializes pool with 45 ambient particles within arena bounds', () => {
      assert.strictEqual(bg.ambientParticles.length, 45);
      for (const p of bg.ambientParticles) {
        assert.ok(p.x >= 0 && p.x <= 1280);
        assert.ok(p.y >= 0 && p.y <= 720);
        assert.ok(typeof p.color === 'string');
      }
    });

    it('5.2 updates particle positions and wraps across boundaries', () => {
      const p = bg.ambientParticles[0];
      p.x = 1279;
      p.vx = 50;
      bg.update(0.1);
      assert.ok(p.x < 1280, 'Particle should wrap around right edge');
    });

    it('5.3 updates particle colors and velocities on biome re-theming', () => {
      bg._rethemeAmbientParticles('sokyoku');
      for (const p of bg.ambientParticles) {
        assert.strictEqual(p.color, LOCATIONS.sokyoku.accentColor);
        assert.ok(p.vy < 0, 'Sokyoku particles should rise upward like fire embers');
      }

      bg._rethemeAmbientParticles('huecomundo');
      for (const p of bg.ambientParticles) {
        assert.strictEqual(p.color, LOCATIONS.huecomundo.accentColor);
        assert.ok(p.vy > 0, 'Hueco Mundo particles should fall downward like quartz snow');
      }
    });
  });

  describe('6. Game Coordinator Integration', () => {
    it('6.1 Game instance automatically creates and wires BackgroundManager', () => {
      const { Game } = require('../src/game/Game.js');
      const mockCanvas = new MockCanvas();
      const game = new Game(mockCanvas);

      assert.ok(game.background, 'Game should have background manager');
      assert.strictEqual(game.background.currentLocationKey, 'karakura');
    });

    it('6.2 advancing waves in Game triggers background transition and banner', () => {
      const { Game } = require('../src/game/Game.js');
      const mockCanvas = new MockCanvas();
      const game = new Game(mockCanvas);
      game.startGame();

      // Advance to Wave 4 (Rukongai)
      game.waves.currentWave = 3;
      game.waves.spawnedInWave = game.waves.calculateEnemyCount(3);
      game.enemies = [];

      // Next game update detects wave completion
      game.update(1 / 120);

      assert.strictEqual(game.waves.currentWave, 4);
      assert.strictEqual(game.background.targetLocationKey, 'rukongai');
      assert.ok(game.background.bannerTimer > 0);
      assert.strictEqual(game.background.bannerLocation.id, 'rukongai');
    });

    it('6.3 game.restart() resets background to Karakura Town and triggers banner', () => {
      const { Game } = require('../src/game/Game.js');
      const mockCanvas = new MockCanvas();
      const game = new Game(mockCanvas);
      game.startGame();

      game.background.targetLocationKey = 'lasnoches';
      game.background.currentLocationKey = 'lasnoches';

      game.restart();
      assert.strictEqual(game.background.currentLocationKey, 'karakura');
      assert.strictEqual(game.background.targetLocationKey, 'karakura');
      assert.ok(game.background.bannerTimer > 0);
    });
  });

});
