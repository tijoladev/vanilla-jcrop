# VanillaJCrop

A modern, dependency-free image cropping library. Drop-in replacement for the classic [JCrop 0.9](https://github.com/tapmodo/Jcrop) without jQuery.

## Features

- **Zero dependencies** - Pure ES6+ JavaScript, no jQuery required
- **Web Component** - Use as `<jcrop-widget>` custom element
- **Headless API** - Core logic separated from UI for maximum flexibility
- **Touch support** - Works with mouse, touch, and pen input via Pointer Events
- **Keyboard navigation** - Arrow keys to move selection, Escape to cancel
- **Aspect ratio** - Lock to any ratio (16:9, 4:3, 1:1, etc.)
- **Size constraints** - Set minimum and maximum dimensions
- **Animations** - Smooth animated transitions between selections
- **Themeable** - Customize appearance via CSS custom properties
- **Shadow DOM** - Encapsulated styles that won't conflict with your page

## Installation

### Via script tag (ES modules)

```html
<script type="module">
  import JCrop, { JCropWidget } from './src/index.js';
</script>
```

### Manual download

Download the `src/` folder and include it in your project.

## Quick Start

### Using the Web Component

```html
<jcrop-widget
  src="image.jpg"
  ratio="16/9"
  min-width="100">
</jcrop-widget>

<script type="module">
  import { JCropWidget } from './src/index.js';

  const cropper = document.querySelector('jcrop-widget');

  cropper.addEventListener('crop-select', (e) => {
    console.log('Selection:', e.detail);
    // { x, y, w, h, x2, y2 } in image coordinates
  });
</script>
```

### Using the Headless API

```javascript
import JCrop from './src/index.js';

const jcrop = new JCrop(element, {
  canvasWidth: 800,
  canvasHeight: 600,
  imageWidth: 1600,
  imageHeight: 1200,
  ratio: 16/9,
  minWidth: 100,
  minHeight: 100,
  onChange: (coords) => console.log('Changed:', coords),
  onSelect: (coords) => console.log('Selected:', coords),
  onRelease: () => console.log('Released')
});

// Set selection programmatically
jcrop.setSelect({ x: 100, y: 100, x2: 500, y2: 400 });

// Animate to a new selection
jcrop.animateTo({ x: 200, y: 200, x2: 600, y2: 500 });

// Get current selection
const coords = jcrop.tellSelect();

// Release selection
jcrop.release();
```

## Web Component Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `src` | Image source URL | `src="photo.jpg"` |
| `ratio` | Aspect ratio (number or fraction) | `ratio="16/9"` or `ratio="1.5"` |
| `min-width` | Minimum selection width (pixels) | `min-width="100"` |
| `min-height` | Minimum selection height (pixels) | `min-height="100"` |
| `max-width` | Maximum selection width (pixels) | `max-width="500"` |
| `max-height` | Maximum selection height (pixels) | `max-height="500"` |
| `disabled` | Disable interaction | `disabled` |

## Web Component Events

| Event | Description | Detail |
|-------|-------------|--------|
| `crop-change` | Fires during drag | `{ x, y, w, h, x2, y2 }` |
| `crop-select` | Fires when selection is finalized | `{ x, y, w, h, x2, y2 }` |
| `crop-release` | Fires when selection is cleared | - |
| `crop-error` | Fires on error (e.g., image load failure) | `{ error }` |

## Web Component Properties & Methods

```javascript
const widget = document.querySelector('jcrop-widget');

// Properties
widget.value;          // Get/set selection { x, y, w, h, x2, y2 }
widget.selection;      // Alias for value
widget.jcrop;          // Access underlying JCrop instance

// Methods
widget.setSelection({ x, y, x2, y2 });
widget.animateTo({ x, y, x2, y2 }, callback);
widget.release();
widget.destroy();
```

## API Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `canvasWidth` | number | 800 | Display width of the crop area |
| `canvasHeight` | number | 600 | Display height of the crop area |
| `imageWidth` | number | 1600 | Actual image width |
| `imageHeight` | number | 1200 | Actual image height |
| `ratio` | number\|null | null | Aspect ratio (width/height), null for free |
| `minWidth` | number | 50 | Minimum selection width |
| `minHeight` | number | 50 | Minimum selection height |
| `maxWidth` | number | Infinity | Maximum selection width |
| `maxHeight` | number | Infinity | Maximum selection height |
| `fadeTime` | number | 400 | Animation duration in ms |
| `handleWidth` | number | 10 | Handle width in pixels |
| `handleHeight` | number | 10 | Handle height in pixels |
| `onChange` | function | null | Callback during selection changes |
| `onSelect` | function | null | Callback when selection is finalized |
| `onRelease` | function | null | Callback when selection is released |

## API Methods

```javascript
// Selection
jcrop.setSelect({ x, y, x2, y2 });   // Set selection immediately
jcrop.animateTo({ x, y, x2, y2 });   // Animate to selection
jcrop.tellSelect();                   // Get selection in image coords
jcrop.tellScaled();                   // Get selection in canvas coords
jcrop.release();                      // Clear selection

// Animation
jcrop.isAnimating();                  // Check if animating
jcrop.cancelAnimation();              // Stop animation

// Configuration
jcrop.setOptions({ ratio: 1 });       // Update options at runtime

// Cleanup
jcrop.dispose();                      // Destroy instance
```

## CSS Theming

Customize the appearance using CSS custom properties:

```css
jcrop-widget {
  /* Shade overlay */
  --jcrop-shade-color: rgba(0, 0, 0, 0.5);

  /* Selection border */
  --jcrop-border-color: #fff;
  --jcrop-border-width: 2px;
  --jcrop-border-style: dashed;

  /* Resize handles */
  --jcrop-handle-size: 12px;
  --jcrop-handle-color: #fff;
  --jcrop-handle-border: 2px solid #333;
  --jcrop-handle-radius: 2px;
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Arrow keys | Move selection by 1px (10px with Shift) |
| Escape | Cancel current operation |
| Enter | Confirm selection |

## Migration from JCrop 0.9

VanillaJCrop provides a familiar API for users of the original JCrop:

| JCrop 0.9 | VanillaJCrop |
|-----------|--------------|
| `$.Jcrop('#target')` | `new JCrop(element)` |
| `api.setSelect([x,y,x2,y2])` | `jcrop.setSelect({x,y,x2,y2})` |
| `api.animateTo([x,y,x2,y2])` | `jcrop.animateTo({x,y,x2,y2})` |
| `api.tellSelect()` | `jcrop.tellSelect()` |
| `api.release()` | `jcrop.release()` |
| `api.destroy()` | `jcrop.dispose()` |

Main differences:
- No jQuery dependency
- Coordinates passed as objects `{x, y, x2, y2}` instead of arrays
- Web Component available for declarative usage
- ES modules instead of global namespace

## Browser Support

VanillaJCrop works in all modern browsers:
- Chrome/Edge 79+
- Firefox 63+
- Safari 13.1+

## Development

```bash
# Start development server
./serve.sh

# Open demo
open http://localhost:8000/demo/
```

## License

MIT License - see [LICENSE](LICENSE) file.

## Credits

Inspired by the original [JCrop](https://github.com/tapmodo/Jcrop) by Kelly Hallman (Tapmodo).
