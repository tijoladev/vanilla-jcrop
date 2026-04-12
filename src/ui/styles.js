/**
 * CSS styles for the JCropWidget Web Component.
 * Uses CSS Custom Properties for theming.
 */
export const styles = `
:host {
  --jcrop-shade-color: rgba(0, 0, 0, 0.6);
  --jcrop-border-color: rgba(255, 255, 255, 0.9);
  --jcrop-border-width: 1px;
  --jcrop-border-style: dashed;
  --jcrop-handle-size: 10px;
  --jcrop-handle-color: #fff;
  --jcrop-handle-border: 1px solid #333;
  --jcrop-handle-radius: 0;
  --jcrop-focus-outline: 2px solid #4a90d9;
  --jcrop-transition-duration: 0ms;

  display: block;
  position: relative;
  user-select: none;
  touch-action: none;
}

:host([disabled]) {
  pointer-events: none;
  opacity: 0.7;
}

.jcrop-container {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.jcrop-container:focus {
  outline: var(--jcrop-focus-outline);
  outline-offset: 2px;
}

/* Source image */
.jcrop-image {
  display: block;
  max-width: 100%;
  height: auto;
  pointer-events: none;
}

/* Dark overlay (4 zones) */
.jcrop-shade {
  position: absolute;
  background-color: var(--jcrop-shade-color);
  pointer-events: none;
}

.jcrop-shade-top {
  top: 0;
  left: 0;
  right: 0;
}

.jcrop-shade-bottom {
  bottom: 0;
  left: 0;
  right: 0;
}

.jcrop-shade-left {
  left: 0;
}

.jcrop-shade-right {
  right: 0;
}

/* Selection zone */
.jcrop-selection {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
}

.jcrop-selection[data-visible="true"] {
  pointer-events: auto;
}

/* Selection borders */
.jcrop-border {
  position: absolute;
  background-color: var(--jcrop-border-color);
  pointer-events: none;
}

.jcrop-border-n,
.jcrop-border-s {
  left: 0;
  right: 0;
  height: var(--jcrop-border-width);
}

.jcrop-border-n {
  top: 0;
  border-top: var(--jcrop-border-width) var(--jcrop-border-style) var(--jcrop-border-color);
  background: transparent;
  height: 0;
}

.jcrop-border-s {
  bottom: 0;
  border-bottom: var(--jcrop-border-width) var(--jcrop-border-style) var(--jcrop-border-color);
  background: transparent;
  height: 0;
}

.jcrop-border-e,
.jcrop-border-w {
  top: 0;
  bottom: 0;
  width: var(--jcrop-border-width);
}

.jcrop-border-e {
  right: 0;
  border-right: var(--jcrop-border-width) var(--jcrop-border-style) var(--jcrop-border-color);
  background: transparent;
  width: 0;
}

.jcrop-border-w {
  left: 0;
  border-left: var(--jcrop-border-width) var(--jcrop-border-style) var(--jcrop-border-color);
  background: transparent;
  width: 0;
}

/* Resize handles */
.jcrop-handle {
  position: absolute;
  width: var(--jcrop-handle-size);
  height: var(--jcrop-handle-size);
  background-color: var(--jcrop-handle-color);
  border: var(--jcrop-handle-border);
  border-radius: var(--jcrop-handle-radius);
  box-sizing: border-box;
  pointer-events: auto;
  transform: translate(-50%, -50%);
}

/* Handle positioning */
.jcrop-handle[data-handle="nw"] { left: 0; top: 0; cursor: nw-resize; }
.jcrop-handle[data-handle="n"]  { left: 50%; top: 0; cursor: n-resize; }
.jcrop-handle[data-handle="ne"] { left: 100%; top: 0; cursor: ne-resize; }
.jcrop-handle[data-handle="e"]  { left: 100%; top: 50%; cursor: e-resize; }
.jcrop-handle[data-handle="se"] { left: 100%; top: 100%; cursor: se-resize; }
.jcrop-handle[data-handle="s"]  { left: 50%; top: 100%; cursor: s-resize; }
.jcrop-handle[data-handle="sw"] { left: 0; top: 100%; cursor: sw-resize; }
.jcrop-handle[data-handle="w"]  { left: 0; top: 50%; cursor: w-resize; }

/* Move zone (selection center) */
.jcrop-move-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: move;
  pointer-events: auto;
}

/* Tracker (captures events for new selection) */
.jcrop-tracker {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  z-index: 1;
}

.jcrop-tracker[data-active="true"] {
  z-index: 100;
}

/* Selection and elements above tracker */
.jcrop-selection {
  z-index: 10;
}

.jcrop-handle {
  z-index: 20;
}

/* Preview state during drag */
.jcrop-preview {
  position: absolute;
  border: 2px solid rgba(255, 255, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.1);
  pointer-events: none;
  z-index: 5;
}

/* Hide elements when no selection */
.jcrop-selection:not([data-visible="true"]),
.jcrop-selection:not([data-visible="true"]) .jcrop-handle,
.jcrop-selection:not([data-visible="true"]) .jcrop-border {
  display: none;
}

/* Optional animations */
@media (prefers-reduced-motion: no-preference) {
  .jcrop-selection,
  .jcrop-shade {
    transition:
      top var(--jcrop-transition-duration) ease-out,
      left var(--jcrop-transition-duration) ease-out,
      width var(--jcrop-transition-duration) ease-out,
      height var(--jcrop-transition-duration) ease-out;
  }
}
`;
