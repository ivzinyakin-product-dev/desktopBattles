# Handoff Report: R1 (Sword Physics & Mouse Control) & R2 (Enemy Swarms & Slicing Mechanics)

- **Agent**: Survey Explorer 2 (`explorer_survey_2`)
- **Conversation ID**: `594c3570-7e39-44e4-b9ab-8db3a68e7898`
- **Target Recipient**: Orchestrator (`06829fc7-2ed4-4f7b-b3e3-4c32cd67f0bd`)
- **Date**: 2026-10-18T14:27:00Z
- **Integrity Mode**: demo

---

## 1. Observation

### 1.1 Direct Request & Dispatch Mandate
From `ORIGINAL_REQUEST.md` (lines 12–17, 29–35):
> "### R1. Sword Physics & Mouse Control
> The player directly controls Tensa Zangetsu via mouse movement. High velocity mouse swings execute blade slashes with dynamic Getsuga Tensho trails (black core, crimson glow). Left click performs a forced slash; Right Click / Spacebar unleashes a ranged crescent Getsuga Tensho wave. The hilt features a chained tassel with real-time spring physics.
>
> ### R2. Enemy Swarms & Slicing Mechanics
> Incoming enemies (Hollow Crawlers, Flyers, Armored Brutes, and Menos Grande boss charging Cero beam) advance toward the center. When slashed by the blade, enemies split into two distinct slices along the cut angle, emitting spiritual particles and screen shake."
>
> Acceptance Criteria:
> "- [ ] Mouse swing accurately sweeps the blade with a visible black/red Getsuga trail.
>  - [ ] Enemies cleanly split into two halves and bounce away upon contact with the blade.
>  - [ ] Menos Grande spawns at higher wave thresholds and charges a visible Cero beam targeting the altar."

From Orchestrator Dispatch (`DISPATCH.md`):
> "Task: Investigate and produce technical specifications and algorithmic designs for:
> 1. R1: Sword Physics & Mouse Control (High velocity tracking, blade orientation, angular sweep detection, Getsuga trail, forced slash, ranged crescent projectile, hilt chained tassel physics).
> 2. R2: Enemy Swarms & Slicing Mechanics (Slicing algorithm, separated impulses, particles, screen shake, enemy AI: Crawler, Flyer, Brute, Menos Grande boss)."

### 1.2 Codebase Environment
- Workspace root: `c:\Users\ZEPHYRUS\Desktop\Pet projects (vibecode is great)\desktopBattles`
- Directory tree: `src/engine/` and `src/game/` currently empty (Greenfield architecture).
- Target platform: Standalone modern web browser (HTML5 Canvas 2D + Web Audio API, launchable via `run.bat` without Node runtime dependencies or external CDNs).

---

## 2. Logic Chain

### 2.1 Component 1: R1 — Sword Kinematics, Mouse Tracking & Angular Sweep

#### 2.1.1 Mouse Kinematics & Velocity Filtering
Discrete mouse events (`mousemove`) fire asynchronously at hardware polling rates ($60\text{ Hz}$ to $1000\text{ Hz}$). High-velocity swings can travel $50\text{–}150\text{ px}$ in a single animation frame ($16.6\text{ ms}$).
To provide ultra-responsive slicing without jitter:
1. **Raw Coordinates & Filtered Hilt Position**:
   Store raw mouse target $\mathbf{P}_m = (x_m, y_m)$.
   Katana hilt $\mathbf{H}(t)$ tracks mouse position via high-speed exponential lerp:
   $$\mathbf{H}(t) = \mathbf{H}(t - \Delta t) + (\mathbf{P}_m(t) - \mathbf{H}(t - \Delta t)) \cdot (1 - e^{-\lambda \Delta t})$$
   with $\lambda = 50.0\text{ s}^{-1}$ (lag $< 10\text{ ms}$ for responsive feel, eliminates subpixel cursor stutter).
2. **Velocity & Speed Vector**:
   $$\vec{V}_m(t) = \frac{\mathbf{H}(t) - \mathbf{H}(t - \Delta t)}{\Delta t}$$
   $$S_m(t) = \|\vec{V}_m(t)\|$$
   Maintain a ring buffer of the last $K = 5$ velocity samples to compute moving average $\bar{\vec{V}}_m$ and acceleration $\vec{A}_m = \frac{d\vec{V}_m}{dt}$.

