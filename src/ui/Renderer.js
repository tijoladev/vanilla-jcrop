import { styles } from './styles.js';
import { HANDLE_KEYS } from '../utils/constants.js';

/**
 * Manages DOM creation and updates in the Shadow DOM.
 */
export class Renderer {
  /**
   * @param {ShadowRoot} shadowRoot - The Web Component's Shadow DOM
   */
  constructor(shadowRoot) {
    /** @private */
    this._shadowRoot = shadowRoot;
    /** @private */
    this._elements = null;
    /** @private */
    this._disposed = false;

    this._createDOM();
  }

  /**
   * Access to elements (read-only).
   * @returns {Object}
   */
  get elements() {
    return this._elements;
  }

  /**
   * Creates the initial DOM structure.
   * @private
   */
  _createDOM() {
    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    this._shadowRoot.appendChild(styleEl);

    // Main container
    const container = document.createElement('div');
    container.className = 'jcrop-container';
    container.setAttribute('tabindex', '0');
    container.setAttribute('role', 'application');
    container.setAttribute('aria-label', 'Image crop area');

    // Image
    const image = document.createElement('img');
    image.className = 'jcrop-image';
    image.alt = '';
    container.appendChild(image);

    // Dark overlay (4 zones)
    const shades = this._createShades(container);

    // Selection zone
    const { selection, moveArea, grid, crosshair, handles } = this._createSelection(container);

    // Tracker (for creating new selection)
    const tracker = document.createElement('div');
    tracker.className = 'jcrop-tracker';
    tracker.setAttribute('data-active', 'false');
    container.appendChild(tracker);

    // Preview during drag
    const preview = document.createElement('div');
    preview.className = 'jcrop-preview';
    preview.style.display = 'none';
    container.appendChild(preview);

    this._shadowRoot.appendChild(container);

    // Store references
    this._elements = Object.freeze({
      container,
      image,
      shades,
      selection,
      moveArea,
      grid,
      crosshair,
      handles,
      tracker,
      preview
    });
  }

  /**
   * Creates the 4 dark overlay zones.
   * @private
   */
  _createShades(container) {
    const shades = {};
    for (const position of ['top', 'left', 'right', 'bottom']) {
      const shade = document.createElement('div');
      shade.className = `jcrop-shade jcrop-shade-${position}`;
      container.appendChild(shade);
      shades[position] = shade;
    }
    return shades;
  }

  /**
   * Creates the selection zone with borders and handles.
   * @private
   */
  _createSelection(container) {
    const selection = document.createElement('div');
    selection.className = 'jcrop-selection';
    selection.setAttribute('data-visible', 'false');

    // Borders
    for (const side of ['n', 's', 'e', 'w']) {
      const border = document.createElement('div');
      border.className = `jcrop-border jcrop-border-${side}`;
      selection.appendChild(border);
    }

    // Move zone (center)
    const moveArea = document.createElement('div');
    moveArea.className = 'jcrop-move-area';
    selection.appendChild(moveArea);

    // Optional visual aids (grid, crosshair) — toggled via CSS on selection
    const grid = document.createElement('div');
    grid.className = 'jcrop-grid';
    selection.appendChild(grid);

    const crosshair = document.createElement('div');
    crosshair.className = 'jcrop-crosshair';
    selection.appendChild(crosshair);

    // Handles (8)
    const handles = {};
    for (const key of HANDLE_KEYS) {
      const handle = document.createElement('div');
      handle.className = 'jcrop-handle';
      handle.setAttribute('data-handle', key);
      selection.appendChild(handle);
      handles[key] = handle;
    }

    container.appendChild(selection);
    return { selection, moveArea, grid, crosshair, handles };
  }

