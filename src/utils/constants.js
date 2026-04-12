/**
 * Shared constants for JCrop.
 * @module constants
 */

/** Minimum value for dimensions (avoids division by zero) */
export const MIN_DIMENSION = 1;

/** Keys for the 8 resize handles */
export const HANDLE_KEYS = Object.freeze(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);

/** Z-index for display layers */
export const Z_INDEX = Object.freeze({
  GESTURE: 3,
  PRESELECTION_RAW: 4,
  SELECTION: 5,
  PRESELECTION_CONSTRAINED: 6,
  HANDLES: 10
});

/**
 * Anchor types for resizing.
 * @enum {string}
 */
export const AnchorType = Object.freeze({
  POINT: 'point',
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical'
});

/**
 * Preselection action types.
 * @enum {string}
 */
export const ActionType = Object.freeze({
  NEW: 'new',
  MOVE: 'move',
  RESIZE: 'resize'
});

/**
 * Ratio calculation methods.
 * @enum {string}
 */
export const RatioMethods = Object.freeze({
  MAXIMIZE: 'max',
  MINIMIZE: 'min',
  BY_WIDTH: 'width',
  BY_HEIGHT: 'height'
});

/**
 * Relative positions for handles and anchors.
 */
export const RelativePosition = Object.freeze({
  NW: { rx: -1, ry: -1 },
  N:  { rx:  0, ry: -1 },
  NE: { rx:  1, ry: -1 },
  E:  { rx:  1, ry:  0 },
  SE: { rx:  1, ry:  1 },
  S:  { rx:  0, ry:  1 },
  SW: { rx: -1, ry:  1 },
  W:  { rx: -1, ry:  0 },
  C:  { rx:  0, ry:  0 },

  /**
   * Normalizes an input to a relative position.
   * @param {string|{rx: number, ry: number}} input
   * @returns {{rx: number, ry: number}}
   */
  parse(input) {
    if (typeof input === 'string') {
      const key = input.toUpperCase();
      if (key in this && key !== 'parse' && key !== 'toCoords' && key !== 'opposite') {
        return this[key];
      }
      return { rx: 0, ry: 0 };
    }
    if (input && Number.isFinite(input.rx) && Number.isFinite(input.ry)) {
      return input;
    }
    return { rx: 0, ry: 0 };
  },

  /**
   * Converts a relative position to absolute coordinates.
   * @param {string|{rx: number, ry: number}} input
   * @param {{x: number, y: number, w: number, h: number}} rect
   * @returns {{x: number, y: number}}
   */
  toCoords(input, rect) {
    const { rx, ry } = this.parse(input);
    return {
      x: ((rx + 1) / 2) * rect.w + rect.x,
      y: ((ry + 1) / 2) * rect.h + rect.y
    };
  },

  /**
   * Returns the opposite position.
   * @param {string|{rx: number, ry: number}} input
   * @returns {{rx: number, ry: number}}
   */
  opposite(input) {
    const { rx, ry } = this.parse(input);
    return { rx: -rx, ry: -ry };
  }
});

// ─────────────────────────────────────────────────────────────────
// Validation utility functions
// ─────────────────────────────────────────────────────────────────

/**
 * Checks if a value is a finite number.
 * @param {*} value
 * @returns {boolean}
 */
export const isValidNumber = (value) => Number.isFinite(value);

/**
 * Checks if a rectangle has valid coordinates.
 * @param {{x?: number, y?: number, x2?: number, y2?: number}} rect
 * @returns {boolean}
 */
export const isValidRect = (rect) => {
  if (!rect || typeof rect !== 'object') return false;
  const { x, y, x2, y2 } = rect;
  return isValidNumber(x) && isValidNumber(y) && isValidNumber(x2) && isValidNumber(y2);
};

/**
 * Checks if a point has valid coordinates.
 * @param {{x?: number, y?: number}} point
 * @returns {boolean}
 */
export const isValidPoint = (point) => {
  if (!point || typeof point !== 'object') return false;
  return isValidNumber(point.x) && isValidNumber(point.y);
};

/**
 * Clamps a value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Normalizes a number with a default value and minimum.
 * @param {*} value
 * @param {number} defaultValue
 * @param {number} [minValue=0]
 * @returns {number}
 */
export const normalizeNumber = (value, defaultValue, minValue = 0) => {
  const num = Number(value);
  return isValidNumber(num) ? Math.max(num, minValue) : defaultValue;
};
