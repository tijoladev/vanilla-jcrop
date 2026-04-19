import { SelectionManager } from './managers/SelectionManager.js';
import { PreselectionManager } from './managers/PreselectionManager.js';
import { DisplayManager } from './managers/DisplayManager.js';
import { MIN_DIMENSION } from './utils/constants.js';

function scaleRect(rect, sx, sy) {
  const x = rect.x * sx;
  const y = rect.y * sy;
  const x2 = rect.x2 * sx;
  const y2 = rect.y2 * sy;
  return { x, y, x2, y2, w: x2 - x, h: y2 - y };
}

/**
 * JCrop configuration options.
 * @typedef {Object} JCropOptions
 * @property {number} [canvasWidth=800] - Canvas width (widget scale)
 * @property {number} [canvasHeight=600] - Canvas height
 * @property {number} [imageWidth=1600] - Actual image width
 * @property {number} [imageHeight=1200] - Actual image height
 * @property {number} [fadeTime=400] - Animation duration in ms
 * @property {number} [minWidth=50] - Minimum selection width
 * @property {number} [minHeight=50] - Minimum selection height
 * @property {number} [maxWidth=Infinity] - Maximum selection width
 * @property {number} [maxHeight=Infinity] - Maximum selection height
 * @property {number|null} [ratio=null] - Forced width/height ratio
 * @property {number} [handleWidth=10] - Handle width
 * @property {number} [handleHeight=10] - Handle height
 * @property {Function} [onChange] - Callback on each change
 * @property {Function} [onSelect] - Callback at selection end
 * @property {Function} [onRelease] - Callback on release
 * @property {Function} [onPreselectionUpdate] - Callback during drag
 * @property {Function} [onPreselectionFinalize] - Callback at drag end
 */

/**
 * Image cropping library.
 */
export default class JCrop {
  /**
   * @param {HTMLElement|string} element - Target element or CSS selector
   * @param {JCropOptions} [options]
   * @throws {Error} If element is not found
   */
  constructor(element, options = {}) {
    this.options = this._validateOptions({ ...JCrop.defaults, ...options });
    this.element = this._resolveElement(element);

    /** @private */
    this._disposed = false;

    /** @private References to callbacks for removal */
    this._boundCallbacks = {};

    this._initManagers();
    this._bindCallbacks();
  }

  // ─────────────────────────────────────────────────────────────────
  // Selection API
  // ─────────────────────────────────────────────────────────────────

  /**
   * Sets the selection.
   * @param {{x: number, y: number, x2: number, y2: number}} rect
   */
  setSelect(rect) {
    this._ensureNotDisposed();
    this.selectionManager.setSelect(rect);
  }

  /**
   * Animates to a new selection.
   * @param {{x: number, y: number, x2: number, y2: number}} rect
   * @param {Function} [callback]
   */
  animateTo(rect, callback) {
    this._ensureNotDisposed();
    this.selectionManager.animateTo(rect, callback);
  }

  /** Cancels the current animation. */
  cancelAnimation() {
    this._ensureNotDisposed();
    this.selectionManager.cancelAnimation();
  }

  /** @returns {boolean} True if an animation is in progress */
  isAnimating() {
    return !this._disposed && this.selectionManager.isAnimating();
  }

  /**
   * Returns the selection in image coordinates.
   * @returns {Object}
   */
  tellSelect() {
    this._ensureNotDisposed();
    return this.selectionManager.tellSelect();
  }

  /**
   * Returns the selection in widget coordinates.
   * @returns {Object}
   */
  tellScaled() {
    this._ensureNotDisposed();
    return this.selectionManager.tellScaled();
  }

  /** Releases the selection. */
  release() {
    this._ensureNotDisposed();
    this.selectionManager.release();
  }

  /**
   * Converts a canvas-space rect to image-space coordinates.
   * Useful for reading arbitrary points/boxes (e.g. an overlay's position)
   * in the image's native coordinate system.
   * @param {{x: number, y: number, x2: number, y2: number}} rect
   * @returns {{x: number, y: number, x2: number, y2: number, w: number, h: number}}
   */
  toImage(rect) {
    this._ensureNotDisposed();
    const { canvasWidth, canvasHeight, imageWidth, imageHeight } = this.options;
    return scaleRect(rect, imageWidth / canvasWidth, imageHeight / canvasHeight);
  }

  /**
   * Converts an image-space rect to canvas-space coordinates.
   * Useful for projecting backend-provided regions (e.g. face boxes) onto
   * the displayed widget.
   * @param {{x: number, y: number, x2: number, y2: number}} rect
   * @returns {{x: number, y: number, x2: number, y2: number, w: number, h: number}}
   */
  toCanvas(rect) {
    this._ensureNotDisposed();
    const { canvasWidth, canvasHeight, imageWidth, imageHeight } = this.options;
    return scaleRect(rect, canvasWidth / imageWidth, canvasHeight / imageHeight);
  }

  // ─────────────────────────────────────────────────────────────────
  // Preselection API
  // ─────────────────────────────────────────────────────────────────

