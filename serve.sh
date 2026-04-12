#!/bin/bash
# Simple HTTP server for testing the demo
# Usage: ./serve.sh

PORT=8080
echo "Server started at http://localhost:$PORT"
echo "Open http://localhost:$PORT/demo/"
echo "Ctrl+C to stop"

# Uses Python (available on macOS)
python3 -m http.server $PORT 2>/dev/null || python -m SimpleHTTPServer $PORT
