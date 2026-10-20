/**
 * Tensa Zangetsu: Soul Altar Defense
 * src/engine/Vector2.js
 * 
 * 2D Vector mathematics and Continuous Collision Detection (CCD) Swept Quad.
 * Zero external dependencies. Browser & Node.js compatible.
 */
(function (global) {
  'use strict';

  /**
   * 2D Vector class representing points, directions, and velocities.
   */
  class Vector2 {
    /**
     * @param {number} [x=0] 
     * @param {number} [y=0] 
     */
    constructor(x = 0, y = 0) {
      this.x = typeof x === 'number' && !isNaN(x) ? x : 0;
      this.y = typeof y === 'number' && !isNaN(y) ? y : 0;
    }

    /**
     * Returns a new vector (this + v)
     * @param {Vector2|{x: number, y: number}} v 
     * @returns {Vector2}
     */
    add(v) {
      return new Vector2(this.x + v.x, this.y + v.y);
    }

    /**
     * Mutates this vector by adding v
     * @param {Vector2|{x: number, y: number}} v 
     * @returns {Vector2} this
     */
    addMut(v) {
      this.x += v.x;
      this.y += v.y;
      return this;
    }

    /**
     * Returns a new vector (this - v)
     * @param {Vector2|{x: number, y: number}} v 
     * @returns {Vector2}
     */
    sub(v) {
      return new Vector2(this.x - v.x, this.y - v.y);
    }

    /**
     * Mutates this vector by subtracting v
     * @param {Vector2|{x: number, y: number}} v 
     * @returns {Vector2} this
     */
    subMut(v) {
      this.x -= v.x;
      this.y -= v.y;
      return this;
    }

    /**
     * Returns a new vector scaled by s
     * @param {number} s 
     * @returns {Vector2}
     */
    scale(s) {
      return new Vector2(this.x * s, this.y * s);
    }

    /**
     * Mutates this vector by scaling by s
     * @param {number} s 
     * @returns {Vector2} this
     */
    scaleMut(s) {
      this.x *= s;
      this.y *= s;
      return this;
    }

    /**
     * Calculates the Euclidean length (magnitude)
     * @returns {number}
     */
    mag() {
      return Math.hypot(this.x, this.y);
    }

    /**
     * Calculates the squared Euclidean length (avoids Math.sqrt)
     * @returns {number}
     */
    magSq() {
      return this.x * this.x + this.y * this.y;
    }

    /**
     * Returns a normalized unit vector with length 1.
     * Returns Vector2(0, 0) if magnitude is 0 to avoid NaN.
     * @returns {Vector2}
     */
    normalize() {
      const m = Math.hypot(this.x, this.y);
      if (m > 1e-9) {
        return new Vector2(this.x / m, this.y / m);
      }
      return new Vector2(0, 0);
    }

    /**
     * Calculates Euclidean distance to vector v
     * @param {Vector2|{x: number, y: number}} v 
     * @returns {number}
     */
    dist(v) {
      return Math.hypot(this.x - v.x, this.y - v.y);
    }

    /**
     * Calculates squared Euclidean distance to vector v
     * @param {Vector2|{x: number, y: number}} v 
     * @returns {number}
     */
    distSq(v) {
      const dx = this.x - v.x;
      const dy = this.y - v.y;
      return dx * dx + dy * dy;
    }

    /**
     * Dot product of this vector and v
     * @param {Vector2|{x: number, y: number}} v 
     * @returns {number}
     */
    dot(v) {
      return this.x * v.x + this.y * v.y;
    }

    /**
     * 2D scalar cross product (z-component): this.x * v.y - this.y * v.x
     * @param {Vector2|{x: number, y: number}} v 
     * @returns {number}
     */
    cross(v) {
      return this.x * v.y - this.y * v.x;
    }

    /**
     * Linear interpolation between this vector and v by factor t [0, 1]
     * @param {Vector2|{x: number, y: number}} v 
     * @param {number} t 
     * @returns {Vector2}
     */
    lerp(v, t) {
      return new Vector2(
        this.x + (v.x - this.x) * t,
        this.y + (v.y - this.y) * t
      );
    }

    /**
     * Returns the angle of the vector in radians (-PI to PI)
     * @returns {number}
     */
    angle() {
      return Math.atan2(this.y, this.x);
    }

    /**
     * Returns the signed angle between this vector and v
     * @param {Vector2|{x: number, y: number}} v 
     * @returns {number}
     */
    angleTo(v) {
      return Math.atan2(this.cross(v), this.dot(v));
    }

    /**
     * Rotates this vector by rad radians counter-clockwise
     * @param {number} rad 
     * @returns {Vector2}
     */
    rotate(rad) {
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return new Vector2(
        this.x * cos - this.y * sin,
        this.x * sin + this.y * cos
      );
    }

    /**
     * Clones this vector
     * @returns {Vector2}
     */
    clone() {
      return new Vector2(this.x, this.y);
    }

    /**
     * Mutates coordinates
     * @param {number} x 
     * @param {number} y 
     * @returns {Vector2} this
     */
    set(x, y) {
      this.x = x;
      this.y = y;
      return this;
    }

    /**
     * Equality check with epsilon tolerance
     * @param {Vector2|{x: number, y: number}} v 
     * @param {number} [epsilon=1e-6] 
     * @returns {boolean}
     */
    equals(v, epsilon = 1e-6) {
      if (!v) return false;
      return Math.abs(this.x - v.x) <= epsilon && Math.abs(this.y - v.y) <= epsilon;
    }

    // Static Helpers
    static zero() {
      return new Vector2(0, 0);
    }

    static fromAngle(rad, length = 1) {
      return new Vector2(Math.cos(rad) * length, Math.sin(rad) * length);
    }

    static distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    static dot(a, b) {
      return a.x * b.x + a.y * b.y;
    }

    static cross(a, b) {
      return a.x * b.y - a.y * b.x;
    }
  }

  /**
   * SweptQuad Continuous Collision Detection (CCD) volume.
   * Represents the 2D quadrilateral swept by a blade line segment between consecutive ticks.
   * Prevents high-velocity mouse flick tunneling through circle colliders.
   */
  class SweptQuad {
    /**
     * Constructs a swept quadrilateral from 4 vertices in perimeter order.
     * Default perimeter winding: H0 (prevHilt) -> T0 (prevTip) -> T1 (currTip) -> H1 (currHilt).
     * @param {Vector2|{x: number, y: number}} p1 
     * @param {Vector2|{x: number, y: number}} p2 
     * @param {Vector2|{x: number, y: number}} p3 
     * @param {Vector2|{x: number, y: number}} p4 
     */
    constructor(p1, p2, p3, p4) {
      this.points = [
        new Vector2(p1.x, p1.y),
        new Vector2(p2.x, p2.y),
        new Vector2(p3.x, p3.y),
        new Vector2(p4.x, p4.y)
      ];
      this._bounds = null;
    }

    /**
     * Factory constructor from blade segments at t0 and t1
     * @param {Vector2|{x: number, y: number}} prevHilt 
     * @param {Vector2|{x: number, y: number}} prevTip 
     * @param {Vector2|{x: number, y: number}} currHilt 
     * @param {Vector2|{x: number, y: number}} currTip 
     * @returns {SweptQuad}
     */
    static fromBladeSegments(prevHilt, prevTip, currHilt, currTip) {
      return new SweptQuad(prevHilt, prevTip, currTip, currHilt);
    }

    /**
     * Calculates the Axis-Aligned Bounding Box (AABB) of the quad.
     * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
     */
    getBounds() {
      if (this._bounds) return this._bounds;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (let i = 0; i < 4; i++) {
        const pt = this.points[i];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }

      this._bounds = { minX, minY, maxX, maxY };
      return this._bounds;
    }

    /**
     * Tests if a query point lies inside the quad volume using Jordan Curve Theorem (Ray-Casting).
     * Unconditionally handles both convex and concave quadrilaterals (e.g. chevrons, darts)
     * generated during simultaneous blade translation and rotation.
     * Supports both (point) and (px, py) invocation signatures.
     * @param {Vector2|{x: number, y: number}|number} p Query point or X coordinate
     * @param {number} [py] Optional Y coordinate if p is number
     * @returns {boolean}
     */
    containsPoint(p, py) {
      let px;
      if (typeof p === 'number' && typeof py === 'number') {
        px = p;
      } else if (p && typeof p.x === 'number' && typeof p.y === 'number') {
        px = p.x;
        py = p.y;
      } else {
        return false;
      }

      let inside = false;
      const pts = this.points;

      for (let i = 0, j = 3; i < 4; j = i++) {
        const xi = pts[i].x;
        const yi = pts[i].y;
        const xj = pts[j].x;
        const yj = pts[j].y;

        const intersect = ((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi);

        if (intersect) {
          inside = !inside;
        }
      }

      return inside;
    }

    /**
     * Calculates squared minimum distance from point p to line segment ab.
     * @param {Vector2|{x: number, y: number}} p 
     * @param {Vector2|{x: number, y: number}} a 
     * @param {Vector2|{x: number, y: number}} b 
     * @returns {number} squared distance
     */
    static pointToSegmentDistSq(p, a, b) {
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const apx = p.x - a.x;
      const apy = p.y - a.y;
      const lenSq = abx * abx + aby * aby;

      if (lenSq < 1e-9) {
        return apx * apx + apy * apy;
      }

      let t = (apx * abx + apy * aby) / lenSq;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;

      const projX = a.x + t * abx;
      const projY = a.y + t * aby;
      const dx = p.x - projX;
      const dy = p.y - projY;

      return dx * dx + dy * dy;
    }

    /**
     * Continuous Collision Detection (CCD) test against a 2D circle collider.
     * Returns true if the swept blade volume overlaps the circle.
     * Adds numerical epsilon tolerance (1e-9) to narrowphase distance check to avoid
     * floating-point roundoff rejection on exact corner grazes.
     * Supports both intersectsCircle(center, radius) and intersectsCircle(cx, cy, r).
     * @param {Vector2|{x: number, y: number}|number} center Circle center or cx
     * @param {number} radius Circle collision radius or cy
     * @param {number} [r] Circle radius if cx, cy, r signature used
     * @returns {boolean}
     */
    intersectsCircle(center, radius, r) {
      let cx, cy, rad;
      if (typeof center === 'number' && typeof radius === 'number' && typeof r === 'number') {
        cx = center;
        cy = radius;
        rad = r;
      } else if (center && typeof center.x === 'number' && typeof center.y === 'number' && typeof radius === 'number') {
        cx = center.x;
        cy = center.y;
        rad = radius;
      } else {
        return false;
      }

      if (rad <= 0 || Number.isNaN(rad) || Number.isNaN(cx) || Number.isNaN(cy)) {
        return false;
      }

      const bounds = this.getBounds();

      // Phase 1: Broadphase AABB rejection
      if (
        cx + rad < bounds.minX ||
        cx - rad > bounds.maxX ||
        cy + rad < bounds.minY ||
        cy - rad > bounds.maxY
      ) {
        return false;
      }

      // Phase 2: Check if circle center is inside the swept polygon volume
      if (this.containsPoint(cx, cy)) {
        return true;
      }

      // Phase 3: Narrowphase edge intersection tests (all 4 boundary segments)
      // Numerical epsilon tolerance (1e-9) prevents IEEE-754 precision overshoot on exact corner grazes
      const rSq = rad * rad;
      const tolRSq = rSq * (1 + 1e-9);
      const queryPt = (center && typeof center.x === 'number') ? center : { x: cx, y: cy };

      for (let i = 0; i < 4; i++) {
        const a = this.points[i];
        const b = this.points[(i + 1) % 4];
        if (SweptQuad.pointToSegmentDistSq(queryPt, a, b) <= tolRSq) {
          return true;
        }
      }

      return false;
    }
  }

  // Universal Modular Export Pattern
  global.TZ = global.TZ || {};
  global.TZ.Vector2 = Vector2;
  global.TZ.SweptQuad = SweptQuad;
  Vector2.SweptQuad = SweptQuad;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Vector2;
    module.exports.Vector2 = Vector2;
    module.exports.SweptQuad = SweptQuad;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