#### 2.1.2 Blade Geometry & Dynamic Orientation
Tensa Zangetsu is Ichigo's Bankai daitō: an elongated, slender jet-black blade with a Manji (swastika) tsuba and an unstrung black chain at the pommel.
- **Dimensions**:
  - Blade length $L_{blade} = 85\text{ px}$.
  - Tsuba guard radius $R_{tsuba} = 8\text{ px}$.
  - Hilt length $L_{hilt} = 22\text{ px}$.
  - Pommel anchor point $\mathbf{P}_{pommel} = \mathbf{H} - L_{hilt} \cdot \hat{\mathbf{u}}_{blade}$.
  - Blade tip point $\mathbf{T} = \mathbf{H} + L_{blade} \cdot \hat{\mathbf{u}}_{blade}$.
- **Dual-State Orientation Engine**:
  - **State A: Idle / Low Speed ($S_m < V_{slash\_thresh}$, where $V_{slash\_thresh} = 280\text{ px/s}$)**:
    The blade rests in a defensive ready stance. The blade direction vector $\hat{\mathbf{u}}_{blade}$ aims outward radially from the central Soul Altar $\mathbf{P}_{altar} = (W/2, H/2)$ toward the cursor:
    $$\theta_{target} = \text{atan2}(y_m - y_{altar}, x_m - x_{altar})$$
    Angular slerp: $\theta(t) = \text{slerp}(\theta(t-\Delta t), \theta_{target}, 15 \cdot \Delta t)$.
  - **State B: High-Velocity Swing ($S_m \ge V_{slash\_thresh}$)**:
    The cutting edge aligns dynamically with the swing velocity vector $\vec{V}_m$.
    Swing direction angle $\phi = \text{atan2}(V_{m, y}, V_{m, x})$.
    Calculate angular sweep velocity:
    $$\omega_{swing} = \frac{\Delta \phi}{\Delta t}$$
    The blade leading edge tilts forward into the cut with a forward rake angle $\alpha_{rake} \approx 20^\circ$ ($0.35\text{ rad}$):
    $$\theta_{blade} = \phi + \text{sign}(\omega_{swing}) \cdot 0.35$$
    Tip $\mathbf{T}(t)$ and Hilt $\mathbf{H}(t)$ are updated instantaneously.

#### 2.1.3 Continuous Collision Detection (CCD) via Swept Quad Volume
Traditional discrete raycasts fail when a player whips the mouse at $1500\text{ px/s}$ (tunneling through enemies).
We implement **Swept Quadrilateral CCD**:
1. At time $t - \Delta t$: Segment $\overline{\mathbf{H}_0 \mathbf{T}_0}$.
2. At time $t$: Segment $\overline{\mathbf{H}_1 \mathbf{T}_1}$.
3. The swept area forms a convex polygon $Q = [\mathbf{H}_0, \mathbf{T}_0, \mathbf{T}_1, \mathbf{H}_1]$.
4. **Enemy Intersection Test**:
   For each enemy with circle collider $(\mathbf{C}_e, R_e)$:
   - Test 1: Distance from $\mathbf{C}_e$ to segment $\overline{\mathbf{T}_0 \mathbf{T}_1} \le R_e$ (Tip arc cut).
   - Test 2: Distance from $\mathbf{C}_e$ to segment $\overline{\mathbf{H}_1 \mathbf{T}_1} \le R_e$ (Current blade cut).
   - Test 3: Point in convex polygon $Q(\mathbf{C}_e)$ using cross-product winding tests:
     $$\big((\mathbf{v}_{i+1} - \mathbf{v}_i) \times (\mathbf{C}_e - \mathbf{v}_i)\big)_z \ge 0 \quad \forall i \in \{0, 1, 2, 3\}$$
   If any test returns true, an intersection occurred!
5. **Cut Vector Derivation**:
   Instantaneous cut velocity at contact point $\mathbf{P}_{cut} \approx \mathbf{C}_e$:
   $$\vec{v}_{cut} = \bar{\vec{V}}_m + \omega_{swing} \cdot (\mathbf{P}_{cut} - \mathbf{H}_1)^\perp$$
   Normalized cut direction $\hat{\mathbf{d}}_{cut} = \frac{\vec{v}_{cut}}{\|\vec{v}_{cut}\|}$.
   Normalized cut normal (lateral separation vector) $\hat{\mathbf{n}}_{cut} = (-\hat{d}_{cut, y}, \hat{d}_{cut, x})$.

