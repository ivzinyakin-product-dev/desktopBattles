/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/engine/BackgroundManager.js
 * 
 * Procedural narrative background renderer across 7 Bleach story arcs:
 * 1. Karakura Town (Waves 1-3)
 * 2. Rukongai Outskirts (Waves 4-6)
 * 3. Seireitei Infiltration (Waves 7-9)
 * 4. The Sōkyoku Hill (Waves 10-12)
 * 5. Hueco Mundo White Dunes (Waves 13-15)
 * 6. Las Noches Palace (Waves 16-19)
 * 7. Fake Karakura Town (Waves 20+)
 * 
 * Features:
 * - 100% procedural Canvas 2D rasterization cached on OffscreenCanvas (Zero external assets)
 * - Smooth inter-arc cross-fade transitions
 * - Cinematic anime chapter banners with Japanese Kanji & Russian titles
 * - Biome-specific ambient spiritual micro-particles
 * - Zero external dependencies. Universal Modular Pattern (Browser & Node.js).
 */

(function (global) {
  'use strict';

  const LOCATIONS = {
    karakura: {
      id: 'karakura',
      name: 'Город Каракура',
      kanji: '空座町',
      title: 'АРКА I: ГОРОД КАРАКУРА',
      desc: 'Защита живых от первого вторжения Пустых',
      accentColor: '#f59e0b',
      bgColor: '#0b0c12'
    },
    rukongai: {
      id: 'rukongai',
      name: 'Окраины Руконгая',
      kanji: '流魂街',
      title: 'АРКА II: ОКРАИНЫ РУКОНГАЯ',
      desc: 'Врата Белых Путей и падение духовного барьера',
      accentColor: '#ea580c',
      bgColor: '#1a140f'
    },
    seireitei: {
      id: 'seireitei',
      name: 'Крепость Сейрейтей',
      kanji: '瀞霊廷',
      title: 'АРКА III: КРЕПОСТЬ СЕЙРЕЙТЕЙ',
      desc: 'Проникновение в цитадель Готей 13',
      accentColor: '#38bdf8',
      bgColor: '#121620'
    },
    sokyoku: {
      id: 'sokyoku',
      name: 'Холм Сокёку',
      kanji: '双殛の丘',
      title: 'АРКА IV: ХОЛМ КАЗНИ СОКЁКУ',
      desc: 'Освобождение Банкая Тэнса Зангецу',
      accentColor: '#ef4444',
      bgColor: '#170c0d'
    },
    huecomundo: {
      id: 'huecomundo',
      name: 'Бескрайние Дюны Уэко Мундо',
      kanji: '虚圏',
      title: 'АРКА V: БЕСКРАЙНИЕ ДЮНЫ УЭКО МУНДО',
      desc: 'Экспедиция в мир вечной ночи Пустых',
      accentColor: '#e2e8f0',
      bgColor: '#060609'
    },
    lasnoches: {
      id: 'lasnoches',
      name: 'Дворец Лас Ночес',
      kanji: '虚夜宮',
      title: 'АРКА VI: ДВОРЕЦ ЛАС НОЧЕС',
      desc: 'Тронные залы и колоннады Эспады',
      accentColor: '#00e5ff',
      bgColor: '#0f1219'
    },
    fakekarakura: {
      id: 'fakekarakura',
      name: 'Фальшивая Каракура',
      kanji: '転界結柱',
      title: 'ФИНАЛ: ФАЛЬШИВАЯ КАРАКУРА',
      desc: 'Столпы Тэнкайкэцу и разломы Гарганты',
      accentColor: '#a855f7',
      bgColor: '#0d0a14'
    }
  };

  /**
   * Helper to create offscreen canvas across browser, Node.js and mock environments.
   * @private
   */
  function createOffscreen(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') {
      try { return new OffscreenCanvas(width, height); } catch (e) {}
    }
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      return c;
    }
    if (global.TZ && global.TZ.MockCanvas) {
      return new global.TZ.MockCanvas(width, height);
    }
    return {
      width,
      height,
      getContext: () => ({
        save() {}, restore() {}, beginPath() {}, closePath() {},
        moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {},
        fillRect() {}, strokeRect() {}, clearRect() {}, drawImage() {},
        fillText() {}, strokeText() {}, measureText: () => ({ width: 50 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} })
      })
    };
  }

  class BackgroundManager {
    /**
     * @param {number} [width=1280]
     * @param {number} [height=720]
     */
    constructor(width = 1280, height = 720) {
      this.width = width;
      this.height = height;

      // Location tracking
      this.currentLocationKey = 'karakura';
      this.targetLocationKey = 'karakura';

      // Smooth cross-fade transition state
      this.transitionProgress = 1.0; // 1.0 = fully settled on target
      this.transitionDuration = 1.5; // seconds

      // Chapter banner announcement state
      this.bannerTimer = 0;
      this.bannerMaxDuration = 2.8;
      this.bannerLocation = LOCATIONS.karakura;

      // Offscreen canvas cache for all 7 locations
      this.cache = {};

      // Ambient spiritual particles pool (45 persistent particles)
      this.ambientParticles = [];
      this.maxAmbient = 45;

      this._initAllCanvases();
      this._initAmbientParticles();

      // Trigger initial chapter banner for Wave 1
      this.triggerBanner('karakura');
    }

    /**
     * Maps wave index to Bleach narrative story location.
     * @param {number} wave
     * @returns {string} Location key
     */
    getLocationForWave(wave) {
      const w = Math.max(1, typeof wave === 'number' ? Math.floor(wave) : 1);
      if (w <= 3) return 'karakura';
      if (w <= 6) return 'rukongai';
      if (w <= 9) return 'seireitei';
      if (w <= 12) return 'sokyoku';
      if (w <= 15) return 'huecomundo';
      if (w <= 19) return 'lasnoches';
      return 'fakekarakura';
    }

    /**
     * Called by Game coordinator when wave advances.
     * @param {number} newWave
     */
    onWaveChange(newWave) {
      const newLocKey = this.getLocationForWave(newWave);
      if (newLocKey !== this.targetLocationKey) {
        this.transitionTo(newLocKey);
      }
    }

    /**
     * Initiates smooth transition to a new location.
     * @param {string} locKey
     */
    transitionTo(locKey) {
      if (!LOCATIONS[locKey]) return;
      if (locKey === this.targetLocationKey && this.transitionProgress >= 1.0) return;

      this.currentLocationKey = this.targetLocationKey;
      this.targetLocationKey = locKey;
      this.transitionProgress = 0.0;
      this.triggerBanner(locKey);
      this._rethemeAmbientParticles(locKey);
    }

    /**
     * Triggers cinematic chapter banner.
     * @param {string} locKey
     */
    triggerBanner(locKey) {
      const meta = LOCATIONS[locKey] || LOCATIONS.karakura;
      this.bannerLocation = meta;
      this.bannerTimer = this.bannerMaxDuration;
    }

    /**
     * Resets location back to Karakura Town for replay.
     */
    reset() {
      this.currentLocationKey = 'karakura';
      this.targetLocationKey = 'karakura';
      this.transitionProgress = 1.0;
      this._rethemeAmbientParticles('karakura');
      this.triggerBanner('karakura');
    }

    /**
     * Updates transitions, banners, and ambient particles.
     * @param {number} dt
     */
    update(dt) {
      if (typeof dt !== 'number' || dt <= 0) return;

      // Progress cross-fade transition
      if (this.transitionProgress < 1.0) {
        this.transitionProgress = Math.min(1.0, this.transitionProgress + dt / this.transitionDuration);
        if (this.transitionProgress >= 1.0) {
          this.currentLocationKey = this.targetLocationKey;
        }
      }

      // Progress chapter banner
      if (this.bannerTimer > 0) {
        this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      }

      // Update ambient particles
      this._updateAmbientParticles(dt);
    }

    /**
     * Main background drawing pass (Layer 1).
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
      if (!ctx) return;
      ctx.save();

      const currentCanvas = this.cache[this.currentLocationKey];
      const targetCanvas = this.cache[this.targetLocationKey];

      if (this.transitionProgress >= 1.0 || !targetCanvas) {
        // Steady state
        if (currentCanvas && typeof ctx.drawImage === 'function') {
          ctx.drawImage(currentCanvas, 0, 0, this.width, this.height);
        } else {
          ctx.fillStyle = (LOCATIONS[this.currentLocationKey] || {}).bgColor || '#0b0c12';
          ctx.fillRect(0, 0, this.width, this.height);
        }
      } else {
        // Cross-fade blend
        if (currentCanvas && typeof ctx.drawImage === 'function') {
          ctx.drawImage(currentCanvas, 0, 0, this.width, this.height);
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, this.transitionProgress));
        if (targetCanvas && typeof ctx.drawImage === 'function') {
          ctx.drawImage(targetCanvas, 0, 0, this.width, this.height);
        }
      }

      ctx.restore();

      // Draw ambient spiritual micro-particles under entities
      this._drawAmbientParticles(ctx);
    }

    /**
     * Draws cinematic chapter banner overlay above entities.
     * @param {CanvasRenderingContext2D} ctx
     */
    drawBanner(ctx) {
      if (!ctx || this.bannerTimer <= 0) return;

      const elapsed = this.bannerMaxDuration - this.bannerTimer;
      let alpha = 1.0;

      // 0.4s fade-in, 2.0s hold, 0.4s fade-out
      if (elapsed < 0.4) {
        alpha = elapsed / 0.4;
      } else if (this.bannerTimer < 0.4) {
        alpha = this.bannerTimer / 0.4;
      }

      alpha = Math.max(0, Math.min(1.0, alpha));
      const meta = this.bannerLocation;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Dark cinematic letterbox band across center
      ctx.fillStyle = 'rgba(7, 7, 10, 0.88)';
      ctx.fillRect(0, 240, this.width, 110);

      // Accent border glow lines
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = meta.accentColor;
      ctx.shadowColor = meta.accentColor;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(0, 240);
      ctx.lineTo(this.width, 240);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 350);
      ctx.lineTo(this.width, 350);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Japanese Kanji watermark / subtitle
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillStyle = meta.accentColor;
      ctx.fillText(`— [ ${meta.kanji} ] —`, this.width / 2, 268);

      // Main Chapter Arc Title
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = meta.accentColor;
      ctx.shadowBlur = 10;
      ctx.fillText(meta.title, this.width / 2, 302);
      ctx.shadowBlur = 0;

      // Subtitle narrative description
      ctx.font = 'italic 13px "Courier New", monospace';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText(meta.desc, this.width / 2, 330);

      ctx.restore();
    }

    // ========================================================================
    // Ambient Particle Simulation
    // ========================================================================

    /**
     * Initializes ambient particle pool.
     * @private
     */
    _initAmbientParticles() {
      this.ambientParticles = [];
      for (let i = 0; i < this.maxAmbient; i++) {
        this.ambientParticles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 15,
          vy: (Math.random() - 0.5) * 15,
          size: 1 + Math.random() * 2,
          alpha: 0.2 + Math.random() * 0.5,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 1 + Math.random() * 2,
          color: '#f59e0b'
        });
      }
      this._rethemeAmbientParticles(this.targetLocationKey);
    }

    /**
     * Rethemes particle colors and velocities based on biome.
     * @private
     */
    _rethemeAmbientParticles(locKey) {
      const meta = LOCATIONS[locKey] || LOCATIONS.karakura;
      for (let i = 0; i < this.ambientParticles.length; i++) {
        const p = this.ambientParticles[i];
        p.color = meta.accentColor;

        if (locKey === 'karakura') {
          p.vx = (Math.random() - 0.5) * 12;
          p.vy = -5 - Math.random() * 10; // Slow upward city air
        } else if (locKey === 'rukongai') {
          p.vx = 20 + Math.random() * 25; // Earthen wind blowing right
          p.vy = (Math.random() - 0.5) * 8;
        } else if (locKey === 'seireitei') {
          p.vx = (Math.random() - 0.5) * 8;
          p.vy = -12 - Math.random() * 15; // Rising reishi motes
        } else if (locKey === 'sokyoku') {
          p.vx = (Math.random() - 0.5) * 25;
          p.vy = -20 - Math.random() * 30; // Turbulent rising fire embers
        } else if (locKey === 'huecomundo') {
          p.vx = (Math.random() - 0.5) * 10;
          p.vy = 12 + Math.random() * 18; // Gently falling white quartz snow
        } else if (locKey === 'lasnoches') {
          p.vx = (Math.random() - 0.5) * 6;
          p.vy = (Math.random() - 0.5) * 6; // Still indoor palace motes
        } else if (locKey === 'fakekarakura') {
          p.vx = (Math.random() - 0.5) * 35;
          p.vy = (Math.random() - 0.5) * 35; // Chaotic dimensional rift jitter
        }
      }
    }

    /**
     * Updates ambient particle positions.
     * @private
     */
    _updateAmbientParticles(dt) {
      for (let i = 0; i < this.ambientParticles.length; i++) {
        const p = this.ambientParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.pulse += p.pulseSpeed * dt;

        // Wrap around arena boundaries
        if (p.x < 0) p.x += this.width;
        if (p.x > this.width) p.x -= this.width;
        if (p.y < 0) p.y += this.height;
        if (p.y > this.height) p.y -= this.height;
      }
    }

    /**
     * Draws ambient particles on canvas.
     * @private
     */
    _drawAmbientParticles(ctx) {
      ctx.save();
      for (let i = 0; i < this.ambientParticles.length; i++) {
        const p = this.ambientParticles[i];
        const a = Math.max(0.1, p.alpha * (0.6 + Math.sin(p.pulse) * 0.4));
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.restore();
    }

    // ========================================================================
    // Procedural Offscreen Canvas Rasterization (Zero Asset Pipeline)
    // ========================================================================

    /**
     * Pre-renders all 7 background canvases.
     * @private
     */
    _initAllCanvases() {
      const keys = Object.keys(LOCATIONS);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const off = createOffscreen(this.width, this.height);
        const ctx = off.getContext('2d');
        if (ctx) {
          this._renderLocationToCanvas(key, ctx);
        }
        this.cache[key] = off;
      }
    }

    /**
     * Dispatches procedural rendering of a location onto an offscreen canvas context.
     * @private
     */
    _renderLocationToCanvas(locKey, ctx) {
      switch (locKey) {
        case 'karakura':
          this._renderKarakura(ctx);
          break;
        case 'rukongai':
          this._renderRukongai(ctx);
          break;
        case 'seireitei':
          this._renderSeireitei(ctx);
          break;
        case 'sokyoku':
          this._renderSokyoku(ctx);
          break;
        case 'huecomundo':
          this._renderHuecoMundo(ctx);
          break;
        case 'lasnoches':
          this._renderLasNoches(ctx);
          break;
        case 'fakekarakura':
          this._renderFakeKarakura(ctx);
          break;
        default:
          this._renderKarakura(ctx);
      }
    }

    /**
     * 1. Karakura Town: Night streets, dark asphalt with markings, city skyline silhouette, amber lamps.
     * @private
     */
    _renderKarakura(ctx) {
      // Deep night sky & asphalt base
      ctx.fillStyle = '#0b0d14';
      ctx.fillRect(0, 0, this.width, this.height);

      // Distance city building silhouettes with glowing pixel windows
      ctx.fillStyle = '#111420';
      const buildingWidths = [70, 95, 60, 110, 85, 120, 75, 100, 90, 80, 105, 95, 115, 80];
      let curX = 0;
      for (let i = 0; i < buildingWidths.length; i++) {
        const bw = buildingWidths[i];
        const bh = 140 + ((i * 37) % 110);
        ctx.fillRect(curX, 0, bw, bh);

        // Windows
        ctx.fillStyle = '#f59e0b';
        for (let wy = 20; wy < bh - 20; wy += 22) {
          for (let wx = curX + 12; wx < curX + bw - 12; wx += 18) {
            if (((wx + wy) % 7) < 3) {
              ctx.fillRect(wx, wy, 4, 6);
            }
          }
        }
        ctx.fillStyle = '#111420';
        curX += bw + 8;
      }

      // Asphalt ground grid & street lane markers
      ctx.fillStyle = '#13151f';
      ctx.fillRect(0, 260, this.width, this.height - 260);

      ctx.strokeStyle = '#232738';
      ctx.lineWidth = 1;
      for (let y = 260; y <= this.height; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }
      for (let x = 0; x <= this.width; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 260);
        ctx.lineTo(x, this.height);
        ctx.stroke();
      }

      // Dashed yellow road centerline
      ctx.fillStyle = '#eab308';
      for (let x = 40; x < this.width; x += 60) {
        ctx.fillRect(x, 500, 32, 3);
      }

      // Street lamp posts with amber radial lighting
      const lampX = [180, 1100];
      for (let i = 0; i < lampX.length; i++) {
        const lx = lampX[i];
        ctx.fillStyle = '#3f3f46';
        ctx.fillRect(lx - 2, 210, 4, 180); // Post
        ctx.fillRect(lx - 8, 206, 16, 4);   // Lamp head
        // Amber light cone
        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        ctx.beginPath();
        ctx.arc(lx, 210, 90, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central Soul Altar protection ring
      this._drawSanctuaryRing(ctx, 'rgba(0, 229, 255, 0.12)');
    }

    /**
     * 2. Rukongai: Sandy earthen ground, Edo wooden shacks, Hakutoumon Gate silhouette.
     * @private
     */
    _renderRukongai(ctx) {
      // Warm dark earthen clay
      ctx.fillStyle = '#1c1510';
      ctx.fillRect(0, 0, this.width, this.height);

      // Distant mountains / Hakutoumon Gate silhouette
      ctx.fillStyle = '#2b1f16';
      ctx.fillRect(0, 0, this.width, 180);
      // Gate pillars
      ctx.fillStyle = '#3d2c20';
      ctx.fillRect(440, 20, 40, 160);
      ctx.fillRect(800, 20, 40, 160);
      ctx.fillRect(400, 20, 480, 24); // Crossbeam
      ctx.fillRect(420, 60, 440, 12); // Second beam

      // Edo shack silhouettes
      ctx.fillStyle = '#261b13';
      ctx.fillRect(40, 120, 180, 90);
      ctx.fillRect(1060, 110, 180, 100);

      // Sandy dirt texture with procedural speckles
      ctx.fillStyle = '#2a1e16';
      ctx.fillRect(0, 210, this.width, this.height - 210);

      ctx.fillStyle = '#38281d';
      for (let y = 220; y < this.height; y += 32) {
        for (let x = 0; x < this.width; x += 40) {
          if (((x * 17 + y * 31) % 5) === 0) {
            ctx.fillRect(x, y, 8, 4);
          }
        }
      }

      // Wooden fence stakes along top perimeter
      ctx.fillStyle = '#4a3526';
      for (let x = 20; x < this.width; x += 28) {
        if (x < 420 || x > 860) {
          ctx.fillRect(x, 195, 4, 25);
        }
      }

      this._drawSanctuaryRing(ctx, 'rgba(234, 88, 12, 0.15)');
    }

    /**
     * 3. Seireitei: White stone cobbles, pristine Sekkiseki walls, blue tile rooftops.
     * @private
     */
    _renderSeireitei(ctx) {
      // Refined white stone courtyard
      ctx.fillStyle = '#11151f';
      ctx.fillRect(0, 0, this.width, this.height);

      // Distant Gotei 13 barracks & curved blue tile roofs
      ctx.fillStyle = '#1a2233';
      ctx.fillRect(0, 0, this.width, 160);

      // Traditional curved Japanese castle rooftops
      ctx.fillStyle = '#1e3a5f';
      for (let x = 60; x < this.width; x += 220) {
        ctx.beginPath();
        ctx.moveTo(x, 110);
        ctx.lineTo(x + 100, 60);
        ctx.lineTo(x + 200, 110);
        ctx.fill();
        ctx.fillStyle = '#2a3b5c';
        ctx.fillRect(x + 20, 110, 160, 60);
        ctx.fillStyle = '#1e3a5f';
      }

      // Pristine white cobblestone paving
      ctx.fillStyle = '#181f2e';
      ctx.fillRect(0, 170, this.width, this.height - 170);

      ctx.strokeStyle = '#27344d';
      ctx.lineWidth = 1;
      const tileSize = 56;
      for (let y = 170; y <= this.height; y += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }
      for (let x = 0; x <= this.width; x += tileSize) {
        const offset = ((Math.floor(x / tileSize)) % 2) * (tileSize / 2);
        ctx.beginPath();
        ctx.moveTo(x, 170);
        ctx.lineTo(x, this.height);
        ctx.stroke();
      }

      this._drawSanctuaryRing(ctx, 'rgba(56, 189, 248, 0.16)');
    }

    /**
     * 4. Sōkyoku Hill: Rugged execution cliff, sunset sky, ceremonial scaffold.
     * @private
     */
    _renderSokyoku(ctx) {
      // Fiery crimson/amber sunset gradient
      ctx.fillStyle = '#180809';
      ctx.fillRect(0, 0, this.width, this.height);

      // Sunset clouds
      ctx.fillStyle = '#3a1114';
      ctx.fillRect(0, 0, this.width, 80);
      ctx.fillStyle = '#54171c';
      ctx.fillRect(0, 80, this.width, 70);

      // Great Sōkyoku execution wooden scaffold silhouette
      ctx.fillStyle = '#290b0e';
      ctx.fillRect(580, 20, 20, 180);
      ctx.fillRect(680, 20, 20, 180);
      ctx.fillRect(540, 40, 200, 16);
      ctx.fillRect(520, 90, 240, 16);

      // Volcanic cliff top & cracked basalt stone
      ctx.fillStyle = '#240d0f';
      ctx.fillRect(0, 170, this.width, this.height - 170);

      // Glowing lava/spiritual fissure cracks
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 1.5;
      const cracks = [
        [[120, 220], [200, 310], [290, 280], [350, 420]],
        [[900, 210], [980, 320], [1040, 360], [1160, 490]],
        [[380, 520], [450, 580], [530, 640]],
        [[720, 500], [800, 560], [870, 620]]
      ];
      for (let i = 0; i < cracks.length; i++) {
        const pts = cracks[i];
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let j = 1; j < pts.length; j++) {
          ctx.lineTo(pts[j][0], pts[j][1]);
        }
        ctx.stroke();
      }

      this._drawSanctuaryRing(ctx, 'rgba(239, 68, 68, 0.22)');
    }

    /**
     * 5. Hueco Mundo: Pure black sky, inverted crescent moon, white quartz dunes & trees.
     * @private
     */
    _renderHuecoMundo(ctx) {
      // Pure void night sky
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, this.width, this.height);

      // Signature Hueco Mundo Inverted White Crescent Moon
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(640, 90, 44, 0, Math.PI * 2);
      ctx.fill();
      // Cut moon with dark offset circle to create iconic crescent
      ctx.fillStyle = '#050608';
      ctx.beginPath();
      ctx.arc(640, 75, 42, 0, Math.PI * 2);
      ctx.fill();

      // Crystalline leafless quartz trees silhouettes
      ctx.fillStyle = '#252936';
      const treeX = [120, 280, 980, 1140];
      for (let i = 0; i < treeX.length; i++) {
        const tx = treeX[i];
        ctx.fillRect(tx - 3, 90, 6, 120);
        ctx.fillRect(tx - 24, 110, 48, 4);
        ctx.fillRect(tx - 16, 130, 32, 4);
      }

      // Stark white quartz sand dunes
      ctx.fillStyle = '#181b24';
      ctx.fillRect(0, 200, this.width, this.height - 200);

      // Dune wave ridges
      ctx.strokeStyle = '#2b3040';
      ctx.lineWidth = 2;
      for (let y = 240; y < this.height; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= this.width; x += 80) {
          const dy = Math.sin(x * 0.02 + y * 0.1) * 6;
          ctx.lineTo(x, y + dy);
        }
        ctx.stroke();
      }

      this._drawSanctuaryRing(ctx, 'rgba(226, 232, 240, 0.18)');
    }

    /**
     * 6. Las Noches Palace: Grand colonnades, royal marble floor, artificial dome sky.
     * @private
     */
    _renderLasNoches(ctx) {
      // Palace interior dome
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, this.width, this.height);

      // Artificial blue dome ceiling with geometric lattice
      ctx.fillStyle = '#101624';
      ctx.fillRect(0, 0, this.width, 180);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= this.width; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 180);
        ctx.stroke();
      }

      // Monumental white marble pillars (Aizen's throne colonnade)
      ctx.fillStyle = '#222938';
      const pillarX = [80, 240, 400, 880, 1040, 1200];
      for (let i = 0; i < pillarX.length; i++) {
        const px = pillarX[i];
        ctx.fillRect(px - 14, 40, 28, 170); // Pillar shaft
        ctx.fillStyle = '#323c52';
        ctx.fillRect(px - 20, 34, 40, 8);   // Capital
        ctx.fillRect(px - 18, 204, 36, 6);  // Base
        ctx.fillStyle = '#222938';
      }

      // Polished grand floor tiles
      ctx.fillStyle = '#141824';
      ctx.fillRect(0, 210, this.width, this.height - 210);

      ctx.strokeStyle = '#283047';
      ctx.lineWidth = 1;
      const step = 64;
      for (let y = 210; y <= this.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }
      for (let x = 0; x <= this.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 210);
        ctx.lineTo(x, this.height);
        ctx.stroke();
      }

      this._drawSanctuaryRing(ctx, 'rgba(0, 229, 255, 0.20)');
    }

    /**
     * 7. Fake Karakura: Shattered town, 4 glowing Tenkaiketchu pillars, Garganta rift fissures.
     * @private
     */
    _renderFakeKarakura(ctx) {
      // Shattered purple sky
      ctx.fillStyle = '#0c0814';
      ctx.fillRect(0, 0, this.width, this.height);

      // Garganta dimensional void tears
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 2;
      const tears = [
        [[200, 30], [280, 70], [360, 45], [420, 90]],
        [[840, 40], [910, 85], [980, 50], [1060, 95]]
      ];
      for (let i = 0; i < tears.length; i++) {
        const pts = tears[i];
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let j = 1; j < pts.length; j++) {
          ctx.lineTo(pts[j][0], pts[j][1]);
        }
        ctx.stroke();
      }

      // Shattered asphalt and rubble ground
      ctx.fillStyle = '#140f1f';
      ctx.fillRect(0, 180, this.width, this.height - 180);

      ctx.strokeStyle = '#291d3d';
      ctx.lineWidth = 1;
      for (let y = 180; y <= this.height; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }

      // 4 Tenkaiketchu Spirit Barrier Pillars at 4 corners of arena
      const pillars = [
        [160, 240], [1120, 240],
        [160, 600], [1120, 600]
      ];
      for (let i = 0; i < pillars.length; i++) {
        const [px, py] = pillars[i];
        // Stone base
        ctx.fillStyle = '#3b2959';
        ctx.fillRect(px - 14, py - 30, 28, 60);
        // Vertical energy beam
        ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
        ctx.fillRect(px - 6, 0, 12, this.height);
        // Core beam
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 2, 0, 4, this.height);
      }

      this._drawSanctuaryRing(ctx, 'rgba(168, 85, 247, 0.28)');
    }

    /**
     * Draws the central protective sanctuary ring around the Altar.
     * @private
     */
    _drawSanctuaryRing(ctx, strokeColor) {
      ctx.beginPath();
      ctx.arc(640, 360, 280, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }
  }

  // Universal Module Export
  global.TZ = global.TZ || {};
  global.TZ.BackgroundManager = BackgroundManager;
  global.TZ.LOCATIONS = LOCATIONS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BackgroundManager, LOCATIONS };
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
