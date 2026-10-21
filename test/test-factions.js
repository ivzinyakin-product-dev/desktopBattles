/**
 * Tensa Zangetsu: Soul Altar Defense
 * test/test-factions.js
 * 
 * Unit and integration tests for Faction Enemies across Bleach Story Stages:
 * - Wave to Faction mapping (Hollows, Shinigami Gotei 13, Arrancar & Espada)
 * - Sprite generation and caching for all 6 new archetypes and projectiles
 * - Enlarged sprite sizing (28px - 54px) and visual clarity
 * - Special mechanics (Shunpo dash, Hadō #31 casting, Sonido evasion, Hierro, Parry)
 * - EnemyProjectile (Shakkahō & Bala) movement, Altar hit, and blade deflection
 * - Slicer 2D bisection across all new faction entities
 * 
 * Target Environment: Node.js Native Test Runner (`node --test test/test-factions.js`)
 * Zero external dependencies.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Dependencies under test
const Vector2 = require('../src/engine/Vector2.js');
const SpriteGen = require('../src/engine/SpriteGen.js');
const { SPRITE_DEFS, SpriteCache } = SpriteGen;
const Enemy = require('../src/game/Enemy.js');
const { ENEMY_TYPES, ENEMY_CONFIGS, EnemyProjectile } = Enemy;
const WaveManager = require('../src/game/WaveManager.js');
const Slicer = require('../src/game/Slicer.js');
const { DebrisPiece } = Slicer;

// Mock 2D Context for tests
class MockContext2D {
  constructor() {
    this.calls = [];
    this.shadowColor = '';
    this.shadowBlur = 0;
    this.strokeStyle = '';
    this.fillStyle = '';
    this.lineWidth = 1;
    this.imageSmoothingEnabled = true;
  }
  save() { this.calls.push('save'); }
  restore() { this.calls.push('restore'); }
  translate(x, y) { this.calls.push(`translate(${x},${y})`); }
  rotate(a) { this.calls.push(`rotate(${a})`); }
  beginPath() { this.calls.push('beginPath'); }
  closePath() { this.calls.push('closePath'); }
  moveTo(x, y) { this.calls.push(`moveTo(${x},${y})`); }
  lineTo(x, y) { this.calls.push(`lineTo(${x},${y})`); }
  arc(x, y, r) { this.calls.push(`arc(${x},${y},${r})`); }
  rect(x, y, w, h) { this.calls.push(`rect(${x},${y},${w},${h})`); }
  fill() { this.calls.push('fill'); }
  stroke() { this.calls.push('stroke'); }
  drawImage() { this.calls.push('drawImage'); }
}

describe('Faction Enemies: Bleach Narrative Factions', () => {
  // ==========================================================================
  // 1. WaveManager Faction Mapping
  // ==========================================================================
  describe('1. Wave to Story Faction Mapping', () => {
    it('1.1 maps Waves 1 to 3 to Hollow faction (Karakura & Rukongai)', () => {
      const wm = new WaveManager();
      for (let w = 1; w <= 3; w++) {
        assert.strictEqual(wm.getFactionForWave(w), 'hollow', `Wave ${w} must be hollow`);
      }
    });

    it('1.2 maps Waves 4 to 5 to Shinigami Gotei 13 faction (Seireitei & Sokyoku)', () => {
      const wm = new WaveManager();
      for (let w = 4; w <= 5; w++) {
        assert.strictEqual(wm.getFactionForWave(w), 'shinigami', `Wave ${w} must be shinigami`);
      }
    });

    it('1.3 maps Waves 6 and higher to Arrancar & Espada faction (Hueco Mundo, Las Noches & Fake Karakura)', () => {
      const wm = new WaveManager();
      for (let w = 6; w <= 15; w++) {
        assert.strictEqual(wm.getFactionForWave(w), 'arrancar', `Wave ${w} must be arrancar`);
      }
    });

    it('1.4 picks Shinigami archetypes during Waves 4-5', () => {
      const wm = new WaveManager();
      const pickedTypes = new Set();
      for (let i = 0; i < 100; i++) {
        pickedTypes.add(wm.pickEnemyType(5));
      }
      assert.ok(pickedTypes.has('shinigami_swordsman'), 'Should pick shinigami_swordsman');
      assert.ok(pickedTypes.has('shinigami_kido'), 'Should pick shinigami_kido');
      assert.ok(pickedTypes.has('shinigami_officer'), 'Should pick shinigami_officer');
    });

    it('1.5 picks Arrancar archetypes during Waves 6+', () => {
      const wm = new WaveManager();
      const pickedTypes = new Set();
      for (let i = 0; i < 100; i++) {
        pickedTypes.add(wm.pickEnemyType(7));
      }
      assert.ok(pickedTypes.has('arrancar_numeros'), 'Should pick arrancar_numeros');
      assert.ok(pickedTypes.has('arrancar_flyer'), 'Should pick arrancar_flyer');
      assert.ok(pickedTypes.has('arrancar_brute'), 'Should pick arrancar_brute');
    });

    it('1.6 identifies boss waves and final wave threshold', () => {
      const wm = new WaveManager();
      assert.strictEqual(wm.isBossWave(3), true, 'Wave 3 should be Menos breach boss');
      assert.strictEqual(wm.isBossWave(10), true, 'Wave 10 should be Final Boss');
      assert.strictEqual(wm.isBossWave(1), false, 'Wave 1 is not a boss wave');
      assert.strictEqual(wm.isFinalWave(10), true, 'Wave 10 should be final wave');
      assert.strictEqual(wm.isFinalWave(9), false, 'Wave 9 is not final wave');
    });
  });

  // ==========================================================================
  // 2. Sprite Matrices & Enlarged Sizing
  // ==========================================================================
  describe('2. Sprite Definitions & Scaling', () => {
    it('2.1 defines all 6 new enemy sprites and projectiles with exact dimensions', () => {
      const expected = [
        { name: 'shinigami_swordsman', size: 16 },
        { name: 'shinigami_swordsman_walk', size: 16 },
        { name: 'shinigami_kido', size: 16 },
        { name: 'shinigami_officer', size: 32 },
        { name: 'arrancar_numeros', size: 16 },
        { name: 'arrancar_numeros_walk', size: 16 },
        { name: 'arrancar_flyer_0', size: 16 },
        { name: 'arrancar_flyer_1', size: 16 },
        { name: 'arrancar_brute', size: 32 },
        { name: 'kido_shakkaho', size: 16 },
        { name: 'arrancar_bala', size: 16 }
      ];

      for (const item of expected) {
        const def = SPRITE_DEFS[item.name];
        assert.ok(def, `Sprite '${item.name}' must be defined`);
        assert.strictEqual(def.size, item.size, `${item.name} size must be ${item.size}`);
        assert.strictEqual(def.rows.length, item.size, `${item.name} row count must be ${item.size}`);
        assert.ok(
          def.rows.every(r => r.length === item.size),
          `${item.name} every row length must be exactly ${item.size}`
        );
      }
    });

    it('2.2 verifies small enemies have enlarged spriteSize (>= 28px) for retro clarity', () => {
      assert.ok(ENEMY_CONFIGS.crawler.spriteSize >= 28, 'crawler spriteSize enlarged');
      assert.ok(ENEMY_CONFIGS.flyer.spriteSize >= 28, 'flyer spriteSize enlarged');
      assert.ok(ENEMY_CONFIGS.shinigami_swordsman.spriteSize >= 28, 'shinigami_swordsman spriteSize enlarged');
      assert.ok(ENEMY_CONFIGS.shinigami_kido.spriteSize >= 28, 'shinigami_kido spriteSize enlarged');
      assert.ok(ENEMY_CONFIGS.arrancar_numeros.spriteSize >= 28, 'arrancar_numeros spriteSize enlarged');
      assert.ok(ENEMY_CONFIGS.arrancar_flyer.spriteSize >= 28, 'arrancar_flyer spriteSize enlarged');
    });

    it('2.3 verifies heavy enemies have enlarged spriteSize (>= 50px)', () => {
      assert.ok(ENEMY_CONFIGS.brute.spriteSize >= 50, 'brute spriteSize enlarged');
      assert.ok(ENEMY_CONFIGS.shinigami_officer.spriteSize >= 50, 'shinigami_officer spriteSize enlarged');
      assert.ok(ENEMY_CONFIGS.arrancar_brute.spriteSize >= 50, 'arrancar_brute spriteSize enlarged');
    });

    it('2.4 rasterizes and retrieves all new faction sprites without error', () => {
      const keys = ['shinigami_swordsman', 'shinigami_kido', 'shinigami_officer', 'arrancar_numeros', 'arrancar_flyer', 'arrancar_brute'];
      for (const key of keys) {
        const canvas = SpriteGen.getSprite(key);
        assert.ok(canvas, `Sprite '${key}' must be retrieved`);
      }
    });
  });

  // ==========================================================================
  // 3. Faction AI & Combat Mechanics
  // ==========================================================================
  describe('3. Faction Abilities & Combat Behaviors', () => {
    it('3.1 Shinigami Swordsman performs Shunpo speed dash toward Altar', () => {
      const sm = Enemy.createShinigamiSwordsman(0, 360, { shunpoPhase: 0 });
      sm.shunpoCooldownTimer = 0; // Trigger immediately
      sm.update(0.016, { x: 640, y: 360, radius: 36 });
      assert.ok(sm.shunpoDashTimer > 0, 'Shunpo dash timer must be active');
      assert.ok(sm.vx > 250, 'Velocity during Shunpo must exceed 250 px/s');
    });

    it('3.2 Shinigami Kidō Caster stops at standoff range and returns projectile event', () => {
      // Spawn at distance 200px from Altar (within 220px kidoRange)
      const kc = Enemy.createShinigamiKido(440, 360);
      kc.kidoTimer = 0.01;
      const res = kc.update(0.02, { x: 640, y: 360, radius: 36 });
      assert.ok(res, 'Must return event');
      assert.ok(res.spawnProjectile, 'Must contain spawnProjectile event');
      assert.strictEqual(res.spawnProjectile.type, 'shakkaho');
    });

    it('3.3 Shinigami Officer parries attacks below 650 px/s and breaks on >= 650 px/s', () => {
      const off = Enemy.createShinigamiOfficer(100, 100);
      // Light slash (500 px/s)
      const resLight = off.onHit(50, { x: 0, y: 1 }, 0, 500);
      assert.strictEqual(resLight.ricochet, true, 'Must parry light slash');
      assert.strictEqual(off.armorBroken, false, 'Guard must remain intact');

      // Heavy slash (700 px/s)
      const resHeavy = off.onHit(50, { x: 0, y: 1 }, 0, 700);
      assert.strictEqual(resHeavy.cracked, true, 'Guard must be broken');
      assert.strictEqual(off.armorBroken, true, 'armorBroken must be true');
      assert.ok(off.stunTimer > 0, 'Must be stunned');
    });

    it('3.4 Arrancar Numeros triggers Sonido flash evasion when blade approaches', () => {
      const num = Enemy.createArrancarNumeros(100, 100);
      num.sonidoCooldownTimer = 0;
      const initialX = num.x;
      const initialY = num.y;

      const evaded = num.evadeSonido({ x: 120, y: 100 }, 350);
      assert.strictEqual(evaded, true, 'Sonido must trigger');
      assert.ok(num.sonidoCooldownTimer > 0, 'Cooldown must be set');
      assert.ok(num.x !== initialX || num.y !== initialY, 'Position must shift laterally');
    });

    it('3.5 Arrancar Brute deflects slashes below 700 px/s with Hierro', () => {
      const ab = Enemy.createArrancarBrute(100, 100);
      // Light slash (600 px/s < 700)
      const resLight = ab.onHit(50, { x: 0, y: 1 }, 0, 600);
      assert.strictEqual(resLight.ricochet, true, 'Hierro must deflect');
      assert.strictEqual(ab.armorBroken, false);

      // Heavy slash (750 px/s >= 700)
      const resHeavy = ab.onHit(50, { x: 0, y: 1 }, 0, 750);
      assert.strictEqual(resHeavy.cracked, true, 'Hierro shattered');
      assert.strictEqual(ab.armorBroken, true);
    });
  });

  // ==========================================================================
  // 4. Enemy Projectiles (Shakkahō & Bala)
  // ==========================================================================
  describe('4. Enemy Projectiles Subsystem', () => {
    it('4.1 initializes Hadō #31 Shakkahō projectile with correct stats and direction', () => {
      const proj = new EnemyProjectile(100, 100, 640, 360, 'shakkaho');
      assert.strictEqual(proj.type, 'shakkaho');
      assert.strictEqual(proj.damage, 14);
      assert.strictEqual(proj.speed, 190);
      assert.strictEqual(proj.radius, 12);
      assert.ok(proj.vx > 0, 'vx towards Altar must be positive');
      assert.ok(proj.vy > 0, 'vy towards Altar must be positive');
    });

    it('4.2 delivers damage when reaching Altar boundary', () => {
      // Spawns 40px away from Altar (altar radius 36 + proj radius 12 = 48)
      const proj = new EnemyProjectile(640, 360 + 40, 640, 360, 'shakkaho');
      const res = proj.update(0.016, { x: 640, y: 360, radius: 36 });
      assert.ok(res, 'Must return hit event');
      assert.strictEqual(res.hitAltar, true);
      assert.strictEqual(res.damage, 14);
      assert.strictEqual(proj.isDead, true);
    });

    it('4.3 draws without throwing on 2D context', () => {
      const proj = new EnemyProjectile(200, 200, 640, 360, 'bala');
      const ctx = new MockContext2D();
      assert.doesNotThrow(() => proj.draw(ctx));
    });
  });

  // ==========================================================================
  // 5. Fair Bisection Slicing (Slicer.js Integration)
  // ==========================================================================
  describe('5. Slicer Bisection on New Factions', () => {
    it('5.1 cleanly slices Shinigami Swordsman into two debris halves', () => {
      const sm = Enemy.createShinigamiSwordsman(200, 200);
      const halves = Slicer.sliceEnemy(sm, { x: 200, y: 200 }, Math.PI / 4, 500);
      assert.strictEqual(halves.length, 2);
      assert.ok(halves[0] instanceof DebrisPiece);
      assert.ok(halves[1] instanceof DebrisPiece);
      assert.strictEqual(halves[0].half, 'A');
      assert.strictEqual(halves[1].half, 'B');
    });

    it('5.2 cleanly slices Arrancar Numeros into two debris halves', () => {
      const num = Enemy.createArrancarNumeros(300, 300);
      const halves = Slicer.sliceEnemy(num, { x: 300, y: 300 }, 0, 500);
      assert.strictEqual(halves.length, 2);
      assert.strictEqual(halves[0].isHalfA, true);
      assert.strictEqual(halves[1].isHalfB, true);
    });

    it('5.3 debris pieces inherit enlarged radius and dissolve properly', () => {
      const off = Enemy.createShinigamiOfficer(100, 100);
      const halves = Slicer.sliceEnemy(off, { x: 100, y: 100 }, 0, 700);
      assert.strictEqual(halves.length, 2);
      assert.strictEqual(halves[0].radius, off.radius);

      // Dissolve over lifespan
      halves[0].update(0.9);
      assert.strictEqual(halves[0].isDead, true);
      assert.strictEqual(halves[0].alpha, 0);
    });
  });
});