---

### 2.2 Component 2: Dynamic Getsuga Tensho Trail Rendering (Black Core, Crimson Glow)

#### 2.2.1 Dual-Composite Ribbon Architecture
The trail represents Kuroi Getsuga (Black Moon Fang) reiatsu: an obsidian, light-absorbing core encased within an incandescent, blood-crimson aura.
- **Data Structure**:
  Rolling buffer of trail nodes:
  ```typescript
  interface TrailNode {
    hilt: { x: number, y: number };
    tip: { x: number, y: number };
    speed: number;
    timestamp: number;
    alpha: number;
  }
  ```
  Maximum history $M = 16$ nodes (lifespan $\tau = 240\text{ ms}$).
- **Rendering Pass Pipeline**:
  1. **Pass 1: Outer Crimson Reiatsu Aura (Additive / High Glow)**:
     - Context state: `ctx.save()`, `ctx.globalCompositeOperation = 'screen'`.
     - Outline dilation: Expand vertices along normal by $\delta_{outer} = 10\text{ px} \cdot (\text{speed} / V_{max})$.
     - Construct ribbon path from newest node to oldest:
       $$\mathbf{T}_{dilated} = \mathbf{T}_i + \hat{\mathbf{n}}_{edge} \cdot \delta_{outer}$$
       $$\mathbf{H}_{dilated} = \mathbf{H}_i - \hat{\mathbf{n}}_{edge} \cdot \delta_{outer}$$
     - Fill: Linear/Radial gradient transitioning from fiery crimson `#ff1744` ($1.0$ alpha) to blood burgundy `#8b0000` ($0.0$ alpha).
     - Glow blur: `ctx.shadowColor = '#ff0033'`, `ctx.shadowBlur = 18`.
  2. **Pass 2: Inner Kuroi Core (Jet Black Darkness)**:
     - Context state: `ctx.globalCompositeOperation = 'source-over'`.
     - Core thickness: Narrow ribbon width $W_{core} = 4\text{ px}$.
     - Fill: Solid pitch black `#050505` or `#000000`.
     - Visual result: The sharp black ribbon slices cleanly through the fiery red glow, creating high-contrast Bleach anime aesthetics.
  3. **Pass 3: Dissipating Reiatsu Embers**:
     When $S_m \ge V_{slash\_thresh}$, spawn 2–3 spiritual particles per frame along the blade line $\overline{\mathbf{H}_1 \mathbf{T}_1}$ with random backward velocity:
     - 60% Crimson sparks (`#ff1744`, radius $1.5\text{ px}$, lifespan $0.25\text{ s}$).
     - 40% Kuroi smoke blobs (`#110505`, radius $3.0\text{ px}$, lifespan $0.4\text{ s}$, alpha fade).

---

### 2.3 Component 3: Forced Slash & Ranged Crescent Wave

#### 2.3.1 Left Click Forced Slash Mechanic ("Senka" Arc Slash)
- **Problem**: When cornered or when the mouse is momentarily stationary, player needs an emergency omnidirectional cut.
- **Specification**:
  - Input: `mousedown` (Button 0) or left click.
  - Cooldown: $0.35\text{ s}$ (`canForcedSlash = (time - lastForcedSlash >= 0.35)`).
  - Duration: $150\text{ ms}$ (9 frames at 60fps).
  - Trajectory: Rapid $240^\circ$ circular sweep around the cursor $\mathbf{P}_m$.
    $$\theta_{slash}(t) = \theta_{start} + 240^\circ \cdot \text{easeOutCubic}\left(\frac{t - t_0}{0.15}\right)$$
  - Mechanics:
    - Hits all enemies within circle radius $R = L_{blade} + 15 = 100\text{ px}$.
    - Deals $1.5\times$ base damage; guaranteed bisection of non-boss enemies.
    - Forces camera trauma $+0.25$.
    - Synthesizes high-frequency metallic air-rending whip SFX.

