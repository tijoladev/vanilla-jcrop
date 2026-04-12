/**
 * Unified pointer event handling (mouse + touch + pen).
 */
export class PointerHandler {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.element - Element to listen on
   * @param {Renderer} options.renderer - Renderer for hit testing
   * @param {Function} options.onStart - Callback at drag start
   * @param {Function} options.onMove - Callback during drag
   * @param {Function} options.onEnd - Callback at drag end
   * @param {Function} options.onCancel - Callback if drag is cancelled
   */
  constructor(options) {
    this.element = options.element;
    this.renderer = options.renderer;
    this.onStart = options.onStart;
    this.onMove = options.onMove;
    this.onEnd = options.onEnd;
    this.onCancel = options.onCancel;

    /** @private */
    this._activePointerId = null;

    /** @private */
    this._isDragging = false;

    /** @private References to handlers for removal */
    this._boundHandlers = {
      onPointerDown: this._onPointerDown.bind(this),
      onPointerMove: this._onPointerMove.bind(this),
      onPointerUp: this._onPointerUp.bind(this),
      onPointerCancel: this._onPointerCancel.bind(this)
    };

    this._bindEvents();
  }

  /**
   * @returns {boolean} True if a drag is in progress
   */
  isDragging() {
    return this._isDragging;
  }

  /**
   * Cleans up resources.
   */
  dispose() {
    this._unbindEvents();
    this._activePointerId = null;
    this._isDragging = false;
  }

  // ─────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * @private
   */
  _bindEvents() {
    this.element.addEventListener('pointerdown', this._boundHandlers.onPointerDown);
  }

  /**
   * @private
   */
  _unbindEvents() {
    this.element.removeEventListener('pointerdown', this._boundHandlers.onPointerDown);
    this._removeDocumentListeners();
  }

  /**
   * @private
   */
  _addDocumentListeners() {
    document.addEventListener('pointermove', this._boundHandlers.onPointerMove);
    document.addEventListener('pointerup', this._boundHandlers.onPointerUp);
    document.addEventListener('pointercancel', this._boundHandlers.onPointerCancel);
  }

  /**
   * @private
   */
  _removeDocumentListeners() {
    document.removeEventListener('pointermove', this._boundHandlers.onPointerMove);
    document.removeEventListener('pointerup', this._boundHandlers.onPointerUp);
    document.removeEventListener('pointercancel', this._boundHandlers.onPointerCancel);
  }

  /**
   * @private
   */
  _onPointerDown(e) {
    // Ignore if already dragging
    if (this._isDragging) return;

    // Ignore non-primary buttons (left click only)
    if (e.button !== 0) return;

    e.preventDefault();

    this._activePointerId = e.pointerId;
    this._isDragging = true;

    // Capture pointer to receive events even outside the element
    this.element.setPointerCapture(e.pointerId);

    // Listen on document for move and end
    this._addDocumentListeners();

    // Determine target and coordinates
    const coords = this.renderer.clientToLocal(e.clientX, e.clientY);
    const target = this.renderer.hitTest(coords.x, coords.y);

    if (this.onStart) {
      this.onStart({
        x: coords.x,
        y: coords.y,
        target,
        pointerId: e.pointerId,
        pointerType: e.pointerType
      });
    }
  }

  /**
   * @private
   */
  _onPointerMove(e) {
    // Ignore if not the right pointer
    if (e.pointerId !== this._activePointerId) return;

    e.preventDefault();

    const coords = this.renderer.clientToLocal(e.clientX, e.clientY);

    if (this.onMove) {
      this.onMove({
        x: coords.x,
        y: coords.y,
        pointerId: e.pointerId,
        pointerType: e.pointerType
      });
    }
  }

  /**
   * @private
   */
  _onPointerUp(e) {
    // Ignore if not the right pointer
    if (e.pointerId !== this._activePointerId) return;

    e.preventDefault();

    this._finishDrag();

    const coords = this.renderer.clientToLocal(e.clientX, e.clientY);

    if (this.onEnd) {
      this.onEnd({
        x: coords.x,
        y: coords.y,
        pointerId: e.pointerId,
        pointerType: e.pointerType
      });
    }
  }

  /**
   * @private
   */
  _onPointerCancel(e) {
    // Ignore if not the right pointer
    if (e.pointerId !== this._activePointerId) return;

    this._finishDrag();

    if (this.onCancel) {
      this.onCancel({
        pointerId: e.pointerId,
        pointerType: e.pointerType
      });
    }
  }

  /**
   * @private
   */
  _finishDrag() {
    if (this._activePointerId !== null) {
      try {
        this.element.releasePointerCapture(this._activePointerId);
      } catch {
        // Ignore if already released
      }
    }

    this._activePointerId = null;
    this._isDragging = false;
    this._removeDocumentListeners();
  }
}
