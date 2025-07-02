#!/bin/bash

set -euo pipefail  # Exit on error, undefined variables, and pipe failures

echo "Restarting Level Up application..."

# Function to safely kill processes
kill_processes_on_port() {
    local port="$1"
    if [[ ! "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1024 ] || [ "$port" -gt 65535 ]; then
        echo "Error: Invalid port number: $port"
        exit 1
    fi
    
    echo "Checking for processes using port $port..."
    local pids
    pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo "Found processes: $pids"
        # Use SIGTERM first, then SIGKILL if needed
        echo "$pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        # Check if any processes are still running
        local remaining_pids
        remaining_pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$remaining_pids" ]; then
            echo "Force killing remaining processes: $remaining_pids"
            echo "$remaining_pids" | xargs -r kill -KILL 2>/dev/null || true
        fi
    else
        echo "No processes found using port $port"
    fi
}

# Get script directory safely
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"

# Validate server directory exists
if [ ! -d "$SERVER_DIR" ]; then
    echo "Error: Server directory not found at $SERVER_DIR"
    exit 1
fi

# Kill any processes using port 5001
kill_processes_on_port 5001

# Change to server directory and start the server
echo "Starting server..."
cd "$SERVER_DIR" || {
    echo "Error: Failed to change to server directory"
    exit 1
}

# Validate server.js exists
if [ ! -f "server.js" ]; then
    echo "Error: server.js not found in $SERVER_DIR"
    exit 1
fi

# Start the server in background
node server.js &
SERVER_PID=$!

# Validate the server started successfully
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Error: Failed to start server"
    exit 1
fi

echo "Server started with PID: $SERVER_PID"
echo "Server is running! Access the app at http://localhost:5001"
echo "Press Ctrl+C to stop the server"

# Keep the script running and handle cleanup
trap 'echo "Stopping server..."; kill "$SERVER_PID" 2>/dev/null || true; exit' INT TERM

# Wait for the server process
wait "$SERVER_PID" 