/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/engine/CanvasRenderer.js
 * 
 * Canonical 1280x720 virtual resolution renderer with aspect ratio maintenance,
 * crisp pixelation, offscreen canvas factory, camera shake isolation, and layered rendering.
 * Zero external dependencies. Browser & Node.js compatible.
 */
(function (global) {
  'use strict';

  // Fallback MockCanvas & MockContext2D for headless Node.js test environments
  class MockContext2D {
    constructor(canvas) {
      this.canvas = canvas;
      this.fillStyle = '#000000';
      this.strokeStyle = '#000000';
      this.lineWidth = 1;
      this.globalAlpha = 1.0;
      this.globalCompositeOperation = 'source-over';
      this.imageSmoothingEnabled = false;
      this.mozImageSmoothingEnabled = false;
      this.webkitImageSmoothingEnabled = false;
      this.msImageSmoothingEnabled = false;
      this._stack = [];
      this._calls = [];
      this.calls = []; // Compatibility with test-e2e MockCanvasRenderingContext2D
    }

    save() {
      this._stack.push({
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        globalCompositeOperation: this.globalCompositeOperation,
        imageSmoothingEnabled: this.imageSmoothingEnabled
      });
      this._calls.push({ fn: 'save' });
      this.calls.push(['save']);
    }

    restore() {
      const s = this._stack.pop();
      if (s) Object.assign(this, s);
      this._calls.push({ fn: 'restore' });
      this.calls.push(['restore']);
    }

    clearRect(x, y, w, h) {
      this._calls.push({ fn: 'clearRect', args: [x, y, w, h] });
      this.calls.push(['clearRect', x, y, w, h]);
    }

    fillRect(x, y, w, h) {
      this._calls.push({ fn: 'fillRect', args: [x, y, w, h], fillStyle: this.fillStyle });
      this.calls.push(['fillRect', x, y, w, h]);
    }

    strokeRect(x, y, w, h) {
      this._calls.push({ fn: 'strokeRect', args: [x, y, w, h] });
      this.calls.push(['strokeRect', x, y, w, h]);
    }

    beginPath() {
      this._calls.push({ fn: 'beginPath' });
      this.calls.push(['beginPath']);
    }

    closePath() {
      this._calls.push({ fn: 'closePath' });
      this.calls.push(['closePath']);
    }

    moveTo(x, y) {
      this._calls.push({ fn: 'moveTo', args: [x, y] });
      this.calls.push(['moveTo', x, y]);
    }

    lineTo(x, y) {
      this._calls.push({ fn: 'lineTo', args: [x, y] });
      this.calls.push(['lineTo', x, y]);
    }

    arc(x, y, r, sa, ea) {
      this._calls.push({ fn: 'arc', args: [x, y, r, sa, ea] });
      this.calls.push(['arc', x, y, r, sa, ea]);
    }

    fill() {
      this._calls.push({ fn: 'fill' });
      this.calls.push(['fill']);
    }

    stroke() {
      this._calls.push({ fn: 'stroke' });
      this.calls.push(['stroke']);
    }

    clip() {
      this._calls.push({ fn: 'clip' });
      this.calls.push(['clip']);
    }

    translate(x, y) {
      this._calls.push({ fn: 'translate', args: [x, y] });
      this.calls.push(['translate', x, y]);
    }

    rotate(angle) {
      this._calls.push({ fn: 'rotate', args: [angle] });
      this.calls.push(['rotate', angle]);
    }

    scale(sx, sy) {
      this._calls.push({ fn: 'scale', args: [sx, sy] });
      this.calls.push(['scale', sx, sy]);
    }

    drawImage(img, ...args) {
      this._calls.push({ fn: 'drawImage', args: [img, ...args] });
      this.calls.push(['drawImage', img, ...args]);
    }

    createImageData(w, h) {
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    }

    getImageData(x, y, w, h) {
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    }

    putImageData(imgData, x, y) {
      this._calls.push({ fn: 'putImageData', args: [imgData, x, y] });
      this.calls.push(['putImageData', imgData, x, y]);
    }

    fillText(t, x, y) {
      this._calls.push({ fn: 'fillText', args: [t, x, y] });
      this.calls.push(['fillText', t, x, y]);
    }

    strokeText(t, x, y) {
      this._calls.push({ fn: 'strokeText', args: [t, x, y] });
      this.calls.push(['strokeText', t, x, y]);
    }

    measureText(t) {
      return { width: (t || '').length * 8 };
    }
  }

  class MockCanvas {
    constructor(width = 1280, height = 720) {
      this.width = width;
      this.height = height;
      this.style = {};
      this._ctx = new MockContext2D(this);
      this._rect = { left: 0, top: 0, width: width, height: height, right: width, bottom: height };
    }

    getContext(type) {
      return type === '2d' ? this._ctx : null;
    }

    getBoundingClientRect() {
      return this._rect;
    }

    addEventListener() {}
    removeEventListener() {}
  }

  class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement|string|Object} [canvasOrId] - DOM canvas element, ID, or MockCanvas
     * @param {Object} [options]
     * @param {number} [options.width=1280] - Canonical virtual width
     * @param {number} [options.height=720] - Canonical virtual height
     * @param {Function} [options.createCanvas] - Custom offscreen canvas factory
     */
    constructor(canvasOrId, options = {}) {
      this.width = options.width || 1280;
      this.height = options.height || 720;
      this.aspectRatio = this.width / this.height;
      this.options = options;

      // Resolve canvas DOM element or MockCanvas
      if (typeof canvasOrId === 'string' && typeof document !== 'undefined') {
        this.canvas = document.getElementById(canvasOrId);
      } else if (canvasOrId && typeof canvasOrId === 'object') {
        this.canvas = canvasOrId;
      } else if (typeof document !== 'undefined' && document.createElement) {
        this.canvas = document.createElement('canvas');
      } else {
        this.canvas = new MockCanvas(this.width, this.height);
      }

      this.canvas.width = this.width;
      this.canvas.height = this.height;
      if (this.canvas.style) {
        this.canvas.style.imageRendering = 'pixelated';
      }

      this.ctx = this.canvas.getContext('2d');
      this.configureContext();
    }

    /**
     * Returns the 2D rendering context
     * @returns {CanvasRenderingContext2D|MockContext2D}
     */
    getContext() {
      return this.ctx;
    }

    /**
     * Enforces crisp pixelation by disabling smoothing on all vendor prefixes
     */
    configureContext() {
      if (!this.ctx) return;
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.mozImageSmoothingEnabled = false;
      this.ctx.webkitImageSmoothingEnabled = false;
      this.ctx.msImageSmoothingEnabled = false;
    }

    /**
     * Clears the virtual canvas with a specified background color
     * @param {string} [color='#0a0a0f']
     */
    clear(color = '#0a0a0f') {
      if (!this.ctx) return;
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Helper render callback execution
     * @param {Function} [renderFn]
     */
    render(renderFn) {
      if (typeof renderFn === 'function' && this.ctx) {
        renderFn(this.ctx);
      }
    }

    /**
     * Transforms screen client coordinates (from mouse/pointer events)
     * into canonical virtual canvas coordinates [0..1280, 0..720].
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{x: number, y: number}}
     */
    screenToVirtual(clientX, clientY) {
      const rect = this.canvas && this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
      if (!rect || rect.width === 0 || rect.height === 0) {
        return {
          x: Math.max(0, Math.min(this.width, clientX)),
          y: Math.max(0, Math.min(this.height, clientY))
        };
      }
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      const vx = (clientX - rect.left) * scaleX;
      const vy = (clientY - rect.top) * scaleY;
      return {
        x: Math.max(0, Math.min(this.width, vx)),
        y: Math.max(0, Math.min(this.height, vy))
      };
    }

    /**
     * Alias for screenToVirtual
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{x: number, y: number}}
     */
    toVirtualCoords(clientX, clientY) {
      return this.screenToVirtual(clientX, clientY);
    }

    /**
     * Creates an offscreen canvas with smoothing disabled
     * @param {number} width
     * @param {number} height
     * @returns {OffscreenCanvas|HTMLCanvasElement|MockCanvas}
     */
    createOffscreenCanvas(width, height) {
      let offscreen;
      if (typeof OffscreenCanvas !== 'undefined') {
        offscreen = new OffscreenCanvas(width, height);
      } else if (typeof document !== 'undefined' && document.createElement) {
        offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
      } else if (this.options && this.options.createCanvas) {
        offscreen = this.options.createCanvas(width, height);
      } else {
        offscreen = new MockCanvas(width, height);
      }

      if (offscreen && offscreen.style) {
        offscreen.style.imageRendering = 'pixelated';
      }

      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        offCtx.imageSmoothingEnabled = false;
        offCtx.mozImageSmoothingEnabled = false;
        offCtx.webkitImageSmoothingEnabled = false;
        offCtx.msImageSmoothingEnabled = false;
      }
      return offscreen;
    }

    /**
     * Executes drawing commands with camera screen shake offset and rotation.
     * Automatically restores the context state upon completion.
     * @param {Object} camera - Camera instance with { x, y, angle } or { offsetX, offsetY, angle }
     * @param {Function} drawFn - Callback receiving ctx
     */
    withCamera(camera, drawFn) {
      if (!this.ctx) return;
      this.ctx.save();
      if (camera) {
        const cx = camera.x !== undefined ? camera.x : (camera.offsetX || 0);
        const cy = camera.y !== undefined ? camera.y : (camera.offsetY || 0);
        const angle = camera.angle || 0;
        if (cx !== 0 || cy !== 0) {
          this.ctx.translate(cx, cy);
        }
        if (angle !== 0) {
          this.ctx.translate(this.width / 2, this.height / 2);
          this.ctx.rotate(angle);
          this.ctx.translate(-this.width / 2, -this.height / 2);
        }
      }
      try {
        if (typeof drawFn === 'function') {
          drawFn(this.ctx);
        }
      } finally {
        this.ctx.restore();
      }
    }

    /**
     * Helper to draw a cached sprite centered at (x, y) with optional rotation and scale
     * @param {Object} spriteCanvas - OffscreenCanvas or HTMLCanvasElement
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} w - Destination width
     * @param {number} h - Destination height
     * @param {number} [angle=0] - Rotation angle in radians
     * @param {number} [alpha=1.0] - Opacity
     * @param {boolean} [flipX=false] - Horizontal mirror
     */
    drawSprite(spriteCanvas, x, y, w, h, angle = 0, alpha = 1.0, flipX = false) {
      if (!spriteCanvas || !this.ctx) return;
      this.ctx.save();
      if (alpha < 1.0) this.ctx.globalAlpha = Math.max(0, Math.min(1.0, alpha));
      this.ctx.translate(x, y);
      if (angle !== 0) this.ctx.rotate(angle);
      if (flipX) this.ctx.scale(-1, 1);
      this.ctx.drawImage(spriteCanvas, -w / 2, -h / 2, w, h);
      this.ctx.restore();
    }
  }

  // Universal Modular Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.CanvasRenderer = CanvasRenderer;
  global.TZ.MockCanvas = MockCanvas;
  global.TZ.MockContext2D = MockContext2D;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasRenderer;
    module.exports.CanvasRenderer = CanvasRenderer;
    module.exports.MockCanvas = MockCanvas;
    module.exports.MockContext2D = MockContext2D;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
