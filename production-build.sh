#!/bin/bash

echo "Starting production build for Level Up application..."

# Set environment variables
export NODE_ENV=production

# Clean up previous builds
echo "Cleaning up previous builds..."
rm -rf client/build

# Install dependencies
echo "Installing dependencies..."
npm install
cd client && npm install
cd ../server && npm install
cd ..

# Build client
echo "Building client application..."
npm run build

# Optimize for production
echo "Optimizing for production..."
cd client/build
gzip -9 -k *.js *.css
find . -name "*.map" -type f -delete
cd ../..

# Create necessary directories
mkdir -p logs

echo "Production build completed successfully!"
echo "To start the application, run: NODE_ENV=production npm start" 