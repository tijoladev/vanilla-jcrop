import JCrop from '../index.js';
import { Renderer } from './Renderer.js';
import { PointerHandler } from './PointerHandler.js';
import { KeyboardHandler } from './KeyboardHandler.js';

/**
 * Web Component for image cropping.
 *
 * @example
 * <jcrop-widget src="photo.jpg" ratio="16/9" min-width="100"></jcrop-widget>
 *
 * @fires crop-change - During drag, detail: {x, y, w, h, x2, y2}
 * @fires crop-select - End of selection, detail: {x, y, w, h, x2, y2}
 * @fires crop-release - Selection cleared
 */
export class JCropWidget extends HTMLElement {
  static get observedAttributes() {
    return [
      'src', 'ratio',
      'min-width', 'min-height', 'max-width', 'max-height',
      'disabled', 'grid', 'crosshair', 'no-move', 'no-resize',
      'selection'
    ];
  }

  constructor() {
    super();

    this.attachShadow({ mode: 'open' });

    /** @type {JCrop|null} */
    this._jcrop = null;

    /** @type {Renderer|null} */
    this._renderer = null;

    /** @type {PointerHandler|null} */
    this._pointerHandler = null;

    /** @type {KeyboardHandler|null} */
    this._keyboardHandler = null;

    /** @type {ResizeObserver|null} */
    this._resizeObserver = null;

    /** @private Source image dimensions */
    this._imageSize = { width: 0, height: 0 };

    /** @private Flag to avoid infinite loops */
    this._isUpdating = false;
  }

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────

  connectedCallback() {
    this._renderer = new Renderer(this.shadowRoot);
    this._setupPointerHandler();
    this._setupKeyboardHandler();

    // Load image if src attribute is present
    const src = this.getAttribute('src');
    if (src) {
      this._loadImage(src);
    }
  }

  disconnectedCallback() {
    this.destroy();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'src':
        if (newValue) {
          this._loadImage(newValue);
        }
        break;

      case 'disabled':
      case 'grid':
      case 'crosshair':
      case 'no-move':
      case 'no-resize':
        // Purely declarative: consumed by CSS or by pointer gating at event time.
        break;

      case 'selection':
        this._applySelectionAttribute();
        break;

      default:
        // ratio, min-width, etc. - update JCrop
        this._updateJCropOptions();
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Public properties
  // ─────────────────────────────────────────────────────────────────

  /**
   * Access to the headless JCrop engine.
   * @type {JCrop|null}
   */
  get jcrop() {
    return this._jcrop;
  }

  /**
   * Read/write selection (image coordinates).
   * @type {{x: number, y: number, w: number, h: number, x2: number, y2: number}|null}
   */
  get value() {
    if (!this._jcrop) return null;
    const coords = this._jcrop.tellSelect();
    if (coords.w === 0 && coords.h === 0) return null;
    return coords;
  }

  set value(rect) {
    if (!this._jcrop) return;
    if (!rect) {
      this._jcrop.release();
    } else {
      this._jcrop.setSelect(rect);
    }
  }

  /**
   * Alias for value.
   */
  get selection() {
    return this.value;
  }

  set selection(rect) {
    this.value = rect;
  }

  // ─────────────────────────────────────────────────────────────────
  // Public methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Sets the selection.
   * @param {{x: number, y: number, x2: number, y2: number}} rect
   */
  setSelection(rect) {
    if (this._jcrop) {
      this._jcrop.setSelect(rect);
    }
  }

  /**
   * Animates to a new selection.
   * @param {{x: number, y: number, x2: number, y2: number}} rect
   * @param {Function} [callback]
   */
  animateTo(rect, callback) {
    if (this._jcrop) {
      this._jcrop.animateTo(rect, callback);
    }
  }

  /**
   * Releases the selection.
   */
  release() {
    if (this._jcrop) {
      this._jcrop.release();
    }
  }

  /**
   * Cleans up all resources.
   */
  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    if (this._pointerHandler) {
      this._pointerHandler.dispose();
      this._pointerHandler = null;
    }

    if (this._keyboardHandler) {
      this._keyboardHandler.dispose();
      this._keyboardHandler = null;
    }

    if (this._jcrop) {
      this._jcrop.dispose();
      this._jcrop = null;
    }

    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * @private
   */
  async _loadImage(src) {
    if (!this._renderer) return;

    try {
      this._imageSize = await this._renderer.setImage(src);
      this._initJCrop();
    } catch (error) {
      console.error('[JCropWidget]', error.message);
      this.dispatchEvent(new CustomEvent('crop-error', {
        detail: { error: error.message }
      }));
    }
  }

  /**
   * @private
   */
  _initJCrop() {
    // Clean up previous instance. If it held a selection, notify consumers
    // before disposal — the new image has no logical relation to the old coords.
    if (this._jcrop) {
      const had = this._jcrop.tellScaled();
      if (had.w > 0 && had.h > 0) {
        this._onSelectionRelease();
      }
      this._jcrop.dispose();
    }

    const containerSize = this._renderer.getContainerSize();

    this._jcrop = new JCrop(this._renderer.getContainer(), {
      canvasWidth: containerSize.width,
      canvasHeight: containerSize.height,
      imageWidth: this._imageSize.width,
      imageHeight: this._imageSize.height,
      ...this._parseOptions(),
      onChange: (imageCoords, scaledCoords) => {
        this._onSelectionChange(imageCoords, scaledCoords);
      },
      onSelect: (imageCoords, scaledCoords) => {
        this._onSelectionSelect(imageCoords, scaledCoords);
      },
      onRelease: () => {
        this._onSelectionRelease();
      }
    });

    // Subscribe to display updates
    this._jcrop.onDisplayUpdate((displayData) => {
      this._render(displayData);
    });

    // Force initial render
    this._jcrop.updateDisplay();

    this._observeResize();
    this._applySelectionAttribute();
  }

  /**
   * Parses the `selection` attribute ("x,y,x2,y2" in image coords) and
   * applies it to the current instance. No-op if attribute is absent,
   * malformed, or the engine is not ready yet (will be re-applied after
   * image load via _initJCrop).
   * @private
   */
  _applySelectionAttribute() {
    if (!this._jcrop) return;
    const raw = this.getAttribute('selection');
    if (!raw) return;
    const parts = raw.split(',').map(s => Number(s.trim()));
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) {
      console.warn('[JCropWidget] invalid selection attribute, expected "x,y,x2,y2":', raw);
      return;
    }
    const [x, y, x2, y2] = parts;
    const rect = this._jcrop.toCanvas({ x, y, x2, y2 });
    this._jcrop.setSelect(rect);
  }

