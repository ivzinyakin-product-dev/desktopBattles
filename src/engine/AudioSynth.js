/**
 * Tensa Zangetsu: Soul Altar Defense - Procedural Web Audio Synthesizer
 * 
 * 100% procedural 8-bit / 16-bit sound generator using Web Audio API nodes:
 * Oscillators, white noise buffers, biquad filters, distortion, and exponential envelopes.
 * Completely zero-asset, headless safe, and robust to unsupported environments.
 */

(function (global) {
  'use strict';

  class AudioSynth {
    constructor() {
      this.ctx = null;
      this.isMuted = false;
      this.masterGain = null;
      this._noiseBuffer = null;

      this._initContext();
    }

    /**
     * Initializes AudioContext safely.
     * @private
     */
    _initContext() {
      try {
        const AudioCtxClass = global.AudioContext || global.webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
          if (this.ctx.createGain) {
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime ? this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime || 0) : null;
            if (this.ctx.destination) {
              this.masterGain.connect(this.ctx.destination);
            }
          }
        }
      } catch (e) {
        this.ctx = null;
      }
    }

    /**
     * Resumes AudioContext on user gesture (click/key) to bypass browser autoplay policy.
     * @returns {Promise<void>}
     */
    async unlock() {
      if (this.ctx && typeof this.ctx.resume === 'function') {
        try {
          await this.ctx.resume();
          if (this.ctx.state !== 'running') {
            this.ctx.state = 'running';
          }
        } catch (e) {
          // Fallback state
          this.ctx.state = 'running';
        }
      }
    }

    /**
     * Creates or returns cached 1-second white noise buffer.
     * @private
     */
    _getNoiseBuffer() {
      if (this._noiseBuffer) return this._noiseBuffer;
      if (!this.ctx || typeof this.ctx.createBuffer !== 'function') return null;

      try {
        const sampleRate = this.ctx.sampleRate || 44100;
        const buffer = this.ctx.createBuffer(1, sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < sampleRate; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        this._noiseBuffer = buffer;
        return buffer;
      } catch (e) {
        return null;
      }
    }

    /**
     * Katana blade slash sound (pitch sweep + filtered noise).
     * @param {number} [speed=500] - Mouse swing speed in px/s
     */
    playSlash(speed = 500) {
      if (this.isMuted || !this.ctx || !this.masterGain) return;
      try {
        const now = this.ctx.currentTime || 0;
        const s = Math.min(1500, Math.max(300, speed));
        const freq = 380 + (s - 300) * 0.45;

        // Pitch-swept sine / triangle swoosh
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.13);

        // Filtered air whistle
        const noiseBuf = this._getNoiseBuffer();
        if (noiseBuf && this.ctx.createBiquadFilter) {
          const noise = this.ctx.createBufferSource();
          const filter = this.ctx.createBiquadFilter();
          const nGain = this.ctx.createGain();

          noise.buffer = noiseBuf;
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(freq * 1.5, now);
          filter.frequency.exponentialRampToValueAtTime(200, now + 0.11);
          filter.Q.value = 3.0;

          nGain.gain.setValueAtTime(0.25, now);
          nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

          noise.connect(filter);
          filter.connect(nGain);
          nGain.connect(this.masterGain);
          noise.start(now);
          noise.stop(now + 0.12);
        }
      } catch (e) {}
    }

    /**
     * Metallic blade clash / carapace ricochet / Cero deflection ping.
     */
    playClash() {
      if (this.isMuted || !this.ctx || !this.masterGain) return;
      try {
        const now = this.ctx.currentTime || 0;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'square';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(1240, now);
        osc2.frequency.setValueAtTime(1860, now);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.23);
        osc2.stop(now + 0.23);
      } catch (e) {}
    }

    /**
     * Kuroi Getsuga Tensho wave projectile launch.
     */
    playGetsugaWave() {
      if (this.isMuted || !this.ctx || !this.masterGain) return;
      try {
        const now = this.ctx.currentTime || 0;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.45);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.46);
      } catch (e) {}
    }

    /**
     * Hollow death / mask bisection crunch.
     * @param {string} [type='crawler']
     */
    playHollowDeath(type = 'crawler') {
      if (this.isMuted || !this.ctx || !this.masterGain) return;
      try {
        const now = this.ctx.currentTime || 0;
        const t = (type || '').toLowerCase();
        const isBig = t === 'brute' || t === 'menos';
        const dur = isBig ? 0.35 : 0.16;

        // Sub rumble
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(isBig ? 95 : 190, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + dur);

        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + dur + 0.01);

        // Bone crunch noise
        const noiseBuf = this._getNoiseBuffer();
        if (noiseBuf && this.ctx.createBiquadFilter) {
          const noise = this.ctx.createBufferSource();
          const filter = this.ctx.createBiquadFilter();
          const nGain = this.ctx.createGain();

          noise.buffer = noiseBuf;
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(isBig ? 1200 : 2200, now);
          filter.frequency.exponentialRampToValueAtTime(150, now + dur);

          nGain.gain.setValueAtTime(0.45, now);
          nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

          noise.connect(filter);
          filter.connect(nGain);
          nGain.connect(this.masterGain);
          noise.start(now);
          noise.stop(now + dur + 0.01);
        }
      } catch (e) {}
    }

    /**
     * Menos Grande Cero charging sound (rising harmonic drone).
     */
    playCeroCharge() {
      if (this.isMuted || !this.ctx || !this.masterGain) return;
      try {
        const now = this.ctx.currentTime || 0;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 2.4);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 2.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 2.55);
      } catch (e) {}
    }

    /**
     * Menos Grande Cero beam blast (massive deep laser rumble).
     */
    playCeroBlast() {
      if (this.isMuted || !this.ctx || !this.masterGain) return;
      try {
        const now = this.ctx.currentTime || 0;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(75, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 1.2);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 1.22);
      } catch (e) {}
    }

    /**
     * Soul Altar crystal damage impact.
     */
    playAltarHit() {
      if (this.isMuted || !this.ctx || !this.masterGain) return;
      try {
        const now = this.ctx.currentTime || 0;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.36);
      } catch (e) {}
    }

    /**
     * Game Over descent arpeggio.
     */
    playGameOver() {
      if (this.isMuted || !this.ctx || !this.masterGain) return;
      try {
        const notes = [440, 415.3, 392, 349.2, 329.6, 261.6]; // Minor despair descent
        const now = this.ctx.currentTime || 0;

        notes.forEach((freq, idx) => {
          const t = now + idx * 0.16;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.35, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

          osc.connect(gain);
          gain.connect(this.masterGain);

          osc.start(t);
          osc.stop(t + 0.3);
        });
      } catch (e) {}
    }
  }

  // Universal Module Export
  global.TZ = global.TZ || {};
  global.TZ.AudioSynth = AudioSynth;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioSynth };
  }
})(typeof window !== 'undefined' ? window : global);