  /**
   * Starts a preselection.
   * @param {{startX: number, startY: number, targetType: string, handleKey?: string}} params
   */
  startPreselection(params) {
    this._ensureNotDisposed();
    const startPoint = { x: params.startX, y: params.startY };
    const action = { type: params.targetType, detail: params.handleKey || null };
    this.preselectionManager.startPreselection(startPoint, action);
  }

  /**
   * Updates the preselection.
   * @param {{currentX: number, currentY: number}} params
   * @returns {Object|null}
   */
  updatePreselection(params) {
    this._ensureNotDisposed();
    return this.preselectionManager.updatePreselection({
      x: params.currentX,
      y: params.currentY
    });
  }

  /** Finalizes the preselection. */
  finalizePreselection() {
    this._ensureNotDisposed();
    this.preselectionManager.finalizePreselection();
  }

  /** Cancels the preselection. */
  cancelPreselection() {
    this._ensureNotDisposed();
    this.preselectionManager.cancelPreselection();
  }

  /** @returns {boolean} True if a preselection is active */
  isPreselectionActive() {
    return !this._disposed && this.preselectionManager.isActive();
  }

  /** @returns {string|null} Current action type */
  getPreselectionActionType() {
    return this._disposed ? null : this.preselectionManager.getActionType();
  }

  // ─────────────────────────────────────────────────────────────────
  // Display API
  // ─────────────────────────────────────────────────────────────────

  /**
   * Registers a callback for display updates.
   * @param {Function} callback
   */
  onDisplayUpdate(callback) {
    this._ensureNotDisposed();
    this.displayManager.on('display:update', callback);
  }

  /** Forces a display update. */
  updateDisplay() {
    this._ensureNotDisposed();
    this.displayManager.update();
  }

  // ─────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────

  /**
   * Updates options at runtime.
   * @param {Partial<JCropOptions>} newOptions
   */
  setOptions(newOptions = {}) {
    this._ensureNotDisposed();
    const oldOptions = this.options;
    this.options = this._validateOptions({ ...this.options, ...newOptions });

    this._updateManagerOptions(newOptions);
    this._updateCallbacks(oldOptions, newOptions);
    this.displayManager.update();
  }

  /**
   * Cleans up resources and unregisters all listeners.
   * The instance can no longer be used after this call.
   */
  dispose() {
    if (this._disposed) return;

    this._disposed = true;

    // Clean up managers in reverse order of creation
    this.displayManager.dispose();
    this.preselectionManager.dispose();
    this.selectionManager.dispose();

    // Clean up references
    this._boundCallbacks = null;
    this.element = null;
  }

  /** @returns {boolean} True if the instance has been disposed */
  isDisposed() {
    return this._disposed;
  }

  // ─────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * @private
   * @throws {Error} If the instance has been disposed
   */
  _ensureNotDisposed() {
    if (this._disposed) {
      throw new Error('JCrop: This instance has been disposed (dispose() called)');
    }
  }

  /**
   * Resolves the target element.
   * @private
   */
  _resolveElement(element) {
    if (typeof element === 'string') {
      const el = document.querySelector(element);
      if (!el) {
        throw new Error(`JCrop: Element not found for selector "${element}"`);
      }
      return el;
    }
    if (!element) {
      throw new Error('JCrop: Element required');
    }
    return element;
  }

  /**
   * Validates and normalizes options.
   * @private
   */
  _validateOptions(opts) {
    return {
      ...opts,
      canvasWidth: Math.max(opts.canvasWidth || MIN_DIMENSION, MIN_DIMENSION),
      canvasHeight: Math.max(opts.canvasHeight || MIN_DIMENSION, MIN_DIMENSION),
      imageWidth: Math.max(opts.imageWidth || MIN_DIMENSION, MIN_DIMENSION),
      imageHeight: Math.max(opts.imageHeight || MIN_DIMENSION, MIN_DIMENSION),
      minWidth: Math.max(opts.minWidth || 0, 0),
      minHeight: Math.max(opts.minHeight || 0, 0),
      maxWidth: opts.maxWidth || Infinity,
      maxHeight: opts.maxHeight || Infinity,
      handleWidth: Math.max(opts.handleWidth || 1, 1),
      handleHeight: Math.max(opts.handleHeight || 1, 1),
      fadeTime: Math.max(opts.fadeTime || 0, 0)
    };
  }

  /** @private */
  _initManagers() {
    const opts = this.options;

    this.selectionManager = new SelectionManager({
      canvasWidth: opts.canvasWidth,
      canvasHeight: opts.canvasHeight,
      imageWidth: opts.imageWidth,
      imageHeight: opts.imageHeight,
      fadeTime: opts.fadeTime
    });

    this.preselectionManager = new PreselectionManager({
      canvasWidth: opts.canvasWidth,
      canvasHeight: opts.canvasHeight,
      minWidth: opts.minWidth,
      minHeight: opts.minHeight,
      maxWidth: opts.maxWidth,
      maxHeight: opts.maxHeight,
      ratio: opts.ratio,
      selectionManager: this.selectionManager,
      onUpdate: opts.onPreselectionUpdate,
      onFinalize: opts.onPreselectionFinalize
    });

    this.displayManager = new DisplayManager({
      selectionManager: this.selectionManager,
      preselectionManager: this.preselectionManager,
      handleWidth: opts.handleWidth,
      handleHeight: opts.handleHeight,
      canvasWidth: opts.canvasWidth,
      canvasHeight: opts.canvasHeight
    });
  }

