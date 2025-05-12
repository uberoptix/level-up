#!/bin/bash

echo "Building and deploying Level Up application..."

# Build the client
cd "$(dirname "$0")/client"
npm run build

# Return to root and prepare server
cd ..
echo "Server preparation complete"

echo "Deployment ready! The production build is in client/build" 