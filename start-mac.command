#!/bin/bash
cd "$(dirname "$0")"

echo "=================================================="
echo "  Scouts Queensland Youth Program Team Roadmap   "
echo "=================================================="
echo "Starting local server for direct OneDrive file auto-save..."

# Kill any existing server on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null

# Start built-in Ruby WEBrick server (requires no installs or licenses)
ruby -run -e httpd -- --port=8080 . &
SERVER_PID=$!

sleep 1
open "http://localhost:8080"

echo ""
echo "Dashboard launched at http://localhost:8080"
echo "Direct OneDrive JSON file auto-save is enabled!"
echo "Keep this window open while using the dashboard."
echo "Close this window or press Ctrl+C to stop the server."
echo "=================================================="

wait $SERVER_PID