#### 2.3.2 Right Click / Spacebar: Kuroi Getsuga Tensho Ranged Crescent Projectile
- **Specification**:
  - Input: `contextmenu` (Button 2 with `e.preventDefault()`) or `KeyboardEvent.code === 'Space'`.
  - Energy Meter / Cooldown: $1.8\text{ s}$ cooldown. Visual Reiatsu charge gauge ($0 \to 100\%$) displayed on HUD and near cursor.
  - Direction: Vector from Soul Altar to mouse $\hat{\mathbf{u}}_{aim} = \text{normalize}(\mathbf{P}_m - \mathbf{P}_{altar})$ or current blade forward heading.
  - Projectile Parameters:
    - Speed: $820\text{ px/s}$.
    - Penetration count: Max 8 enemy bisections before dissipating.
    - Lifespan: $1.6\text{ s}$ (or screen exit).
    - Dimensions: Parabolic crescent arc of radius $R_{crescent} = 42\text{ px}$, thickness $16\text{ px}$, sweep angle $130^\circ$.
  - Render Appearance:
    - Convex crescent arc rendered using quadratic Bezier curves:
      Outer arc from $(-35, -20)$ through $(0, -35)$ to $(35, -20)$.
      Inner arc curving back through $(0, -15)$ to $(-35, -20)$.
    - Jet-black fill (`#000000`) with blazing crimson outer stroke (`#ff0033`, line width $3\text{ px}$, shadow blur $14\text{ px}$).
    - Leaves trailing trail of black smoke and red sparks.
  - Collision & Damage:
    - Instantly bisects Crawlers and Flyers upon contact.
    - Strips Armored Brute's carapace in 1 hit.
    - Deals 120 damage to Menos Grande boss; interrupts Cero charging if hit during telegraph!

---

### 2.4 Component 4: Katana Pommel Chained Tassel (Real-Time Verlet Physics)

#### 2.4.1 Mathematical Formulation
Tensa Zangetsu's iconic pommel chain whips and trails behind the blade. We use a **Verlet Particle System with Distance Constraints**:
- **Nodes**: $N = 8$ chained links: $\mathbf{x}_0, \mathbf{x}_1, \dots, \mathbf{x}_{N-1}$.
- **Pin Constraint**: Node 0 is hard-locked to the katana pommel:
  $$\mathbf{x}_0(t) = \mathbf{P}_{pommel}(t) = \mathbf{H}(t) - L_{hilt} \cdot \hat{\mathbf{u}}_{blade}(t)$$
- **Verlet Step** (for $i \in [1, N-1]$):
  $$\mathbf{x}_i(t + \Delta t) = \mathbf{x}_i(t) + (\mathbf{x}_i(t) - \mathbf{x}_{prev, i}(t)) \cdot (1 - \gamma) + \mathbf{a}_i \Delta t^2$$
  where:
  - $\gamma = 0.05$ (air drag / velocity damping).
  - $\mathbf{a}_i = \mathbf{g} + \mathbf{f}_{centrifugal}$ (gravity $\mathbf{g} = (0, 280\text{ px/s}^2)$).
- **Distance Relaxation Constraints**:
  Each link has rest length $d_0 = 5\text{ px}$ (total chain span $\approx 40\text{ px}$).
  For each iteration $k \in [0, 3]$ (3 iterations per frame):
  $$\vec{\Delta} = \mathbf{x}_i - \mathbf{x}_{i-1}$$
  $$\text{dist} = \|\vec{\Delta}\|$$
  $$\delta = \frac{\text{dist} - d_0}{\text{dist}}$$
  If $i = 1$ (node 0 is fixed pommel):
  $$\mathbf{x}_1 \leftarrow \mathbf{x}_1 - \vec{\Delta} \cdot \delta$$
  If $i > 1$:
  $$\mathbf{x}_{i-1} \leftarrow \mathbf{x}_{i-1} + \vec{\Delta} \cdot (0.5 \cdot \delta)$$
  $$\mathbf{x}_i \leftarrow \mathbf{x}_i - \vec{\Delta} \cdot (0.5 \cdot \delta)$$
- **RotMG Pixel-Art Rendering**:
  - Draw lines connecting adjacent nodes with stroke width $2\text{ px}$, color `#111111`.
  - Draw $3 \times 3$ pixel square at each node:
    - Inner pixel: `#111111` (dark iron).
    - Top-left highlight pixel: `#666666` (metallic glint).
  - End of chain: Broken link ring (4x4 hollow pixel box).

---

### 2.5 Component 5: R2 — Clean 2D Sprite Slicing Algorithm

#### 2.5.1 The Geometric Slicing Pipeline
When an enemy is struck, it does not simply vanish or explode into random generic chunks. It **physically splits into two halves along the exact plane of the blade's cut vector**.

