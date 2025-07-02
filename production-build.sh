#!/bin/bash

set -euo pipefail  # Exit on error, undefined variables, and pipe failures

echo "Starting production build for Level Up application..."

# Get script directory safely
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$SCRIPT_DIR/client"
SERVER_DIR="$SCRIPT_DIR/server"

# Set environment variables
export NODE_ENV=production

# Validate required directories exist
if [ ! -d "$CLIENT_DIR" ]; then
    echo "Error: Client directory not found at $CLIENT_DIR"
    exit 1
fi

if [ ! -d "$SERVER_DIR" ]; then
    echo "Error: Server directory not found at $SERVER_DIR"
    exit 1
fi

# Clean up previous builds safely
echo "Cleaning up previous builds..."
if [ -d "$CLIENT_DIR/build" ]; then
    rm -rf "$CLIENT_DIR/build" || {
        echo "Error: Failed to remove existing build directory"
        exit 1
    }
fi

# Function to run npm install safely
safe_npm_install() {
    local dir="$1"
    local desc="$2"
    
    echo "Installing $desc dependencies..."
    cd "$dir" || {
        echo "Error: Failed to change to $dir"
        exit 1
    }
    
    if [ ! -f "package.json" ]; then
        echo "Error: package.json not found in $dir"
        exit 1
    fi
    
    npm ci || {
        echo "Error: Failed to install $desc dependencies"
        exit 1
    }
}

# Install dependencies
safe_npm_install "$SCRIPT_DIR" "root"
safe_npm_install "$CLIENT_DIR" "client"
safe_npm_install "$SERVER_DIR" "server"

# Return to root directory
cd "$SCRIPT_DIR" || {
    echo "Error: Failed to return to script directory"
    exit 1
}

# Build client
echo "Building client application..."
npm run build || {
    echo "Error: Failed to build client application"
    exit 1
}

# Validate build was successful
if [ ! -d "$CLIENT_DIR/build" ]; then
    echo "Error: Build directory was not created"
    exit 1
fi

# Optimize for production
echo "Optimizing for production..."
cd "$CLIENT_DIR/build" || {
    echo "Error: Failed to change to build directory"
    exit 1
}

# Safely compress static files
echo "Compressing static files..."
find . -name "*.js" -type f -exec gzip -9 -k {} \; || {
    echo "Warning: Failed to compress some JS files"
}

find . -name "*.css" -type f -exec gzip -9 -k {} \; || {
    echo "Warning: Failed to compress some CSS files"
}

# Remove source maps for security
echo "Removing source maps..."
find . -name "*.map" -type f -delete || {
    echo "Warning: Failed to remove some source map files"
}

# Return to root directory
cd "$SCRIPT_DIR" || {
    echo "Error: Failed to return to script directory"
    exit 1
}

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p logs || {
    echo "Warning: Failed to create logs directory"
}

echo "Production build completed successfully!"
echo "To start the application, run: NODE_ENV=production npm start" 