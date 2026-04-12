import { EventEmitter } from '../utils/EventEmitter.js';
import { RelativePosition, HANDLE_KEYS, Z_INDEX } from '../utils/constants.js';

/**
 * Aggregates display data from SelectionManager and PreselectionManager.
 * Emits the 'display:update' event on each change.
 */
export class DisplayManager extends EventEmitter {
  /**
   * @param {Object} options
   * @param {SelectionManager} options.selectionManager
   * @param {PreselectionManager} options.preselectionManager
   * @param {number} [options.handleWidth=10]
   * @param {number} [options.handleHeight=10]
   * @param {number} options.canvasWidth
   * @param {number} options.canvasHeight
   */
  constructor(options = {}) {
    super();
    this.selectionManager = options.selectionManager;
    this.preselectionManager = options.preselectionManager;
    this.handleWidth = options.handleWidth || 10;
    this.handleHeight = options.handleHeight || 10;
    this.canvasWidth = options.canvasWidth;
    this.canvasHeight = options.canvasHeight;

    /** @private References to handlers for removal */
    this._boundHandlers = {
      onSelectionChange: () => this.update(),
      onPreselectionUpdate: () => this.update()
    };

    this._bindToManagers();
  }

  /**
   * Forces a display update.
   */
  update() {
    const displayData = this.computeDisplayData();
    this._emit('display:update', displayData);
  }

  /**
   * Computes complete display data.
   * @returns {Object}
   */
  computeDisplayData() {
    return {
      selection: this._computeSelection(),
      ...this._computePreselection(),
      handles: this._computeHandles()
    };
  }

  /**
   * Cleans up resources and unregisters listeners.
   */
  dispose() {
    // Remove listeners from SelectionManager
    this.selectionManager.off('change', this._boundHandlers.onSelectionChange);
    this.selectionManager.off('select', this._boundHandlers.onSelectionChange);
    this.selectionManager.off('release', this._boundHandlers.onSelectionChange);

    // Remove listeners from PreselectionManager
    this.preselectionManager.off('update', this._boundHandlers.onPreselectionUpdate);

    // Clean up our own events
    this._events = {};
    this._boundHandlers = null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Subscribes to manager events.
   * @private
   */
  _bindToManagers() {
    // Listen to selection changes
    this.selectionManager.on('change', this._boundHandlers.onSelectionChange);
    this.selectionManager.on('select', this._boundHandlers.onSelectionChange);
    this.selectionManager.on('release', this._boundHandlers.onSelectionChange);

    // Listen to preselection updates via event system
    this.preselectionManager.on('update', this._boundHandlers.onPreselectionUpdate);
  }

  /**
   * @private
   */
  _computeSelection() {
    const sel = this.selectionManager.tellScaled();
    return {
      id: 'selection',
      x: sel.x,
      y: sel.y,
      width: sel.w,
      height: sel.h,
      zIndex: Z_INDEX.SELECTION
    };
  }

  /**
   * @private
   */
  _computePreselection() {
    const preData = this.preselectionManager.getPreselection();

    if (!preData) {
      return {
        preselectionRaw: null,
        preselectionConstrained: null,
        gestureSegment: null
      };
    }

    return {
      preselectionRaw: this._rectToDisplay(
        'preselection-raw',
        preData.newSelection,
        Z_INDEX.PRESELECTION_RAW
      ),
      preselectionConstrained: this._rectToDisplay(
        'preselection-constrained',
        preData.checkedSelection,
        Z_INDEX.PRESELECTION_CONSTRAINED
      ),
      gestureSegment: {
        id: 'gesture-segment',
        x1: preData.startPoint.x,
        y1: preData.startPoint.y,
        x2: preData.currentPoint.x,
        y2: preData.currentPoint.y,
        zIndex: Z_INDEX.GESTURE
      }
    };
  }

  /**
   * Converts a rect {x, y, x2, y2} to display format {x, y, width, height}.
   * @private
   */
  _rectToDisplay(id, rect, zIndex) {
    if (!rect) return null;

    return {
      id,
      x: Math.min(rect.x, rect.x2),
      y: Math.min(rect.y, rect.y2),
      width: Math.abs(rect.x2 - rect.x),
      height: Math.abs(rect.y2 - rect.y),
      zIndex
    };
  }

  /**
   * @private
   */
  _computeHandles() {
    const sel = this.selectionManager.tellScaled();
    const handles = {};

    for (const key of HANDLE_KEYS) {
      const center = RelativePosition.toCoords(key, sel);
      handles[key] = {
        id: `handle-${key}`,
        x: center.x - this.handleWidth / 2,
        y: center.y - this.handleHeight / 2,
        width: this.handleWidth,
        height: this.handleHeight,
        zIndex: Z_INDEX.HANDLES
      };
    }

    return handles;
  }
}

// Default export for backward compatibility
export default DisplayManager;