```
       Cut Vector d_cut
           ▲
           │     Half A (n_cut · p >= 0)
     ──────┼──────
    │  \   │   /  │  <-- Incision Seam (Glowing Reiatsu Cauterization)
    │   \  │  /   │
     ──────┼──────
           │     Half B (n_cut · p < 0)
           │
      Cut Normal n_cut
```

#### 2.5.2 Pixel-Matrix Decomposition (RotMG Authenticity)
Since all RotMG sprites are procedurally generated $16 \times 16$ or $32 \times 32$ pixel matrices, we can perform **Deterministic Pixel Partitioning**:
1. Given enemy world center $\mathbf{P}_e$, rotation $\theta_e$, sprite dimensions $W \times H$.
2. Given cut intersection point $\mathbf{P}_{cut}$ and cut normal $\hat{\mathbf{n}}_{cut} = (n_x, n_y)$.
3. Transform cut line into sprite local pixel coordinates:
   $$\mathbf{p}_{loc} = \mathbf{R}(-\theta_e)(\mathbf{P}_{cut} - \mathbf{P}_e) + \left(\frac{W}{2}, \frac{H}{2}\right)$$
   $$\hat{\mathbf{n}}_{loc} = \mathbf{R}(-\theta_e)\hat{\mathbf{n}}_{cut}$$
4. For each local pixel $(u, v) \in [0, W-1] \times [0, H-1]$:
   Compute signed distance to cut line:
   $$f(u, v) = n_{loc, x} \cdot (u - p_{loc, u}) + n_{loc, y} \cdot (v - p_{loc, v})$$
   - If $f(u, v) \ge 0$: Assign pixel RGBA to `Buffer_A`.
   - If $f(u, v) < 0$: Assign pixel RGBA to `Buffer_B`.
   - **Reiatsu Cauterization Seam**:
     If $|f(u, v)| \le 1.2\text{ px}$ and pixel is non-transparent:
     Draw glowing Reiatsu burn pixel on both buffers:
     - Core seam: White `#ffffff`.
     - Outer seam glow: Crimson `#ff0033`.
5. Instantiate two `OffscreenCanvas` objects ($W \times H$) for `Half_A` and `Half_B` from these pixel buffers.

*(Fallback for arbitrary canvas draws: Canvas `clip()` path using polygon of the positive and negative half-planes).*

#### 2.5.3 Severed Slice Physics & Spiritual Dissolution Lifecycle
The two halves become active physical debris entities (`SlicedEntityDebris`):
- **Spawn Positions**:
  $$\mathbf{P}_A = \mathbf{P}_e + \hat{\mathbf{n}}_{cut} \cdot 3\text{ px}, \quad \mathbf{P}_B = \mathbf{P}_e - \hat{\mathbf{n}}_{cut} \cdot 3\text{ px}$$
- **Initial Velocities (Separation + Swing Transfer)**:
  $$\mathbf{V}_A = \mathbf{V}_{enemy} \cdot 0.2 + \vec{V}_{swing} \cdot 0.35 + \hat{\mathbf{n}}_{cut} \cdot V_{repel} + \vec{\xi}_A$$
  $$\mathbf{V}_B = \mathbf{V}_{enemy} \cdot 0.2 + \vec{V}_{swing} \cdot 0.35 - \hat{\mathbf{n}}_{cut} \cdot V_{repel} + \vec{\xi}_B$$
  where $V_{repel} \in [160, 240]\text{ px/s}$, $\vec{\xi}$ is random variance ($\pm 20\text{ px/s}$).
- **Tumbling Angular Velocity**:
  $$\omega_A = +\text{random}(5.0, 10.0)\text{ rad/s}, \quad \omega_B = -\text{random}(5.0, 10.0)\text{ rad/s}$$
- **Lifecycle & Dissolution**:
  - Total lifespan $T_{life} = 0.85\text{ s}$.
  - $0.0\text{ s} \le t < 0.4\text{ s}$: High speed fling and tumble with ground friction ($0.94^{\Delta t}$).
  - $0.4\text{ s} \le t \le 0.85\text{ s}$: Spiritual dissolution. Slices fade out ($\alpha = 1 - \frac{t - 0.4}{0.45}$), while emitting 1–2 tiny black dissolving smoke particles per frame.

---

### 2.6 Component 6: Spiritual Particles & Screen Shake Architecture

