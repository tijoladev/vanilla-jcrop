import { EventEmitter } from '../utils/EventEmitter.js';
import { AnchorType, ActionType, RelativePosition, isValidPoint } from '../utils/constants.js';
import { Constraints } from '../utils/Constraints.js';

/**
 * Manages temporary state during a selection interaction (drag).
 * Emits events: 'update', 'finalize'.
 */
export class PreselectionManager extends EventEmitter {
  /**
   * @param {Object} options
   * @param {number} options.canvasWidth
   * @param {number} options.canvasHeight
   * @param {number} [options.minWidth]
   * @param {number} [options.minHeight]
   * @param {number} [options.maxWidth]
   * @param {number} [options.maxHeight]
   * @param {number|null} [options.ratio]
   * @param {Function} [options.onUpdate] - Callback on each update (legacy)
   * @param {Function} [options.onFinalize] - Callback on finalization (legacy)
   * @param {SelectionManager} options.selectionManager
   */
  constructor(options = {}) {
    super();
    this.canvasWidth = options.canvasWidth || 0;
    this.canvasHeight = options.canvasHeight || 0;
    this.selectionManager = options.selectionManager;

    /** @private */
    this._state = null;

    this.constraints = new Constraints({
      ratio: options.ratio,
      minWidth: options.minWidth,
      minHeight: options.minHeight,
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight
    });

    // Support legacy callbacks via events
    this._setupLegacyCallbacks(options.onUpdate, options.onFinalize);
  }

  /**
   * Starts a preselection.
   * @param {{x: number, y: number}} startPoint - Start point
   * @param {{type: string, detail?: string}} action - Action type and detail
   */
  startPreselection(startPoint, action) {
    if (!isValidPoint(startPoint)) {
      console.warn('[PreselectionManager] startPreselection: invalid point', startPoint);
      return;
    }

    const { type, detail = null } = action;
    const originalSelection = this.selectionManager.tellScaled();

    this._state = {
      startPoint,
      currentPoint: startPoint,
      action: { type, detail },
      originalSelection,
      anchorPoint: null,
      anchorType: null,
      newSelection: null,
      checkedSelection: null
    };

    this._initializeAnchor(type, detail, originalSelection);
  }

  /**
   * Updates the preselection with the current position.
   * @param {{x: number, y: number}} currentPoint
   * @returns {Object|null} The validated selection or null
   */
  updatePreselection(currentPoint) {
    if (!this._state) return null;

    if (!isValidPoint(currentPoint)) {
      console.warn('[PreselectionManager] updatePreselection: invalid point', currentPoint);
      return this._state.checkedSelection;
    }

    this._state.currentPoint = currentPoint;
    const container = { width: this.canvasWidth, height: this.canvasHeight };

    if (this._state.action.type === 'move') {
      this._updateMove(container);
    } else {
      this._updateResize(currentPoint, container);
    }

    this._emit('update', this.getPreselection());
    return this._state.checkedSelection;
  }

  /**
   * Finalizes the preselection and transfers it to SelectionManager.
   */
  finalizePreselection() {
    if (!this._state || !this._state.checkedSelection) return;

    const checkedSelection = this._state.checkedSelection;
    this.selectionManager.setSelect(checkedSelection);
    this._state = null;
    this._emit('finalize', checkedSelection);
  }

  /**
   * Cancels the current preselection.
   */
  cancelPreselection() {
    this._state = null;
    this._emit('update', null);
  }

  /**
   * Returns preselection data for display.
   * @returns {Object|null}
   */
  getPreselection() {
    if (!this._state) return null;

    return {
      newSelection: this._state.newSelection,
      checkedSelection: this._state.checkedSelection,
      startPoint: this._state.startPoint,
      currentPoint: this._state.currentPoint
    };
  }

  /**
   * @returns {boolean} True if a preselection is active
   */
  isActive() {
    return this._state !== null;
  }

  /**
   * @returns {ActionType|null} The current action type
   */
  getActionType() {
    return this._state?.action.type ?? null;
  }

  /**
   * Cleans up resources.
   */
  dispose() {
    this._state = null;
    this.offAll();
  }

  // ─────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Configures legacy callbacks as event listeners.
   * @private
   */
  _setupLegacyCallbacks(onUpdate, onFinalize) {
    if (typeof onUpdate === 'function') {
      this.on('update', onUpdate);
    }
    if (typeof onFinalize === 'function') {
      this.on('finalize', onFinalize);
    }
  }

  /**
   * Initializes the anchor point based on action type.
   * @private
   */
  _initializeAnchor(type, detail, originalSelection) {
    switch (type) {
      case 'resize': {
        const oppositePos = RelativePosition.opposite(detail);
        this._state.anchorPoint = RelativePosition.toCoords(oppositePos, originalSelection);
        this._state.anchorType = this._getAnchorType(oppositePos);
        break;
      }

      case 'move':
        this._state.anchorPoint = this._state.startPoint;
        this._state.anchorType = AnchorType.POINT;
        break;

      default: // 'new'
        this._state.anchorPoint = this._state.startPoint;
        this._state.anchorType = AnchorType.POINT;
    }
  }

  /**
   * Determines the anchor type based on relative position.
   * @private
   */
  _getAnchorType(position) {
    if (position.rx === 0) return AnchorType.HORIZONTAL;
    if (position.ry === 0) return AnchorType.VERTICAL;
    return AnchorType.POINT;
  }

  /**
   * Updates state for a move operation.
   * @private
   */
  _updateMove(container) {
    const { originalSelection, startPoint, currentPoint } = this._state;

    const delta = {
      x: currentPoint.x - startPoint.x,
      y: currentPoint.y - startPoint.y
    };

    this._state.newSelection = {
      x: originalSelection.x + delta.x,
      y: originalSelection.y + delta.y,
      x2: originalSelection.x2 + delta.x,
      y2: originalSelection.y2 + delta.y
    };

    const result = this.constraints.checkPosition(this._state, container);
    this._state.checkedSelection = result.checkedSelection;
  }

  /**
   * Updates state for a create or resize operation.
   * @private
   */
  _updateResize(currentPoint, container) {
    const { anchorPoint, anchorType, originalSelection } = this._state;

    switch (anchorType) {
      case AnchorType.POINT:
        this._state.newSelection = {
          x: anchorPoint.x,
          y: anchorPoint.y,
          x2: currentPoint.x,
          y2: currentPoint.y
        };
        break;

      case AnchorType.HORIZONTAL:
        this._state.newSelection = {
          x: originalSelection.x,
          y: anchorPoint.y,
          x2: originalSelection.x2,
          y2: currentPoint.y
        };
        break;

      case AnchorType.VERTICAL:
        this._state.newSelection = {
          x: anchorPoint.x,
          y: originalSelection.y,
          x2: currentPoint.x,
          y2: originalSelection.y2
        };
        break;
    }

    const result = this.constraints.checkSize(this._state, container);
    this._state.checkedSelection = result.checkedSelection;
  }
}
