/**
 * Mixin to add event emission capabilities.
 * @class
 */
export class EventEmitter {
  constructor() {
    /** @private @type {Object.<string, Function[]>} */
    this._events = {};
  }

  /**
   * Registers a callback for an event.
   * @param {string} event - Event name
   * @param {Function} callback - Function to call
   * @returns {this} For chaining
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      return this;
    }
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(callback);
    return this;
  }

  /**
   * Registers a callback to be called only once.
   * @param {string} event - Event name
   * @param {Function} callback - Function to call
   * @returns {this} For chaining
   */
  once(event, callback) {
    if (typeof callback !== 'function') {
      return this;
    }
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    return this.on(event, wrapper);
  }

  /**
   * Removes a callback for an event.
   * @param {string} event - Event name
   * @param {Function} callback - Function to remove
   * @returns {boolean} True if the callback was found and removed
   */
  off(event, callback) {
    const callbacks = this._events[event];
    if (!callbacks) return false;

    const index = callbacks.indexOf(callback);
    if (index === -1) return false;

    callbacks.splice(index, 1);
    return true;
  }

  /**
   * Removes all callbacks for an event or all events.
   * @param {string} [event] - Event name (optional)
   * @returns {this} For chaining
   */
  offAll(event) {
    if (event) {
      delete this._events[event];
    } else {
      this._events = {};
    }
    return this;
  }

  /**
   * Emits an event with the provided arguments.
   * Errors from callbacks are caught to not interrupt others.
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to callbacks
   * @protected
   */
  _emit(event, ...args) {
    const callbacks = this._events[event];
    if (!callbacks || callbacks.length === 0) return;

    // Copy to avoid issues if a callback modifies the list
    const callbacksCopy = [...callbacks];

    for (const callback of callbacksCopy) {
      try {
        callback(...args);
      } catch (error) {
        console.error(`[EventEmitter] Error in callback "${event}":`, error);
      }
    }
  }
}
