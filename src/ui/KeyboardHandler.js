/**
 * Keyboard navigation handling for accessibility.
 */
export class KeyboardHandler {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.element - Focusable element
   * @param {Function} options.onMove - Move callback (dx, dy)
   * @param {Function} options.onRelease - Release selection callback
   * @param {Function} options.onConfirm - Confirm callback
   */
  constructor(options) {
    this.element = options.element;
    this.onMove = options.onMove;
    this.onRelease = options.onRelease;
    this.onConfirm = options.onConfirm;

    /** Normal move step */
    this.normalStep = 1;

    /** Move step with Shift */
    this.shiftStep = 10;

    /** @private */
    this._boundHandler = this._onKeyDown.bind(this);

    this._bindEvents();
  }

  /**
   * Gives focus to the element.
   */
  focus() {
    this.element.focus();
  }

  /**
   * Cleans up resources.
   */
  dispose() {
    this.element.removeEventListener('keydown', this._boundHandler);
  }

  // ─────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * @private
   */
  _bindEvents() {
    this.element.addEventListener('keydown', this._boundHandler);
  }

  /**
   * @private
   */
  _onKeyDown(e) {
    const step = e.shiftKey ? this.shiftStep : this.normalStep;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this._move(-step, 0);
        break;

      case 'ArrowRight':
        e.preventDefault();
        this._move(step, 0);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this._move(0, -step);
        break;

      case 'ArrowDown':
        e.preventDefault();
        this._move(0, step);
        break;

      case 'Escape':
        e.preventDefault();
        if (this.onRelease) {
          this.onRelease();
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (this.onConfirm) {
          this.onConfirm();
        }
        break;

      case 'Tab':
        // Keep default behavior (exit focus)
        break;

      default:
        // Ignore other keys
        break;
    }
  }

  /**
   * @private
   */
  _move(dx, dy) {
    if (this.onMove) {
      this.onMove(dx, dy);
    }
  }
}
