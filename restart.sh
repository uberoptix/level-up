#!/bin/bash

echo "Restarting Level Up application..."

# Kill any processes using port 5001
echo "Checking for processes using port 5001..."
lsof -ti:5001 | xargs kill -9 2>/dev/null || echo "No processes found using port 5001"

# Go to server directory and start the server
echo "Starting server..."
cd "$(dirname "$0")/server" || exit
node server.js &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

echo "Server is running! Access the app at http://localhost:3000"
echo "Press Ctrl+C to stop the server"

# Keep the script running
wait $SERVER_PID 