/**
 * Tensa Zangetsu: Soul Altar Defense - Master Game Coordinator
 * 
 * Coordinates Canvas rendering, input tracking, 120Hz physics accumulator,
 * Katana blade kinematics, Hollow swarms, Slicing engine, Soul Altar defense,
 * Wave progression, and Bleach HUD overlay.
 */

(function (global) {
  'use strict';

  // Import or alias dependencies from global namespace or require
  let Vector2 = (global.TZ && global.TZ.Vector2);
  let Camera = (global.TZ && global.TZ.Camera);
  let CanvasRenderer = (global.TZ && global.TZ.CanvasRenderer);
  let GameLoop = (global.TZ && global.TZ.GameLoop);
  let ParticleSystem = (global.TZ && global.TZ.ParticleSystem);
  let SpriteGen = (global.TZ && global.TZ.SpriteGen);
  let AudioSynth = (global.TZ && global.TZ.AudioSynth);
  let Katana = (global.TZ && global.TZ.Katana);
  let Slicer = (global.TZ && global.TZ.Slicer);
  let Enemy = (global.TZ && global.TZ.Enemy);
  let EnemyProjectile = (global.TZ && global.TZ.EnemyProjectile) || (Enemy && Enemy.EnemyProjectile);
  let SoulAltar = (global.TZ && global.TZ.SoulAltar);
  let WaveManager = (global.TZ && global.TZ.WaveManager);
  let ScoreManager = (global.TZ && global.TZ.ScoreManager);
  let BackgroundManager = (global.TZ && global.TZ.BackgroundManager);

  if (typeof require !== 'undefined') {
    Vector2 = Vector2 || require('../engine/Vector2.js').Vector2;
    Camera = Camera || require('../engine/Camera.js').Camera;
    CanvasRenderer = CanvasRenderer || require('../engine/CanvasRenderer.js').CanvasRenderer;
    GameLoop = GameLoop || require('../engine/GameLoop.js').GameLoop;
    ParticleSystem = ParticleSystem || require('../engine/ParticleSystem.js').ParticleSystem;
    SpriteGen = SpriteGen || require('../engine/SpriteGen.js').SpriteGen;
    AudioSynth = AudioSynth || require('../engine/AudioSynth.js').AudioSynth;
    BackgroundManager = BackgroundManager || (function () {
      try { return require('../engine/BackgroundManager.js').BackgroundManager; } catch (e) { return null; }
    })();
    Katana = Katana || require('./Katana.js').Katana;
    Slicer = Slicer || require('./Slicer.js').Slicer;
    Enemy = Enemy || require('./Enemy.js').Enemy;
    EnemyProjectile = EnemyProjectile || (Enemy && Enemy.EnemyProjectile) || (function () { try { return require('./Enemy.js').EnemyProjectile; } catch (e) { return null; } })();
    SoulAltar = SoulAltar || require('./SoulAltar.js').SoulAltar;
    WaveManager = WaveManager || require('./WaveManager.js').WaveManager;
    ScoreManager = ScoreManager || require('./ScoreManager.js').ScoreManager;
  }

  class Game {
    /**
     * @param {HTMLCanvasElement|Object} canvas
     * @param {Object} [options={}]
     */
    constructor(canvas, options = {}) {
      this.canvas = canvas || (typeof document !== 'undefined' ? document.getElementById('gameCanvas') : null);
      this.options = options;

      // Subsystems initialization
      this.renderer = new CanvasRenderer(this.canvas, { width: 1280, height: 720 });
      this.camera = new Camera();
      this.particles = new ParticleSystem({ capacity: 1000 });
      this.audio = new AudioSynth();
      this.altar = new SoulAltar(640, 360, {
        particleSystem: this.particles,
        audioSynth: this.audio,
        camera: this.camera
      });
      this.katana = new Katana({
        particleSystem: this.particles,
        audio: this.audio,
        camera: this.camera,
        altarPos: { x: 640, y: 360 }
      });
      this.waves = new WaveManager();
      this.scores = new ScoreManager();
      this.background = BackgroundManager ? new BackgroundManager(1280, 720) : null;

      // Entity storage
      this.enemies = [];
      this.debris = [];
      this.enemyProjectiles = [];
      this.floatingTexts = [];
      this.slashHitEnemies = new Set();

      // Game state machine: 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'VICTORY'
      this.state = 'TITLE';
      this.highScore = this._loadHighScore();

      // Mouse tracking coordinates in virtual canvas space
      this.mousePos = { x: 640, y: 360 };

      // Initialize Sprite Cache
      if (SpriteGen && typeof SpriteGen.initAll === 'function') {
        try { SpriteGen.initAll(); } catch (e) {}
      }

      // GameLoop setup
      this.loop = new GameLoop({
        targetFps: 120,
        update: (dt) => this.update(dt),
        render: (alpha) => this.render(alpha)
      });

      this._bindInputs();
    }

    /**
     * Starts the main game loop animation frame runner.
     */
    start() {
      if (this.loop && !this.loop.isRunning) {
        this.loop.start();
      }
    }

    /**
     * Stops the main game loop animation frame runner.
     */
    stop() {
      if (this.loop && this.loop.isRunning) {
        this.loop.stop();
      }
    }

    /**
     * Binds mouse and keyboard event listeners.
     * @private
     */
    _bindInputs() {
      if (!this.canvas || typeof this.canvas.addEventListener !== 'function') return;

      // Mouse movement
      this.canvas.addEventListener('mousemove', (e) => {
        const vPos = this.renderer.screenToVirtual(e.clientX, e.clientY);
        this.mousePos = vPos;
        this.katana.onMouseMove(vPos.x, vPos.y);
      });

      // Left click: Start game or Forced Senka Slash
      this.canvas.addEventListener('mousedown', (e) => {
        this.audio.unlock();
        if (this.state === 'TITLE') {
          this.startGame();
          return;
        }
        if (this.state === 'GAMEOVER' || this.state === 'VICTORY') {
          this.restart();
          return;
        }
        if (this.state === 'PLAYING') {
          if (e.button === 0) {
            // Left click: Forced Senka Slash
            this.katana.triggerForcedSlash();
          } else if (e.button === 2) {
            // Right click: Ranged Getsuga Tensho Wave
            this._fireGetsugaWave();
          }
        }
      });

      // Prevent context menu on right click
      this.canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
      });

      // Keyboard hotkeys
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('keydown', (e) => {
          this.audio.unlock();
          if (e.code === 'Space') {
            e.preventDefault();
            if (this.state === 'PLAYING') {
              this._fireGetsugaWave();
            } else if (this.state === 'TITLE') {
              this.startGame();
            } else if (this.state === 'GAMEOVER' || this.state === 'VICTORY') {
              this.restart();
            }
          } else if (e.code === 'Enter') {
            e.preventDefault();
            if (this.state === 'TITLE') {
              this.startGame();
            } else if (this.state === 'GAMEOVER' || this.state === 'VICTORY') {
              this.restart();
            }
          } else if (e.key === 'r' || e.key === 'R') {
            if (this.state === 'GAMEOVER' || this.state === 'VICTORY' || this.state === 'PLAYING') {
              this.restart();
            }
          } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            if (this.state === 'PLAYING') {
              this.state = 'PAUSED';
            } else if (this.state === 'PAUSED') {
              this.state = 'PLAYING';
            }
          }
        });
      }
    }

    /**
     * Fires a Kuroi Getsuga Tensho wave toward current blade heading.
     * @private
     */
    _fireGetsugaWave() {
      const tip = this.katana.tip;
      const hilt = this.katana.hilt;
      let dx = tip.x - hilt.x;
      let dy = tip.y - hilt.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;

      this.katana.triggerCrescentWave(hilt.x, hilt.y, dx, dy);
    }

    /**
     * Spawns an enemy of the specified type along the perimeter.
     * @param {string} type
     */
    spawnEnemy(type) {
      // Pick random angle along 1280x720 arena perimeter
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = 780; // Off-screen distance from center
      const spawnX = 640 + Math.cos(angle) * spawnDist;
      const spawnY = 360 + Math.sin(angle) * spawnDist;

      let enemy = null;
      if (type === 'crawler') {
        enemy = Enemy.createCrawler ? Enemy.createCrawler(spawnX, spawnY) : new Enemy('crawler', spawnX, spawnY);
      } else if (type === 'flyer') {
        enemy = Enemy.createFlyer ? Enemy.createFlyer(spawnX, spawnY) : new Enemy('flyer', spawnX, spawnY);
      } else if (type === 'brute') {
        enemy = Enemy.createBrute ? Enemy.createBrute(spawnX, spawnY) : new Enemy('brute', spawnX, spawnY);
      } else if (type === 'menos') {
        enemy = Enemy.createMenos ? Enemy.createMenos(spawnX, spawnY) : new Enemy('menos', spawnX, spawnY);
      } else {
        enemy = new Enemy(type || 'crawler', spawnX, spawnY);
      }

      enemy.audio = this.audio;
      enemy.camera = this.camera;
      enemy.particleSystem = this.particles;

      this.enemies.push(enemy);
    }

    /**
     * Starts the battle from title screen.
     */
    startGame() {
      this.state = 'PLAYING';
      this.restart();
    }

    /**
     * Resets all entities, scores, and altar states for replay.
     */
    restart() {
      this.state = 'PLAYING';
      this.enemies = [];
      this.debris = [];
      this.enemyProjectiles = [];
      this.floatingTexts = [];
      this.slashHitEnemies.clear();
      this.particles.clear();
      this.altar.reset();
      this.waves.reset();
      this.scores.reset();
      if (this.background && typeof this.background.reset === 'function') {
        this.background.reset();
      }
      this.katana.reset ? this.katana.reset() : (this.katana.projectiles = []);
      this.camera.trauma = 0;
    }

    /**
     * Adds an animated floating combat text popup over a target coordinate.
     * @param {number} x
     * @param {number} y
     * @param {string} text
     * @param {string} [color='#ff0033']
     * @param {number} [size=16]
     */
    addFloatingText(x, y, text, color = '#ff0033', size = 16) {
      if (this.floatingTexts.length > 50) {
        this.floatingTexts.shift();
      }
      this.floatingTexts.push({
        x: Number.isFinite(x) ? x : 640,
        y: Number.isFinite(y) ? y : 360,
        text: String(text || ''),
        color: color,
        size: size,
        life: 0.75,
        maxLife: 0.75,
        vy: -45
      });
    }

    /**
     * Loads high score from local storage safely.
     * @private
     */
    _loadHighScore() {
      try {
        const store = typeof localStorage !== 'undefined' ? localStorage : (global.mockLocalStorage || null);
        if (store) {
          const val = store.getItem('tensa_highscore');
          return parseInt(val, 10) || 0;
        }
      } catch (e) {}
      return 0;
    }

    /**
     * Saves high score to local storage safely.
     * @private
     */
    _saveHighScore(score) {
      if (score > this.highScore) {
        this.highScore = score;
        try {
          const store = typeof localStorage !== 'undefined' ? localStorage : (global.mockLocalStorage || null);
          if (store) {
            store.setItem('tensa_highscore', String(score));
          }
        } catch (e) {}
      }
    }

    /**
     * Main update loop (fixed timestep accumulator).
     * @param {number} dt
     */
    update(dt) {
      if (this.state !== 'PLAYING') {
        this.camera.update(dt);
        return;
      }

      // 1. Subsystems update
      this.camera.update(dt);
      this.katana.update(dt, { x: 640, y: 360 });
      this.altar.update(dt);
      this.scores.update(dt);
      this.particles.update(dt);
      if (this.background && typeof this.background.update === 'function') {
        this.background.update(dt);
      }

      // 2. Wave manager update & Spawning
      this.waves.update(dt, this.enemies, (type) => this.spawnEnemy(type));

      // 3. Combat & Slicing Resolution
      this._resolveCombat(dt);

      // 4. Enemy Movement & Altar Collision
      this._updateEnemies(dt);

      // 4.5. Enemy Projectiles
      this._updateEnemyProjectiles(dt);

      // 5. Debris Physics & Dissolution
      this._updateDebris(dt);

      // 6. Floating Combat Texts
      this._updateFloatingTexts(dt);

      // 7. Wave Clear Check
      if (this.waves.isWaveComplete(this.enemies)) {
        if (this.waves.isFinalWave && this.waves.isFinalWave()) {
          this.state = 'VICTORY';
          this._saveHighScore(this.scores.score);
          if (this.audio && typeof this.audio.playVictory === 'function') {
            this.audio.playVictory();
          }
          this.addFloatingText(640, 320, 'CAMPAIGN COMPLETE! VICTORY!', '#facc15', 30);
        } else {
          this.altar.restoreHealth(15);
          this.waves.nextWave();
          if (this.background && typeof this.background.onWaveChange === 'function') {
            this.background.onWaveChange(this.waves.currentWave);
          }
          this.addFloatingText(640, 320, 'WAVE CLEAR! +15 HP RESTORED', '#00e5ff', 20);
        }
      }

      // 8. Defeat Condition
      if (this.altar.isDestroyed()) {
        this.state = 'GAMEOVER';
        this._saveHighScore(this.scores.score);
        this.audio.playGameOver();
      }
    }

    /**
     * Updates floating combat texts.
     * @private
     */
    _updateFloatingTexts(dt) {
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.life -= dt;
        ft.y += ft.vy * dt;
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }
    }

    /**
     * Resolves blade slashing, SweptQuad CCD, and projectile collisions.
     * @private
     */
    _resolveCombat(dt) {
      const isSlashing = this.katana.isSlashing();
      const bladeQuad = this.katana.getSweptQuad();
      let cleaveCount = 0;

      // Reset hit tracking if not slashing
      if (!isSlashing) {
        this.slashHitEnemies.clear();
      }

      // Process blade hits
      if (isSlashing && bladeQuad) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const enemy = this.enemies[i];
          if (!enemy || enemy.isDead || this.slashHitEnemies.has(enemy)) continue;

          // Check swept quad intersection with enemy circle
          if (bladeQuad.intersectsCircle({ x: enemy.x, y: enemy.y }, enemy.radius)) {
            this.slashHitEnemies.add(enemy);

            const cutAngle = Math.atan2(this.katana.tip.y - this.katana.hilt.y, this.katana.tip.x - this.katana.hilt.x);
            const cutNormal = Slicer.computeCutNormal ? Slicer.computeCutNormal(cutAngle) : { x: -Math.sin(cutAngle), y: Math.cos(cutAngle) };
            const swingVel = { x: Math.cos(cutAngle) * this.katana.speed, y: Math.sin(cutAngle) * this.katana.speed };

            // Check enemy hit response
            const hitResult = enemy.onHit(50, cutNormal, cutAngle, this.katana.speed);

            if (enemy.isDead || hitResult.bisect) {
              // Bisection Slicing Execution
              const halves = Slicer.sliceEnemy(enemy, { x: enemy.x, y: enemy.y }, cutAngle, this.katana.speed, swingVel);
              if (Array.isArray(halves)) {
                this.debris.push(...halves);
              }

              this.particles.spawnEmbers(enemy.x, enemy.y, 14, cutAngle, '#ff0033');
              this.particles.spawnShards(enemy.x, enemy.y, 6, cutAngle);
              this.camera.addTrauma(enemy.type === 'menos' ? 0.5 : 0.12);
              this.audio.playHollowDeath(enemy.type);

              const pts = this.scores.addScore(enemy.type);
              if (this.scores.combo > 1) {
                this.addFloatingText(enemy.x, enemy.y - 12, `+${pts} COMBO x${this.scores.combo}!`, '#ff0033', 15);
              } else {
                this.addFloatingText(enemy.x, enemy.y - 12, `SLASH! +${pts}`, '#ffffff', 14);
              }

              cleaveCount++;
              this.enemies.splice(i, 1);
            } else {
              // Carapace ricochet
              this.audio.playClash();
              this.particles.spawnEmbers(enemy.x, enemy.y, 8, cutAngle, '#ffffff');
              this.camera.addTrauma(0.08);
              this.addFloatingText(enemy.x, enemy.y - 10, 'BLOCKED! SWING FASTER!', '#a1a1aa', 12);
            }
          }
        }

        if (cleaveCount > 1) {
          const bonus = this.scores.addCleaveBonus(cleaveCount);
          this.addFloatingText(this.katana.hilt.x, this.katana.hilt.y - 25, `CLEAVE x${cleaveCount}! +${bonus}`, '#eab308', 18);
        }
      }

      // Process Getsuga Wave projectiles collisions
      const projectiles = this.katana.projectiles;
      for (let pIdx = projectiles.length - 1; pIdx >= 0; pIdx--) {
        const wave = projectiles[pIdx];
        if (!wave || wave.isDead) continue;

        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const enemy = this.enemies[eIdx];
          if (!enemy || enemy.isDead) continue;

          if (wave.checkHit && wave.checkHit(enemy)) {
            const cutAngle = Math.atan2(wave.vy, wave.vx);
            const cutNormal = { x: -Math.sin(cutAngle), y: Math.cos(cutAngle) };
            const swingVel = { x: wave.vx, y: wave.vy };

            const hitResult = enemy.onHit(75, cutNormal, cutAngle, 820);
            if (enemy.isDead || hitResult.bisect) {
              const halves = Slicer.sliceEnemy(enemy, { x: enemy.x, y: enemy.y }, cutAngle, 820, swingVel);
              if (Array.isArray(halves)) {
                this.debris.push(...halves);
              }
              this.particles.spawnEmbers(enemy.x, enemy.y, 16, cutAngle, '#000000');
              this.particles.spawnSmoke(enemy.x, enemy.y, 8, '#0a0a0c');
              const pts = this.scores.addScore(enemy.type);
              this.addFloatingText(enemy.x, enemy.y - 12, `GETSUGA! +${pts}`, '#00e5ff', 16);
              this.audio.playHollowDeath(enemy.type);
              this.enemies.splice(eIdx, 1);
            }
          }
        }
      }

      // Check Cero Beam deflection against Menos Grande
      for (let i = 0; i < this.enemies.length; i++) {
        const enemy = this.enemies[i];
        if (enemy && enemy.type === 'menos' && (enemy.state === 'CERO' || enemy.state === 'FIRE')) {
          if (this.katana.canDeflectCero()) {
            if (enemy.checkBladeDeflection && enemy.checkBladeDeflection(this.katana)) {
              this.audio.playClash();
              this.camera.addTrauma(0.35);
              this.particles.spawnEmbers(this.katana.hilt.x, this.katana.hilt.y, 30, 0, '#ffffff');
              this.addFloatingText(this.katana.hilt.x, this.katana.hilt.y - 30, 'CERO DEFLECTED!', '#00e5ff', 20);
            }
          }
        }
      }
    }

    /**
     * Updates active enemies, flocking, and Altar breaches.
     * @private
     */
    _updateEnemies(dt) {
      const altarPos = { x: this.altar.x, y: this.altar.y };
      const altarRadius = this.altar.radius;
      let totalBatchDamage = 0;

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (!enemy || enemy.isDead) {
          this.enemies.splice(i, 1);
          continue;
        }

        // Apply flocking separation among neighbors
        if (typeof enemy.applySeparation === 'function') {
          enemy.applySeparation(this.enemies);
        }

        // Reactive evasion twitch against blade tip for flyers
        if (typeof enemy.evadeBlade === 'function') {
          enemy.evadeBlade(this.katana.tip, this.katana.speed);
        }

        // Update enemy AI position
        const updateRes = enemy.update(dt, altarPos, this.katana);
        if (updateRes && updateRes.spawnProjectile && EnemyProjectile) {
          const sp = updateRes.spawnProjectile;
          const proj = new EnemyProjectile(sp.x, sp.y, sp.targetX, sp.targetY, sp.type, { particleSystem: this.particles });
          this.enemyProjectiles.push(proj);
        }

        // Check if enemy touched Soul Altar
        const dx = enemy.x - altarPos.x;
        const dy = enemy.y - altarPos.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= altarRadius + enemy.radius) {
          const dmg = enemy.altarDamage || (enemy.type === 'brute' ? 25 : (enemy.type === 'flyer' ? 12 : 8));
          totalBatchDamage += dmg;
          this.particles.spawnSmoke(enemy.x, enemy.y, 10, '#3f3f46');
          this.enemies.splice(i, 1);
        }
      }

      if (totalBatchDamage > 0) {
        this.altar.takeBatchDamage(totalBatchDamage);
      }
    }

    /**
     * Updates enemy projectiles (Hadō #31 Shakkahō & Arrancar Bala),
     * checks Altar collision, and handles blade deflection.
     * @private
     */
    _updateEnemyProjectiles(dt) {
      const isSlashing = this.katana.isSlashing();
      const bladeQuad = this.katana.getSweptQuad();
      const getsugaWaves = this.katana.projectiles || [];

      for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
        const p = this.enemyProjectiles[i];
        if (!p || p.isDead) {
          this.enemyProjectiles.splice(i, 1);
          continue;
        }

        // Update movement and Altar breach
        const res = p.update(dt, this.altar);
        if (res && res.hitAltar) {
          this.altar.takeDamage(res.damage);
          this.camera.addTrauma(0.20);
          this.audio.playAltarHit();
          this.addFloatingText(this.altar.x, this.altar.y - 20, `-${res.damage} HP!`, '#ef4444', 16);
          this.enemyProjectiles.splice(i, 1);
          continue;
        }

        // Blade slice deflection
        if (isSlashing && bladeQuad && bladeQuad.intersectsCircle({ x: p.x, y: p.y }, p.radius)) {
          p.isDead = true;
          const sparkColor = (p.type === 'shakkaho') ? '#ef4444' : '#10b981';
          this.particles.spawnEmbers(p.x, p.y, 10, 0, sparkColor);
          this.audio.playClash();
          this.scores.score += 50;
          this.addFloatingText(p.x, p.y - 12, 'DEFLECTED! +50', '#38bdf8', 14);
          this.enemyProjectiles.splice(i, 1);
          continue;
        }

        // Kuroi Getsuga wave collision
        for (let j = 0; j < getsugaWaves.length; j++) {
          const wave = getsugaWaves[j];
          if (wave && !wave.isDead && typeof wave.intersectsCircle === 'function') {
            if (wave.intersectsCircle({ x: p.x, y: p.y }, p.radius)) {
              p.isDead = true;
              this.particles.spawnEmbers(p.x, p.y, 10, 0, '#ffffff');
              this.scores.score += 50;
              this.addFloatingText(p.x, p.y - 12, 'OBLITERATED! +50', '#ff0033', 14);
              this.enemyProjectiles.splice(i, 1);
              break;
            }
          }
        }
      }
    }

    /**
     * Updates severed debris physics, friction, and alpha dissolution.
     * @private
     */
    _updateDebris(dt) {
      for (let i = this.debris.length - 1; i >= 0; i--) {
        const d = this.debris[i];
        if (!d) {
          this.debris.splice(i, 1);
          continue;
        }

        if (typeof d.update === 'function') {
          d.update(dt);
          if (d.isDead) {
            this.debris.splice(i, 1);
          }
        } else {
          // Fallback debris update
          d.x = (d.x || 0) + (d.vx || 0) * dt;
          d.y = (d.y || 0) + (d.vy || 0) * dt;
          d.vx = (d.vx || 0) * Math.pow(0.94, dt * 60);
          d.vy = (d.vy || 0) * Math.pow(0.94, dt * 60);
          d.rot = (d.rot || 0) + (d.rotSpeed || 5) * dt;
          d.life = (d.life || 0.85) - dt;
          d.alpha = Math.max(0, d.life / 0.85);
          if (d.life <= 0) {
            this.debris.splice(i, 1);
          }
        }
      }
    }

    /**
     * Master render pipeline with layers and HUD overlays.
     * @param {number} alpha
     */
    render(alpha) {
      const ctx = this.renderer.ctx || (typeof this.renderer.getContext === 'function' ? this.renderer.getContext() : null);
      if (!ctx) return;

      // Layer 1: Background & Arena
      if (this.background && typeof this.background.draw === 'function') {
        this.background.draw(ctx);
      } else {
        this.renderer.clear('#09090b');
        this._drawArenaBackground(ctx);
      }

      // Layer 2: World entities wrapped in camera trauma shake
      this.camera.shake(ctx, () => {
        // Altar in center
        this.altar.draw(ctx, SpriteGen);

        // Severed Debris
        for (let i = 0; i < this.debris.length; i++) {
          const d = this.debris[i];
          if (typeof d.draw === 'function') {
            d.draw(ctx);
          } else {
            this._drawFallbackDebris(ctx, d);
          }
        }

        // Active Enemies
        for (let i = 0; i < this.enemies.length; i++) {
          this.enemies[i].draw(ctx, SpriteGen);
        }

        // Projectiles (Kuroi Getsuga crescent waves)
        const projectiles = this.katana.projectiles;
        for (let i = 0; i < projectiles.length; i++) {
          projectiles[i].draw(ctx);
        }

        // Enemy Projectiles (Hadō #31 & Bala)
        for (let i = 0; i < this.enemyProjectiles.length; i++) {
          this.enemyProjectiles[i].draw(ctx);
        }

        // Particles
        this.particles.draw(ctx);

        // Floating Combat Texts
        for (let i = 0; i < this.floatingTexts.length; i++) {
          const ft = this.floatingTexts[i];
          const alpha = Math.max(0, ft.life / ft.maxLife);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = `bold ${ft.size}px "Courier New", monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = ft.color;
          ctx.shadowColor = ft.color;
          ctx.shadowBlur = 8;
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.restore();
        }

        // Katana (Getsuga ribbon trail, black blade, hilt, Verlet tassel)
        this.katana.draw(ctx);
      });

      // Layer 3: HUD and UI overlays
      this._drawHUD(ctx);

      // Layer 3.5: Cinematic Chapter Banner
      if (this.background && typeof this.background.drawBanner === 'function') {
        this.background.drawBanner(ctx);
      }
    }

    /**
     * Draws dark Soul Society stone pavement and spiritual circle.
     * @private
     */
    _drawArenaBackground(ctx) {
      ctx.save();
      // Subtle grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      const gridSize = 64;
      for (let x = 0; x <= 1280; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 720);
        ctx.stroke();
      }
      for (let y = 0; y <= 720; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1280, y);
        ctx.stroke();
      }

      // Sanctuary perimeter boundary ring
      ctx.beginPath();
      ctx.arc(640, 360, 280, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.stroke();

      ctx.restore();
    }

    /**
     * Fallback debris drawing.
     * @private
     */
    _drawFallbackDebris(ctx, d) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot || 0);
      ctx.globalAlpha = d.alpha !== undefined ? d.alpha : 1.0;
      ctx.fillStyle = '#be123c';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI);
      ctx.fill();
      ctx.restore();
    }

    /**
     * Draws Bleach-themed arcade HUD overlay.
     * @private
     */
    _drawHUD(ctx) {
      ctx.save();

      // Top Left: Soul Altar HP Bar
      const hp = this.altar.hp;
      const hpRatio = Math.max(0, hp / 100);
      const state = this.altar.getState();

      let barColor = '#00e5ff'; // Intact Cyan
      if (state === 'DAMAGED') barColor = '#eab308'; // Amber
      if (state === 'CRITICAL') barColor = '#ef4444'; // Red

      // HP Bar Frame
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 2;
      ctx.fillRect(30, 25, 260, 24);
      ctx.strokeRect(30, 25, 260, 24);

      // HP Bar Fill
      ctx.fillStyle = barColor;
      ctx.fillRect(32, 27, 256 * hpRatio, 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.fillText(`SOUL ALTAR HP: ${Math.round(hp)} / 100`, 36, 41);

      // Top Center: Wave & Enemies Remaining
      const totalWave = this.waves.calculateEnemyCount(this.waves.currentWave);
      const remaining = Math.max(0, totalWave - this.waves.spawnedInWave) + this.enemies.length;
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(`WAVE ${this.waves.currentWave}`, 640, 36);

      ctx.font = '12px "Courier New", monospace';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText(`HOLLOWS REMAINING: ${remaining}`, 640, 56);

      // Top Right: Score & High Score
      ctx.textAlign = 'right';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`SCORE: ${this.scores.score}`, 1250, 38);

      ctx.font = '12px "Courier New", monospace';
      ctx.fillStyle = '#eab308';
      ctx.fillText(`HIGH SCORE: ${Math.max(this.highScore, this.scores.score)}`, 1250, 56);

      // Bottom Right: Combo Meter & Rank Title
      if (this.scores.combo > 0) {
        ctx.textAlign = 'right';
        const rank = this.scores.getRankTitle();
        const mult = this.scores.getMultiplier();

        ctx.font = 'bold 28px "Courier New", monospace';
        ctx.fillStyle = '#ff0033';
        ctx.fillText(`COMBO x${this.scores.combo}`, 1250, 660);

        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`[ ${rank} ]  ${mult.toFixed(1)}x`, 1250, 686);

        // Combo decay bar
        const timerRatio = Math.max(0, this.scores.comboTimer / this.scores.comboDuration);
        ctx.fillStyle = 'rgba(255, 0, 51, 0.4)';
        ctx.fillRect(1050, 694, 200 * timerRatio, 4);
      }

      // Bottom Left: Reiatsu / Getsuga Wave Gauge
      ctx.textAlign = 'left';
      const waveGauge = this.katana.crescentCooldownTimer <= 0
        ? 1.0
        : Math.max(0, 1.0 - (this.katana.crescentCooldownTimer / this.katana.crescentCooldown));

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(30, 665, 180, 16);
      ctx.strokeRect(30, 665, 180, 16);

      ctx.fillStyle = waveGauge >= 1.0 ? '#ef4444' : '#52525b';
      ctx.fillRect(32, 667, 176 * waveGauge, 12);

      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(waveGauge >= 1.0 ? 'GETSUGA: READY [R-CLICK]' : 'CHARGING REIATSU...', 36, 677);

      // Modal Overlays for TITLE, PAUSED, GAMEOVER, and VICTORY
      if (this.state === 'TITLE') {
        this._drawTitleScreen(ctx);
      } else if (this.state === 'PAUSED') {
        this._drawPauseScreen(ctx);
      } else if (this.state === 'GAMEOVER') {
        this._drawGameOverScreen(ctx);
      } else if (this.state === 'VICTORY') {
        this._drawVictoryScreen(ctx);
      }

      ctx.restore();
    }

    /**
     * Draws gothic Title screen overlay.
     * @private
     */
    _drawTitleScreen(ctx) {
      ctx.fillStyle = 'rgba(9, 9, 11, 0.88)';
      ctx.fillRect(0, 0, 1280, 720);

      ctx.textAlign = 'center';
      ctx.font = 'bold 44px "Courier New", monospace';
      ctx.fillStyle = '#ff0033';
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 15;
      ctx.fillText('TENSA ZANGETSU', 640, 240);
      ctx.shadowBlur = 0;

      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('SOUL ALTAR DEFENSE', 640, 285);

      ctx.font = '14px "Courier New", monospace';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText('Move Mouse: Swing Blade  |  L-Click: Senka Slash  |  R-Click / Space: Kuroi Getsuga', 640, 370);
      ctx.fillText('Slice incoming Hollow armies and deflect Menos Grande Cero blasts to protect the Altar.', 640, 400);

      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = '#00e5ff';
      const blink = Math.sin(Date.now() * 0.006) > 0;
      if (blink) {
        ctx.fillText('[ CLICK OR PRESS SPACE TO BANKAI ]', 640, 490);
      }
    }

    /**
     * Draws Pause screen overlay.
     * @private
     */
    _drawPauseScreen(ctx) {
      ctx.fillStyle = 'rgba(9, 9, 11, 0.75)';
      ctx.fillRect(0, 0, 1280, 720);

      ctx.textAlign = 'center';
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('PAUSED', 640, 340);

      ctx.font = '16px "Courier New", monospace';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText('Press [P] or [ESC] to Resume', 640, 390);
    }

    /**
     * Draws Game Over modal with score summary and replay trigger.
     * @private
     */
    _drawGameOverScreen(ctx) {
      ctx.fillStyle = 'rgba(9, 9, 11, 0.92)';
      ctx.fillRect(0, 0, 1280, 720);

      ctx.textAlign = 'center';
      ctx.font = 'bold 48px "Courier New", monospace';
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20;
      ctx.fillText('THE SOUL ALTAR HAS FALLEN', 640, 220);
      ctx.shadowBlur = 0;

      ctx.font = '16px "Courier New", monospace';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText('The spiritual barrier collapsed under the Hollow onslaught.', 640, 265);

      // Score Summary Box
      ctx.fillStyle = 'rgba(24, 24, 27, 0.8)';
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 2;
      ctx.fillRect(440, 300, 400, 180);
      ctx.strokeRect(440, 300, 400, 180);

      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`FINAL SCORE: ${this.scores.score}`, 640, 345);

      ctx.font = '14px "Courier New", monospace';
      ctx.fillStyle = '#eab308';
      ctx.fillText(`HIGH SCORE: ${Math.max(this.highScore, this.scores.score)}`, 640, 375);

      ctx.fillStyle = '#a1a1aa';
      ctx.fillText(`HOLLOWS PURIFIED: ${this.scores.kills}`, 640, 405);
      ctx.fillText(`MAX COMBO: ${this.scores.maxCombo}  |  TIME: ${Math.floor(this.scores.survivalTime)}s`, 640, 435);

      // Replay Action
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = '#00e5ff';
      const blink = Math.sin(Date.now() * 0.007) > 0;
      if (blink) {
        ctx.fillText('[ CLICK OR PRESS [R] TO RETRY ]', 640, 540);
      }
    }

    /**
     * Draws Victory screen modal upon completing all 10 story waves.
     * @private
     */
    _drawVictoryScreen(ctx) {
      ctx.fillStyle = 'rgba(8, 7, 18, 0.94)';
      ctx.fillRect(0, 0, 1280, 720);

      // Golden spiritual victory kanji
      ctx.textAlign = 'center';
      ctx.font = 'bold 44px serif';
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 18;
      ctx.fillText('完 全 勝 利', 640, 160);
      ctx.shadowBlur = 0;

      // Header
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 14;
      ctx.fillText('VICTORY: SOUL SOCIETY SAVED', 640, 215);
      ctx.shadowBlur = 0;

      // Subheader narrative
      ctx.font = '15px "Courier New", monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('All 10 Waves Repelled • The Tenkaiketchu Barriers Stand Firm', 640, 250);

      // Rank calculation based on remaining altar integrity & max combo
      const hpRatio = this.altar ? (this.altar.hp / this.altar.maxHp) : 1;
      let rank = 'C';
      let rankColor = '#94a3b8';
      if (hpRatio >= 0.8 && this.scores.maxCombo >= 20) {
        rank = 'S';
        rankColor = '#facc15'; // Gold
      } else if (hpRatio >= 0.5 && this.scores.maxCombo >= 10) {
        rank = 'A';
        rankColor = '#00e5ff'; // Cyan
      } else if (hpRatio >= 0.2) {
        rank = 'B';
        rankColor = '#4ade80'; // Emerald
      }

      // Statistics Card
      ctx.fillStyle = 'rgba(23, 21, 39, 0.88)';
      ctx.strokeStyle = rankColor;
      ctx.lineWidth = 2;
      ctx.fillRect(380, 280, 520, 240);
      ctx.strokeRect(380, 280, 520, 240);

      // Rank Display
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = rankColor;
      ctx.shadowColor = rankColor;
      ctx.shadowBlur = 10;
      ctx.fillText(`COMBAT RANK: ${rank}`, 640, 330);
      ctx.shadowBlur = 0;

      // Score and highscore
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`FINAL SCORE: ${this.scores.score}`, 640, 370);

      ctx.font = '14px "Courier New", monospace';
      ctx.fillStyle = '#eab308';
      ctx.fillText(`HIGH SCORE: ${Math.max(this.highScore, this.scores.score)}`, 640, 400);

      // Timing and stats
      ctx.fillStyle = '#94a3b8';
      const mins = Math.floor(this.scores.survivalTime / 60);
      const secs = Math.floor(this.scores.survivalTime % 60);
      const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      ctx.fillText(`CLEAR TIME: ${timeStr}  |  MAX COMBO: ${this.scores.maxCombo}x`, 640, 435);
      ctx.fillText(`FOES BISECTED: ${this.scores.kills}  |  ALTAR INTEGRITY: ${Math.round(hpRatio * 100)}%`, 640, 465);

      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('BANKAI TRANSCENDENCE ACHIEVED', 640, 495);

      // Replay Action
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = '#00e5ff';
      const blink = Math.sin(Date.now() * 0.007) > 0;
      if (blink) {
        ctx.fillText('[ CLICK OR PRESS SPACE / ENTER TO PLAY AGAIN ]', 640, 580);
      }
    }
  }

  // Universal Module Export
  global.TZ = global.TZ || {};
  global.TZ.Game = Game;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Game };
  }
})(typeof window !== 'undefined' ? window : global);