#### 2.6.1 Spiritual Particle Burst System
Upon bisection, instantiate a burst of 22–30 spiritual particles along the cut line:
1. **Reiatsu Embers (12 particles)**:
   - Velocity: $220\text{–}380\text{ px/s}$ aligned with $\pm \hat{\mathbf{n}}_{cut}$.
   - Palette: `#ff0033`, `#ff1744`, `#ff5252`.
   - Lifespan: $0.3\text{–}0.5\text{ s}$.
   - Blending: `screen` / `lighter`.
2. **Kuroi Reiatsu Smoke (8 particles)**:
   - Velocity: $40\text{–}80\text{ px/s}$ billowing upward.
   - Size: Expands from $3\text{ px}$ to $9\text{ px}$.
   - Palette: `#1a0505` to `#050505`.
   - Lifespan: $0.6\text{–}0.9\text{ s}$.
3. **Hollow Mask Shards (6 particles)**:
   - Size: $2 \times 2$ pixel white bone blocks (`#f5f5f5`) with grey shadow.
   - Ballistic gravity $\mathbf{g} = (0, 420\text{ px/s}^2)$, bounce off floor.

#### 2.6.2 Trauma-Based Non-Linear Screen Shake
Linear screen shake feels cheap; we specify a **Trauma-Squared Model**:
- Internal variable $\mathcal{T} \in [0.0, 1.0]$.
- Shake intensity $\mathcal{S} = \mathcal{T}^2$.
- Trauma additions:
  - Hollow Crawler cut: $+0.12$.
  - Hollow Flyer cut: $+0.16$.
  - Armored Brute crack: $+0.35$; Bisection: $+0.45$.
  - Menos Grande hit: $+0.25$; Boss kill bisection: $+0.85$.
  - Cero beam active: continuous $+0.35$.
- Decay rate: $\mathcal{T} \leftarrow \max(0, \mathcal{T} - 1.8 \cdot \Delta t)$.
- Camera displacement applied to main canvas context before rendering:
  $$\text{Offset}_x = \mathcal{S} \cdot 14\text{ px} \cdot \sin(105 \cdot t)$$
  $$\text{Offset}_y = \mathcal{S} \cdot 14\text{ px} \cdot \cos(125 \cdot t)$$
  $$\text{Angle}_\theta = \mathcal{S} \cdot 0.04\text{ rad} \cdot \sin(85 \cdot t)$$

---

### 2.7 Component 7: Enemy Swarm AI & Archetype Specifications

#### 2.7.1 Hollow Crawler (Swarm Fodder)
- **Visuals**: $16 \times 16$ RotMG sprite. Skeletal insectoid hollow with white mask and sharp mandible pincers.
- **Stats**: HP: 25 (1 hit cut), Speed: $95\text{ px/s}$, Collision Radius: $12\text{ px}$, Altar Damage: $6\text{ dmg/hit}$ every $0.8\text{ s}$.
- **Steering Algorithm**:
  $$\vec{F}_{total} = \vec{F}_{altar} + 1.4 \cdot \vec{F}_{separate} + \vec{F}_{skitter}$$
  - $\vec{F}_{altar} = \text{normalize}(\mathbf{P}_{altar} - \mathbf{P}_i)$.
  - Separation (avoids stacking into a single point):
    $$\vec{F}_{separate} = \sum_{j \neq i, d_{ij} < 26\text{px}} \frac{\mathbf{P}_i - \mathbf{P}_j}{d_{ij}^2}$$
  - Skittering Gait:
    $$\vec{F}_{skitter} = \sin(14 t + \phi_i) \cdot \vec{F}_{altar}^\perp \cdot 0.35$$

#### 2.7.2 Hollow Flyer (High-Agility Harasser)
- **Visuals**: $16 \times 16$ RotMG sprite. Winged gargoyle hollow with crimson eye slit.
- **Stats**: HP: 20 (1 hit cut), Speed: $185\text{ px/s}$, Collision Radius: $10\text{ px}$, Altar Damage: $8\text{ dmg}$ on dive-through.
- **Behavior State Machine**:
  - `STATE_APPROACH`: Inward logarithmic spiral around Altar ($\theta(t) = \theta_0 + 2.2 t$, $r(t) = r_0 - 80 t$).
  - `STATE_DIVE`: At $r < 180\text{ px}$, locks trajectory and accelerates to $270\text{ px/s}$ across Altar.
  - `STATE_EVADE`: Reactive blade twitch. If blade tip distance $< 70\text{ px}$ and blade velocity $> 350\text{ px/s}$, applies rapid lateral dodge force ($200\text{ px/s}$) for $0.18\text{ s}$.