  /**
   * Watches the container size and syncs canvas dimensions on change.
   * Required for responsive hosts (max-width, viewport resize, etc.)
   * so selection mapping stays correct after layout changes.
   * @private
   */
  _observeResize() {
    if (typeof ResizeObserver === 'undefined' || !this._renderer) return;

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }

    this._resizeObserver = new ResizeObserver(() => {
      if (!this._jcrop) return;
      const { width, height } = this._renderer.getContainerSize();
      if (width < 1 || height < 1) return;
      const { canvasWidth, canvasHeight } = this._jcrop.options;
      if (width === canvasWidth && height === canvasHeight) return;
      this._jcrop.setOptions({ canvasWidth: width, canvasHeight: height });
    });

    this._resizeObserver.observe(this._renderer.getContainer());
  }

  /**
   * Parses a numeric attribute.
   * @private
   */
  _getNumericAttr(name) {
    const value = this.getAttribute(name);
    if (value === null) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  /**
   * @private
   */
  _parseOptions() {
    const options = {};

    // Ratio: format "16/9" or number
    const ratio = this.getAttribute('ratio');
    if (ratio) {
      if (ratio.includes('/')) {
        const [w, h] = ratio.split('/').map(Number);
        options.ratio = Number.isFinite(w) && Number.isFinite(h) && h !== 0 ? w / h : null;
      } else {
        const num = Number(ratio);
        options.ratio = Number.isFinite(num) ? num : null;
      }
    } else {
      options.ratio = null;
    }

    // Min/max dimensions
    const minWidth = this._getNumericAttr('min-width');
    if (minWidth !== undefined) options.minWidth = minWidth;

    const minHeight = this._getNumericAttr('min-height');
    if (minHeight !== undefined) options.minHeight = minHeight;

    const maxWidth = this._getNumericAttr('max-width');
    if (maxWidth !== undefined) options.maxWidth = maxWidth;

    const maxHeight = this._getNumericAttr('max-height');
    if (maxHeight !== undefined) options.maxHeight = maxHeight;

    return options;
  }

  /**
   * @private
   */
  _updateJCropOptions() {
    if (this._jcrop) {
      this._jcrop.setOptions(this._parseOptions());
    }
  }

  /**
   * @private
   */
  _setupPointerHandler() {
    if (!this._renderer) return;

    this._pointerHandler = new PointerHandler({
      element: this._renderer.getContainer(),
      renderer: this._renderer,

      onStart: ({ x, y, target }) => {
        if (!this._jcrop || this.hasAttribute('disabled')) return;

        if (!target) {
          // Click outside zone
          return;
        }

        const noMove = this.hasAttribute('no-move');
        const noResize = this.hasAttribute('no-resize');

        // Filter gestures per flag. `no-resize` also blocks new-draw since
        // drawing sets a size; `no-move` only blocks dragging an existing box.
        if (target.type === 'handle' && noResize) return;
        if (target.type === 'selection' && noMove) return;
        if (target.type === 'empty' && noResize) return;

        // Give focus to enable keyboard
        this._renderer.getContainer().focus();

        this._renderer.setTrackerActive(true);

        if (target.type === 'handle') {
          this._jcrop.startPreselection({
            startX: x,
            startY: y,
            targetType: 'resize',
            handleKey: target.key
          });
        } else if (target.type === 'selection') {
          this._jcrop.startPreselection({
            startX: x,
            startY: y,
            targetType: 'move'
          });
        } else {
          // Empty zone - new selection
          this._jcrop.startPreselection({
            startX: x,
            startY: y,
            targetType: 'new'
          });
        }
      },

      onMove: ({ x, y }) => {
        if (!this._jcrop || !this._jcrop.isPreselectionActive()) return;

        const result = this._jcrop.updatePreselection({
          currentX: x,
          currentY: y
        });

        // Show preview
        if (result) {
          this._renderer.showPreview({
            x: Math.min(result.x, result.x2),
            y: Math.min(result.y, result.y2),
            width: Math.abs(result.x2 - result.x),
            height: Math.abs(result.y2 - result.y)
          });
        }
      },

      onEnd: () => {
        if (!this._jcrop) return;

        this._renderer.setTrackerActive(false);
        this._renderer.showPreview(null);

        if (this._jcrop.isPreselectionActive()) {
          this._jcrop.finalizePreselection();
        }
      },

      onCancel: () => {
        if (!this._jcrop) return;

        this._renderer.setTrackerActive(false);
        this._renderer.showPreview(null);
        this._jcrop.cancelPreselection();
      }
    });
  }

  /**
   * @private
   */
  _setupKeyboardHandler() {
    if (!this._renderer) return;

    this._keyboardHandler = new KeyboardHandler({
      element: this._renderer.getContainer(),

      onMove: (dx, dy) => {
        if (!this._jcrop || this.hasAttribute('disabled')) return;

        // Move existing selection, clamped to canvas bounds
        const current = this._jcrop.tellScaled();
        if (current.w === 0 && current.h === 0) return;

        const { canvasWidth, canvasHeight } = this._jcrop.options;
        const nx = Math.max(0, Math.min(current.x + dx, canvasWidth - current.w));
        const ny = Math.max(0, Math.min(current.y + dy, canvasHeight - current.h));

        this._jcrop.setSelect({
          x: nx,
          y: ny,
          x2: nx + current.w,
          y2: ny + current.h
        });
      },

      onRelease: () => {
        if (this._jcrop) {
          this._jcrop.release();
        }
      },

      onConfirm: () => {
        // Emit crop-select event
        const value = this.value;
        if (value) {
          this.dispatchEvent(new CustomEvent('crop-select', {
            detail: value,
            bubbles: true
          }));
        }
      }
    });
  }

  /**
   * @private
   */
  _render(displayData) {
    if (!this._renderer || this._isUpdating) return;

    this._isUpdating = true;
    const containerSize = this._renderer.getContainerSize();
    this._renderer.render(displayData, containerSize);
    this._isUpdating = false;
  }

  /**
   * @private
   */
  _onSelectionChange(imageCoords, scaledCoords) {
    this.dispatchEvent(new CustomEvent('crop-change', {
      detail: imageCoords,
      bubbles: true
    }));
  }

  /**
   * @private
   */
  _onSelectionSelect(imageCoords, scaledCoords) {
    this.dispatchEvent(new CustomEvent('crop-select', {
      detail: imageCoords,
      bubbles: true
    }));
  }

  /**
   * @private
   */
  _onSelectionRelease() {
    this.dispatchEvent(new CustomEvent('crop-release', {
      bubbles: true
    }));
  }
}

// Register the Custom Element
if (typeof customElements !== 'undefined' && !customElements.get('jcrop-widget')) {
  customElements.define('jcrop-widget', JCropWidget);
}
