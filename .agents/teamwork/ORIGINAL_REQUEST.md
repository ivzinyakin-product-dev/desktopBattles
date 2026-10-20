# Original User Request

## 2026-10-18T14:20:17Z

Desktop web arcade game "Tensa Zangetsu: Soul Altar Defense" — a mouse-driven action slasher where the player wields Ichigo's Bankai katana (Tensa Zangetsu) to slice incoming waves of Hollows and defend the Soul Altar in the center of the screen, styled after Realm of the Mad God (RotMG) pixel art.

Working directory: c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles
Integrity mode: demo

## Requirements

### R1. Sword Physics & Mouse Control
The player directly controls Tensa Zangetsu via mouse movement. High velocity mouse swings execute blade slashes with dynamic Getsuga Tensho trails (black core, crimson glow). Left click performs a forced slash; Right Click / Spacebar unleashes a ranged crescent Getsuga Tensho wave. The hilt features a chained tassel with real-time spring physics.

### R2. Enemy Swarms & Slicing Mechanics
Incoming enemies (Hollow Crawlers, Flyers, Armored Brutes, and Menos Grande boss charging Cero beam) advance toward the center. When slashed by the blade, enemies split into two distinct slices along the cut angle, emitting spiritual particles and screen shake.

### R3. Soul Altar Defense & Wave Progression
Defend the central Soul Altar with 100 HP. Waves continuously scale in density and intensity. The game tracks survival time, kill count, and combo multipliers. Reaching 0 HP triggers a Game Over screen with replay options.

### R4. Procedural Pixel Art & Web Audio Synth
Procedurally generated 16x16 / 32x32 RotMG-style pixel art for sword, altar, and Hollows. Web Audio API synthesized crunchy retro sound effects for slashes, steel clash, hollow cries, and Cero blast without external asset dependencies.

### R5. One-Click Launch
A standalone HTML5 Canvas architecture runnable in modern browsers, with a `run.bat` script for instant Windows launch.

## Acceptance Criteria

### Functional & Gameplay Verification
- [ ] Mouse swing accurately sweeps the blade with a visible black/red Getsuga trail.
- [ ] Enemies cleanly split into two halves and bounce away upon contact with the blade.
- [ ] Menos Grande spawns at higher wave thresholds and charges a visible Cero beam targeting the altar.
- [ ] Soul Altar takes damage only when enemies touch it or when hit by Cero.
- [ ] Web Audio produces synthesized sound effects upon slash, kill, and game over.
- [ ] `run.bat` successfully launches the game in a browser window without console errors.
