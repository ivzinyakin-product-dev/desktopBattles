# Dead Ends Log

| Iteration | Approach Tried | Why It Failed | Files Touched |
|-----------|---------------|---------------|---------------|
| M1 Iter 1 | Convex-only winding test in `SweptQuad.containsPoint` | Sword swings combining rotation + translation produce concave swept quads in ~30% of cases, causing small enemy colliders inside blade sweep to tunnel undetected | `src/engine/Vector2.js` |
| M1 Iter 1 | Joining multi-char hex color (`#0a0a0c`) into row strings in `applyOutline` | Corrupted row string length from 16 to 52+ chars, causing 7px outline bloat, 6px sprite shift, and truncation | `src/engine/SpriteGen.js` |
| M1 Iter 1 | Saturated particle pool overwriting index 0 | In bursts, repeatedly overwrote `pool[0]`, dropping 93% of burst particles | `src/engine/ParticleSystem.js` |
