import { AnchorType, RatioMethods, clamp } from './constants.js';

/**
 * Manages dimension and position constraints for selections.
 */
export class Constraints {
  /**
   * @param {Object} options
   * @param {number|null} [options.ratio] - Width/height ratio (null = free)
   * @param {number} [options.minWidth=0]
   * @param {number} [options.minHeight=0]
   * @param {number} [options.maxWidth=Infinity]
   * @param {number} [options.maxHeight=Infinity]
   */
  constructor(options = {}) {
    this.ratio = options.ratio || null;
    this.minWidth = options.minWidth ?? 0;
    this.minHeight = options.minHeight ?? 0;
    this.maxWidth = options.maxWidth ?? Infinity;
    this.maxHeight = options.maxHeight ?? Infinity;
  }

  /**
   * Checks and adjusts a selection's position to stay within the container.
   * @param {Object} action - Action state with newSelection
   * @param {{width: number, height: number}} container - Container dimensions
   * @returns {Object} New state with checkedSelection
   */
  checkPosition(action, container) {
    const sel = this._normalizeRect(action.newSelection);

    // Shift if out of bounds
    if (sel.x < 0) {
      sel.x2 -= sel.x;
      sel.x = 0;
    }
    if (sel.x2 > container.width) {
      sel.x -= sel.x2 - container.width;
      sel.x2 = container.width;
    }
    if (sel.y < 0) {
      sel.y2 -= sel.y;
      sel.y = 0;
    }
    if (sel.y2 > container.height) {
      sel.y -= sel.y2 - container.height;
      sel.y2 = container.height;
    }

    return { ...action, checkedSelection: sel };
  }

  /**
   * Checks and adjusts a selection's size according to constraints.
   * @param {Object} action - Action state with newSelection, anchorPoint, anchorType, currentPoint
   * @param {{width: number, height: number}} container - Container dimensions
   * @returns {Object} New state with checkedSelection (null if impossible)
   */
  checkSize(action, container) {
    const zone = this._calculateAvailableZone(action, container);
    const size = this._calculateConstrainedSize(action, zone);

    if (!size) {
      return { ...action, checkedSelection: null };
    }

    const checkedSelection = this._anchorRect(action, zone.direction, size);
    return { ...action, checkedSelection };
  }

  /**
   * Normalizes a rectangle (ensures x < x2 and y < y2).
   * @private
   */
  _normalizeRect(rect) {
    let { x, y, x2, y2 } = rect;
    if (x > x2) [x, x2] = [x2, x];
    if (y > y2) [y, y2] = [y2, y];
    return { x, y, x2, y2 };
  }

  /**
   * Calculates the dimensions of a rectangle.
   * @private
   */
  _getRectSize(rect) {
    return {
      width: Math.abs(rect.x2 - rect.x),
      height: Math.abs(rect.y2 - rect.y)
    };
  }

  /**
   * Applies the ratio to dimensions.
   * @private
   */
  _applyRatio(size, method) {
    if (!this.ratio) return size;

    const { width, height } = size;
    const heightFromWidth = width / this.ratio;
    const widthFromHeight = height * this.ratio;

    switch (method) {
      case RatioMethods.BY_WIDTH:
        return { width, height: heightFromWidth };

      case RatioMethods.BY_HEIGHT:
        return { width: widthFromHeight, height };

      case RatioMethods.MAXIMIZE:
        return heightFromWidth > height
          ? { width, height: heightFromWidth }
          : { width: widthFromHeight, height };

      case RatioMethods.MINIMIZE:
        return heightFromWidth < height
          ? { width, height: heightFromWidth }
          : { width: widthFromHeight, height };

      default:
        return size;
    }
  }

  /**
   * Calculates the available zone for resizing.
   * @private
   */
  _calculateAvailableZone(action, container) {
    const { anchorPoint, anchorType, currentPoint } = action;
    const direction = this._getDirection(anchorPoint, currentPoint);

    let width = direction.x === -1 ? anchorPoint.x : container.width - anchorPoint.x;
    let height = direction.y === -1 ? anchorPoint.y : container.height - anchorPoint.y;

    // For axis anchors, the zone is symmetric
    if (anchorType === AnchorType.HORIZONTAL) {
      width = 2 * Math.min(anchorPoint.x, container.width - anchorPoint.x);
    } else if (anchorType === AnchorType.VERTICAL) {
      height = 2 * Math.min(anchorPoint.y, container.height - anchorPoint.y);
    }

    return { width, height, direction };
  }

  /**
   * Determines the movement direction.
   * @private
   */
  _getDirection(from, to) {
    return {
      x: Math.sign(to.x - from.x) || 1,
      y: Math.sign(to.y - from.y) || 1
    };
  }

  /**
   * Calculates the constrained size according to ratio and limits.
   * @private
   */
  _calculateConstrainedSize(action, zone) {
    const desired = this._getRectSize(action.newSelection);

    if (this.ratio) {
      return this._calculateSizeWithRatio(action.anchorType, desired, zone);
    }

    // Without ratio: check that constraints are consistent
    if (this.maxWidth < this.minWidth || this.maxHeight < this.minHeight) {
      return null;
    }

    return {
      width: clamp(desired.width, this.minWidth, this.maxWidth),
      height: clamp(desired.height, this.minHeight, this.maxHeight)
    };
  }

  /**
   * Calculates size with ratio constraint.
   * @private
   */
  _calculateSizeWithRatio(anchorType, desired, zone) {
    // Bounds adjusted to container
    const cappedMax = {
      width: Math.min(this.maxWidth, zone.width),
      height: Math.min(this.maxHeight, zone.height)
    };

    // Apply ratio to bounds
    const maxSize = this._applyRatio(cappedMax, RatioMethods.MINIMIZE);
    const minSize = this._applyRatio(
      { width: this.minWidth, height: this.minHeight },
      RatioMethods.MAXIMIZE
    );

    // Check feasibility
    if (maxSize.width < minSize.width || maxSize.height < minSize.height) {
      return null;
    }

    // Constrain to bounds
    const constrained = {
      width: clamp(desired.width, minSize.width, maxSize.width),
      height: clamp(desired.height, minSize.height, maxSize.height)
    };

    // Apply ratio according to anchor type
    const ratioMethod = anchorType === AnchorType.HORIZONTAL
      ? RatioMethods.BY_HEIGHT
      : anchorType === AnchorType.VERTICAL
        ? RatioMethods.BY_WIDTH
        : RatioMethods.MAXIMIZE;

    return this._applyRatio(constrained, ratioMethod);
  }

  /**
   * Positions a rectangle according to anchor and direction.
   * @private
   */
  _anchorRect(action, direction, size) {
    const { anchorPoint, anchorType } = action;
    const { width, height } = size;

    let x, y, x2, y2;

    switch (anchorType) {
      case AnchorType.HORIZONTAL:
        x = anchorPoint.x - width / 2;
        x2 = anchorPoint.x + width / 2;
        y = direction.y === -1 ? anchorPoint.y - height : anchorPoint.y;
        y2 = y + height;
        break;

      case AnchorType.VERTICAL:
        x = direction.x === -1 ? anchorPoint.x - width : anchorPoint.x;
        x2 = x + width;
        y = anchorPoint.y - height / 2;
        y2 = anchorPoint.y + height / 2;
        break;

      default: // POINT
        x = direction.x === -1 ? anchorPoint.x - width : anchorPoint.x;
        x2 = x + width;
        y = direction.y === -1 ? anchorPoint.y - height : anchorPoint.y;
        y2 = y + height;
    }

    return { x, y, x2, y2 };
  }
}