  /** @private */
  _bindCallbacks() {
    const opts = this.options;

    if (typeof opts.onChange === 'function') {
      this._boundCallbacks.onChange = opts.onChange;
      this.selectionManager.on('change', opts.onChange);
    }
    if (typeof opts.onSelect === 'function') {
      this._boundCallbacks.onSelect = opts.onSelect;
      this.selectionManager.on('select', opts.onSelect);
    }
    if (typeof opts.onRelease === 'function') {
      this._boundCallbacks.onRelease = opts.onRelease;
      this.selectionManager.on('release', opts.onRelease);
    }
  }

  /** @private */
  _updateManagerOptions(newOptions) {
    // SelectionManager: canvas size rescales stored coords; other fields are direct.
    if (newOptions.canvasWidth !== undefined || newOptions.canvasHeight !== undefined) {
      this.selectionManager.setCanvasSize(
        this.options.canvasWidth,
        this.options.canvasHeight
      );
    }
    const selectionKeys = ['imageWidth', 'imageHeight', 'fadeTime'];
    for (const key of selectionKeys) {
      if (newOptions[key] !== undefined) {
        this.selectionManager[key] = this.options[key];
      }
    }

    // PreselectionManager
    if (newOptions.canvasWidth !== undefined) {
      this.preselectionManager.canvasWidth = this.options.canvasWidth;
    }
    if (newOptions.canvasHeight !== undefined) {
      this.preselectionManager.canvasHeight = this.options.canvasHeight;
    }

    // Constraints
    const constraintKeys = ['ratio', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'];
    if (constraintKeys.some(k => newOptions[k] !== undefined)) {
      const c = this.preselectionManager.constraints;
      c.ratio = this.options.ratio;
      c.minWidth = this.options.minWidth;
      c.minHeight = this.options.minHeight;
      c.maxWidth = this.options.maxWidth;
      c.maxHeight = this.options.maxHeight;
    }

    // DisplayManager
    const displayKeys = ['handleWidth', 'handleHeight', 'canvasWidth', 'canvasHeight'];
    for (const key of displayKeys) {
      if (newOptions[key] !== undefined) {
        this.displayManager[key] = this.options[key];
      }
    }
  }

  /** @private */
  _updateCallbacks(oldOptions, newOptions) {
    const callbackMap = {
      onChange: 'change',
      onSelect: 'select',
      onRelease: 'release'
    };

    for (const [optKey, eventName] of Object.entries(callbackMap)) {
      if (newOptions[optKey] !== undefined) {
        // Remove old callback
        if (this._boundCallbacks[optKey]) {
          this.selectionManager.off(eventName, this._boundCallbacks[optKey]);
          delete this._boundCallbacks[optKey];
        }
        // Add new callback
        if (newOptions[optKey]) {
          this._boundCallbacks[optKey] = newOptions[optKey];
          this.selectionManager.on(eventName, newOptions[optKey]);
        }
      }
    }

    // Preselection: uses event system via on/off
    if (newOptions.onPreselectionUpdate !== undefined) {
      if (oldOptions.onPreselectionUpdate) {
        this.preselectionManager.off('update', oldOptions.onPreselectionUpdate);
      }
      if (newOptions.onPreselectionUpdate) {
        this.preselectionManager.on('update', newOptions.onPreselectionUpdate);
      }
    }
    if (newOptions.onPreselectionFinalize !== undefined) {
      if (oldOptions.onPreselectionFinalize) {
        this.preselectionManager.off('finalize', oldOptions.onPreselectionFinalize);
      }
      if (newOptions.onPreselectionFinalize) {
        this.preselectionManager.on('finalize', newOptions.onPreselectionFinalize);
      }
    }
  }
}

/** Default options */
JCrop.defaults = Object.freeze({
  canvasWidth: 800,
  canvasHeight: 600,
  imageWidth: 1600,
  imageHeight: 1200,
  fadeTime: 400,
  minWidth: 50,
  minHeight: 50,
  maxWidth: Infinity,
  maxHeight: Infinity,
  ratio: null,
  handleWidth: 10,
  handleHeight: 10,
  onChange: null,
  onSelect: null,
  onRelease: null,
  onPreselectionUpdate: null,
  onPreselectionFinalize: null
});

// Named exports for UI components
export { JCropWidget } from './ui/JCropWidget.js';
export { Renderer } from './ui/Renderer.js';
export { PointerHandler } from './ui/PointerHandler.js';
export { KeyboardHandler } from './ui/KeyboardHandler.js';