  /**
   * Sets the image source.
   * @param {string} src - Image URL
   * @returns {Promise<{width: number, height: number}>} Image dimensions
   */
  setImage(src) {
    return new Promise((resolve, reject) => {
      if (this._disposed) {
        reject(new Error('Renderer disposed'));
        return;
      }

      const img = this._elements.image;

      // Clean up old handlers
      img.onload = null;
      img.onerror = null;

      img.onload = () => {
        img.onload = null;
        img.onerror = null;
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          reject(new Error(
            `Image has no intrinsic dimensions: ${src}. ` +
            `For SVG sources, declare width/height or a viewBox attribute.`
          ));
          return;
        }
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };

      img.onerror = () => {
        img.onload = null;
        img.onerror = null;
        reject(new Error(`Failed to load image: ${src}`));
      };

      img.src = src;
    });
  }

  /**
   * Updates the display from DisplayManager data.
   * @param {Object} displayData - Data from display:update
   * @param {{width: number, height: number}} containerSize - Container size
   */
  render(displayData, containerSize) {
    if (this._disposed) return;

    const { selection } = displayData;
    const hasSelection = selection && selection.width > 0 && selection.height > 0;

    if (hasSelection) {
      this._updateSelection(selection);
      this._updateShades(selection, containerSize);
      this._elements.selection.setAttribute('data-visible', 'true');
    } else {
      this._elements.selection.setAttribute('data-visible', 'false');
      this._hideShades();
    }

    this._elements.preview.style.display = 'none';
  }

  /**
   * Shows the preview during drag.
   * @param {Object|null} preselection - Preselection data
   */
  showPreview(preselection) {
    if (this._disposed) return;

    const preview = this._elements.preview;

    if (!preselection) {
      preview.style.display = 'none';
      return;
    }

    const { x, y, width, height } = preselection;
    preview.style.display = 'block';
    preview.style.left = `${x}px`;
    preview.style.top = `${y}px`;
    preview.style.width = `${width}px`;
    preview.style.height = `${height}px`;
  }

  /**
   * Activates/deactivates tracker mode.
   * @param {boolean} active
   */
  setTrackerActive(active) {
    if (this._disposed) return;
    this._elements.tracker.setAttribute('data-active', String(active));
  }

  /**
   * Returns the main container.
   * @returns {HTMLElement}
   */
  getContainer() {
    return this._elements?.container ?? null;
  }

  /**
   * Returns the tracker element.
   * @returns {HTMLElement}
   */
  getTracker() {
    return this._elements?.tracker ?? null;
  }

  /**
   * Returns the current container size.
   * @returns {{width: number, height: number}}
   */
  getContainerSize() {
    if (!this._elements?.container) {
      return { width: 0, height: 0 };
    }
    const rect = this._elements.container.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  /**
   * Converts client coordinates to local coordinates.
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{x: number, y: number}}
   */
  clientToLocal(clientX, clientY) {
    if (!this._elements?.container) {
      return { x: 0, y: 0 };
    }
    const rect = this._elements.container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  /**
   * Tests if a point is on a handle, the selection, or an empty zone.
   * @param {number} x - Local X coordinate
   * @param {number} y - Local Y coordinate
   * @returns {{type: string, key?: string}|null}
   */
  hitTest(x, y) {
    if (this._disposed || !this._elements) return null;

    const point = { x, y };

    // Test handles first (higher z-index)
    for (const key of HANDLE_KEYS) {
      const handle = this._elements.handles[key];
      if (this._isPointInElement(point, handle)) {
        return { type: 'handle', key };
      }
    }

    // Test move zone
    if (this._isPointInElement(point, this._elements.moveArea)) {
      return { type: 'selection' };
    }

    // Test tracker (empty zone)
    if (this._isPointInElement(point, this._elements.tracker)) {
      return { type: 'empty' };
    }

    return null;
  }

  /**
   * Cleans up DOM resources.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    // Clean up image handlers
    if (this._elements?.image) {
      this._elements.image.onload = null;
      this._elements.image.onerror = null;
    }

    // Empty the shadow root
    while (this._shadowRoot.firstChild) {
      this._shadowRoot.removeChild(this._shadowRoot.firstChild);
    }

    this._elements = null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Updates the selection position/size.
   * @private
   */
  _updateSelection(selection) {
    const el = this._elements.selection;
    el.style.left = `${selection.x}px`;
    el.style.top = `${selection.y}px`;
    el.style.width = `${selection.width}px`;
    el.style.height = `${selection.height}px`;
  }

  /**
   * Updates the 4 dark overlay zones.
   * @private
   */
  _updateShades(selection, containerSize) {
    const { x, y, width, height } = selection;
    const { shades } = this._elements;
    const containerWidth = containerSize.width;
    const containerHeight = containerSize.height;

    this._showShades();

    shades.top.style.height = `${y}px`;
    shades.bottom.style.height = `${containerHeight - y - height}px`;

    shades.left.style.top = `${y}px`;
    shades.left.style.width = `${x}px`;
    shades.left.style.height = `${height}px`;

    shades.right.style.top = `${y}px`;
    shades.right.style.width = `${containerWidth - x - width}px`;
    shades.right.style.height = `${height}px`;
  }

  /**
   * Hides the overlays.
   * @private
   */
  _hideShades() {
    const { shades } = this._elements;
    for (const shade of Object.values(shades)) {
      shade.style.display = 'none';
    }
  }

  /**
   * Shows the overlays.
   * @private
   */
  _showShades() {
    const { shades } = this._elements;
    for (const shade of Object.values(shades)) {
      shade.style.display = 'block';
    }
  }

  /**
   * Tests if a point is inside an element.
   * @private
   */
  _isPointInElement(point, element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const containerRect = this._elements.container.getBoundingClientRect();

    const localRect = {
      left: rect.left - containerRect.left,
      right: rect.right - containerRect.left,
      top: rect.top - containerRect.top,
      bottom: rect.bottom - containerRect.top
    };

    return (
      point.x >= localRect.left &&
      point.x <= localRect.right &&
      point.y >= localRect.top &&
      point.y <= localRect.bottom
    );
  }
}
