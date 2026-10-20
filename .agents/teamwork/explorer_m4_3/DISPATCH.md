## 2026-10-18T16:44:49Z
You are Explorer 3 for Milestone 4 (Web Audio API Retro Synth Engine) of "Tensa Zangetsu: Soul Altar Defense".

Your working directory is:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m4_3\

Mandatory: Read ORIGINAL_REQUEST.md and PROJECT.md first:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\ORIGINAL_REQUEST.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\orchestrator_1\PROJECT.md
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\orchestrator_1\TEST_INFRA.md

Examine test suites in `test/test-e2e.js`:
- Feature 23 (Web Audio API Retro Synth)
- Feature 28.5 (Graceful fallback when AudioContext fails or is unsupported)
- Tier 3.4 & Tier 3.6 (Audio Invocations across Multi-Subsystem Events)

Task:
Formulate complete drop-in production blueprints for:
1. `src/engine/AudioSynth.js`:
   - 100% procedural Web Audio API retro synth engine with ZERO external audio files or samples.
   - Context init: `this.ctx = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ? new (window.AudioContext || window.webkitAudioContext)() : null;`
   - Auto-unlock: `unlock()` method that resumes suspended AudioContext on user interaction (pointerdown, keydown).
   - Robustness & Headless Safety: Every method checks `if (!this.ctx) return;` or catches errors, ensuring zero exceptions in Node or headless test runners.
   - Procedural generator algorithms:
     * `playSlash(speed)`: white noise buffer / bandpass sweep with exponential gain decay (0.08s - 0.15s), pitch scaled by swing speed.
     * `playClash()`: twin detuned square/triangle oscillators (800Hz & 1140Hz) with sharp envelope (0.12s) producing metallic bell/clang dissonance.
     * `playGetsugaWave()`: deep sawtooth oscillator (90Hz ramping to 45Hz) with resonant lowpass filter sweep and sub-bass rumble.
     * `playHollowDeath(type)`: crunchy bisection squelch / dissipation screech (noise burst + descending FM oscillator).
     * `playCeroCharge()`: rising sine wave oscillator (200Hz ramping to 1200Hz over 2.0s) with tremolo LFO.
     * `playCeroBlast()`: explosive multi-oscillator blast (sub-bass 50Hz sine + white noise burst + resonant filter sweep).
     * `playAltarHit()`: resonant glass/altar distress chime (high sine 1200Hz + exponential decay 0.6s).
     * `playGameOver()`: descending minor triad chord / soul shatter sound (440 -> 349 -> 261Hz with decay).
   - Master volume control, mute toggle, and clean node cleanup on sound end.
   - Universal module export: `window.TZ.AudioSynth = AudioSynth;` and CommonJS exports.
2. Unit test specifications for `test/test-defense.js`.

Write report to:
c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles\.agents\teamwork\explorer_m4_3\handoff.md
Send completion message to orchestrator.