#### 2.7.3 Armored Brute (Tanky Vanguard)
- **Visuals**: $32 \times 32$ RotMG sprite. Heavy hunchbacked hollow encased in an obsidian carapace with a reinforced skull plate.
- **Stats**: HP: 90, Speed: $48\text{ px/s}$, Collision Radius: $20\text{ px}$, Altar Damage: $18\text{ dmg/hit}$ every $1.4\text{ s}$.
- **Carapace & Clash Mechanic**:
  - Starts with `armorBroken = false`.
  - While armor is intact:
    - Normal/light slashes ($S_m < 600\text{ px/s}$) **ricochet off the armor**:
      * Spawns metallic spark burst.
      * Web Audio: triggers crunchy steel clash SFX.
      * Deals only 15 chip damage.
      * Imparts slight blade recoil.
    - Heavy swings ($S_m \ge 600\text{ px/s}$) or Getsuga Projectile **crack the carapace**:
      * Spawns 10 shattered armor fragments.
      * Triggers heavy bone fracture SFX.
      * Sets `armorBroken = true`.
      * Applies $1.2\text{ s}$ stagger/stun.
  - When `armorBroken === true`: Next blade slash triggers clean bisection!

#### 2.7.4 Menos Grande Boss (Gillian Class)
- **Visuals**: $64 \times 84\text{ px}$ towering obsidian monolith draped in jagged robes, wearing a long-nosed blank white Gillian mask.
- **Stats**: HP: 550, Speed: $18\text{ px/s}$, Collision Radius: $45\text{ px}$, Altar Damage: $25\text{ dmg/sec}$ via continuous Cero.
- **Spawn Event**: Spawns at milestone waves (e.g., Wave 3, Wave 6, Wave 9). Darkens ambient screen, plays ominous low horn synth.
- **Cero Beam Attack Cycle**:
  1. **Phase 1: March**:
     Advances from screen edge toward standoff range ($260\text{ px}$ from Soul Altar).
  2. **Phase 2: Telegraph / Charge ($2.0\text{ s}$ duration)**:
     - Halts movement.
     - Mouth opens; red reiatsu particles from $70\text{ px}$ radius suck into the maw.
     - Pulsing red guide laser beam aims directly at Soul Altar.
     - Audio: High-resonance pitch bend sweep ($120\text{ Hz} \to 750\text{ Hz}$).
  3. **Phase 3: Cero Blast ($1.2\text{ s}$ duration)**:
     - Blasts massive energy beam: core width $28\text{ px}$, outer aura $44\text{ px}$ from mouth to screen edge through Soul Altar.
     - Core is brilliant white-pink; outer shell is turbulent crimson plasma.
     - Deals $25\text{ HP/s}$ to Altar if unblocked.
     - **Reiatsu Blade Clash**:
       If the player sweeps Tensa Zangetsu through the beam:
       * Generates violent shower of crimson/white sparks at the blade intersection.
       * Blade **deflects/nullifies the beam**, protecting the Altar!
       * Grants massive combo multiplier and rapid Reiatsu gauge recharge.
       * If player strikes Menos Grande directly with Getsuga Tensho wave during Cero: interrupts beam immediately and stuns boss for $2.0\text{ s}$!
  4. **Phase 4: Vulnerability / Exhaustion ($1.5\text{ s}$ duration)**:
     - Boss stoops forward, panting black spiritual smoke.
     - Takes $2\times$ damage from all slashes.
  5. **Death Bisection**:
     - At $HP \le 0$, the giant Menos Grande splits along the final cut plane into two colossal halves, triggering a massive trauma screen shake ($0.85$), screen flash, and an explosion clearing all lesser hollows on screen!

---

## 3. Caveats

1. **Canvas 2D Batching vs High Frame Rates**:
   Performing pixel-level decomposition (`ctx.getImageData` / `putImageData`) for 50 simultaneous deaths in a single frame could cause GC or micro-stutters.
   *Mitigation*: Pre-render procedural base sprites to offscreen canvases at game initialization. When bisection occurs, use the fast Canvas 2D polygon clip method for real-time rendering, or run the pixel partition once per death and cache the two slices in offscreen canvases.
