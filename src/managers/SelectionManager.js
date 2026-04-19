import { EventEmitter } from '../utils/EventEmitter.js';
import { MIN_DIMENSION, isValidRect, normalizeNumber } from '../utils/constants.js';

/**
 * Selection coordinates.
 * @typedef {Object} SelectionCoords
 * @property {number} x - Left position
 * @property {number} y - Top position
 * @property {number} x2 - Right position
 * @property {number} y2 - Bottom position
 * @property {number} w - Width
 * @property {number} h - Height
 */

/**
 * Manages the final (validated) selection and its transformations.
 * Emits events: 'change', 'select', 'release'.
 */
export class SelectionManager extends EventEmitter {
  /**
   * @param {Object} options
   * @param {number} [options.canvasWidth=1] - Canvas width (widget scale)
   * @param {number} [options.canvasHeight=1] - Canvas height
   * @param {number} [options.imageWidth=1] - Actual image width
   * @param {number} [options.imageHeight=1] - Actual image height
   * @param {number} [options.fadeTime=400] - Animation duration in ms
   */
  constructor(options = {}) {
    super();

    this.canvasWidth = normalizeNumber(options.canvasWidth, MIN_DIMENSION, MIN_DIMENSION);
    this.canvasHeight = normalizeNumber(options.canvasHeight, MIN_DIMENSION, MIN_DIMENSION);
    this.imageWidth = normalizeNumber(options.imageWidth, MIN_DIMENSION, MIN_DIMENSION);
    this.imageHeight = normalizeNumber(options.imageHeight, MIN_DIMENSION, MIN_DIMENSION);
    this.fadeTime = normalizeNumber(options.fadeTime, 400, 0);

    /** @type {SelectionCoords} @private */
    this._coords = this._createEmptyCoords();

    /** @private */
    this._animationId = null;
  }

  /**
   * Access to coordinates (read-only).
   * @returns {SelectionCoords}
   */
  get coords() {
    return this._coords;
  }

  /**
   * Sets the selection.
   * @param {{x: number, y: number, x2: number, y2: number}} rect
   */
  setSelect(rect) {
    if (!isValidRect(rect)) {
      console.warn('[SelectionManager] setSelect: invalid coordinates', rect);
      return;
    }

    const { x, y, x2, y2 } = rect;
    const minX = Math.min(x, x2);
    const minY = Math.min(y, y2);
    const maxX = Math.max(x, x2);
    const maxY = Math.max(y, y2);

    this._coords = {
      x: minX,
      y: minY,
      x2: maxX,
      y2: maxY,
      w: maxX - minX,
      h: maxY - minY
    };

    this._emit('change', this.tellSelect(), this.tellScaled());
  }

  /**
   * Returns the selection in image coordinates.
   * @returns {SelectionCoords}
   */
  tellSelect() {
    const scaleX = this.imageWidth / this.canvasWidth;
    const scaleY = this.imageHeight / this.canvasHeight;
    const c = this._coords;

    return {
      x: c.x * scaleX,
      y: c.y * scaleY,
      x2: c.x2 * scaleX,
      y2: c.y2 * scaleY,
      w: c.w * scaleX,
      h: c.h * scaleY
    };
  }

  /**
   * Returns the selection in widget coordinates.
   * @returns {SelectionCoords}
   */
  tellScaled() {
    return { ...this._coords };
  }

  /**
   * Updates canvas dimensions while preserving the selection in image space.
   * Rescales internal canvas-space coords so the selection tracks the image
   * when the widget is resized (e.g. window resize, responsive layouts).
   * @param {number} width
   * @param {number} height
   */
  setCanvasSize(width, height) {
    const newW = normalizeNumber(width, MIN_DIMENSION, MIN_DIMENSION);
    const newH = normalizeNumber(height, MIN_DIMENSION, MIN_DIMENSION);
    const oldW = this.canvasWidth;
    const oldH = this.canvasHeight;

    if (newW === oldW && newH === oldH) return;

    const sx = newW / oldW;
    const sy = newH / oldH;
    const c = this._coords;
    this._coords = {
      x: c.x * sx,
      y: c.y * sy,
      x2: c.x2 * sx,
      y2: c.y2 * sy,
      w: c.w * sx,
      h: c.h * sy
    };

    this.canvasWidth = newW;
    this.canvasHeight = newH;
  }

  /**
   * Animates the selection to a target rectangle.
   * @param {{x: number, y: number, x2: number, y2: number}} target
   * @param {Function} [callback] - Called at the end of the animation
   */
  animateTo(target, callback) {
    if (!isValidRect(target)) {
      console.warn('[SelectionManager] animateTo: invalid coordinates', target);
      return;
    }

    this.cancelAnimation();

    const start = { ...this._coords };
    const end = {
      x: Math.min(target.x, target.x2),
      y: Math.min(target.y, target.y2),
      x2: Math.max(target.x, target.x2),
      y2: Math.max(target.y, target.y2)
    };
    end.w = end.x2 - end.x;
    end.h = end.y2 - end.y;

    const startTime = performance.now();
    const duration = this.fadeTime;

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = this._easeOutQuad(progress);

      const x = this._lerp(start.x, end.x, eased);
      const y = this._lerp(start.y, end.y, eased);
      const x2 = this._lerp(start.x2, end.x2, eased);
      const y2 = this._lerp(start.y2, end.y2, eased);

      this._coords = {
        x,
        y,
        x2,
        y2,
        w: x2 - x,
        h: y2 - y
      };

      this._emit('change', this.tellSelect(), this.tellScaled());

      if (progress < 1) {
        this._animationId = requestAnimationFrame(tick);
      } else {
        this._animationId = null;
        this._emit('select', this.tellSelect(), this.tellScaled());
        if (typeof callback === 'function') {
          callback();
        }
      }
    };

    this._animationId = requestAnimationFrame(tick);
  }

  /**
   * Cancels the current animation.
   */
  cancelAnimation() {
    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  /**
   * @returns {boolean} True if an animation is in progress
   */
  isAnimating() {
    return this._animationId !== null;
  }

  /**
   * Releases the selection and emits 'release' if needed.
   */
  release() {
    this.cancelAnimation();
    const hadSelection = this._coords.w > 0 || this._coords.h > 0;
    this._coords = this._createEmptyCoords();

    if (hadSelection) {
      this._emit('release');
    }
  }

  /**
   * Cleans up resources.
   */
  dispose() {
    this.cancelAnimation();
    this.offAll();
  }

  // ─────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * @private
   * @returns {SelectionCoords}
   */
  _createEmptyCoords() {
    return Object.freeze({ x: 0, y: 0, x2: 0, y2: 0, w: 0, h: 0 });
  }

  /**
   * Linear interpolation.
   * @private
   */
  _lerp(start, end, t) {
    return start + (end - start) * t;
  }

  /**
   * Quadratic easing (deceleration).
   * @private
   */
  _easeOutQuad(t) {
    return t * (2 - t);
  }
}
