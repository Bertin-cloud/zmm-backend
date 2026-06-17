#!/bin/bash
echo "🚀 Starting ZMM Backend..."
cd "$(dirname "$0")/backend"
node server.js &
BACKEND_PID=$!

echo "🎨 Starting ZMM Frontend..."
cd "$(dirname "$0")/frontend"
npm start

# Kill backend when frontend exits
kill $BACKEND_PID