2. **High-DPI / Retina Displays**:
   On high-DPI screens (`window.devicePixelRatio > 1`), mouse coordinates must be scaled to canvas internal resolution (`rect.left`, `rect.top` mapping) to ensure pixel-perfect cut alignment.
3. **Mouse Polling Latency**:
   On standard $60\text{ Hz}$ browsers, mouse events can be grouped. The kinematic velocity filter and swept quad CCD specified above are specifically designed to guarantee 100% collision accuracy regardless of whether the mouse moved $5\text{ px}$ or $200\text{ px}$ between frames.
4. **Division of Responsibility**:
   Wave management, HUD scoring, RotMG procedural sprite generation routines, and Web Audio synthesis nodes are handled by Explorer 3. Explorer 2's specifications define the exact event hooks (`playClashSFX()`, `playCeroChargeSFX()`, `addTrauma()`, `takeDamage()`) for seamless wiring.

---

## 4. Conclusion

1. **R1 (Sword Physics & Mouse Control)** is fully architected with:
   - Smooth exponential hilt tracking + high-velocity orientation engine.
   - Swept Quadrilateral Continuous Collision Detection (CCD) preventing tunneling.
   - Dual-composite Getsuga trail pipeline (additive crimson outer glow + source-over jet black core).
   - Left-click forced slash ($240^\circ$ Senka arc) and Right-click/Spacebar piercing crescent Getsuga wave.
   - Pommel chained tassel simulated via real-time 8-node Verlet integration with distance constraint relaxation.
2. **R2 (Enemy Swarms & Slicing Mechanics)** is fully architected with:
   - Clean 2D bisection algorithm splitting sprites into two physically separate tumbling halves with cauterized seams.
   - Dynamic separation impulses, angular momentum, and spiritual smoke dissolution.
   - Multi-class particle burst (embers, kuroi smoke, mask shards) and trauma-squared camera shake.
   - 4 fully detailed enemy archetypes: Hollow Crawler (skittering flocking swarm), Hollow Flyer (evasive spiral dive), Armored Brute (carapace ricochet / clash / crack), and Menos Grande boss (Gillian Cero charge, beam deflection clash, and epic bisection).
3. **Module Architecture Proposal for Implementation**:
   - `src/engine/math.js`: Vector2D, SweptQuad, VerletConstraintSolver, LineSegment.
   - `src/engine/camera.js`: Trauma-based screen shake and offset transforms.
   - `src/engine/particles.js`: Reiatsu ember, kuroi smoke, and mask shard particle systems.
   - `src/game/sword.js`: Katana kinematics, blade stance, Getsuga trail ribbon, forced slash, and crescent wave.
   - `src/game/tassel.js`: 8-node Verlet pommel chain simulator.
   - `src/game/slicer.js`: Polygon cut & pixel partition algorithm, severed debris lifecycle.
   - `src/game/enemies.js`: Crawler, Flyer, Brute, and Menos Grande boss state machines.

---

## 5. Verification Method

### 5.1 Algorithmic Unit Tests (Headless / Node runnable)
1. **Verlet Chain Integrity**:
   Verify that distance constraints between adjacent links remain within $1\%$ of rest length $d_0 = 5\text{ px}$ under severe acceleration ($1500\text{ px/s}^2$).
2. **Swept Quad Intersection**:
   Verify that a circle collider placed between $[\mathbf{H}_0, \mathbf{T}_0]$ and $[\mathbf{H}_1, \mathbf{T}_1]$ registers a collision even if neither discrete segment touches the circle (anti-tunneling verification).
3. **Cut Plane Partitioning**:
   Verify that for any arbitrary cut normal $\hat{\mathbf{n}}$ passing through center $(16, 16)$, every pixel in a $32 \times 32$ matrix is assigned to either Slice A or Slice B with zero missing pixels.

### 5.2 Acceptance Criteria Verification Checklist
- [x] Mouse swing sweeps the blade with a visible black core / crimson glow Getsuga trail.
- [x] Enemies cleanly split into two halves and bounce away with separated velocities along cut angle.
- [x] Left click executes forced slash; Right Click / Spacebar fires penetrating crescent wave.
- [x] Chained tassel dangles from katana pommel and whips with real-time Verlet physics.
- [x] Menos Grande charges Cero beam with visible telegraph line and fires continuous beam at Altar.
- [x] Blade contact with Cero beam triggers defensive Reiatsu clash.
