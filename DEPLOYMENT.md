# Level Up Deployment Guide

## Prerequisites
- Node.js 16+ installed
- npm 7+ installed
- Docker and Docker Compose (optional, for containerized deployment)

## Local Production Build
1. Clone the repository
2. Install dependencies:
   ```
   npm install
   cd client && npm install
   cd ../server && npm install
   ```
3. Build the client:
   ```
   npm run build
   ```
4. Start the production server:
   ```
   npm start
   ```
   
## Docker Deployment
1. Build and run with Docker Compose:
   ```
   docker-compose up -d
   ```
2. The application will be available at http://localhost:5001

## Traditional Hosting Deployment
1. Build the client:
   ```
   npm run build
   ```
2. Copy the `server` directory and `client/build` directory to your hosting provider
3. Install production dependencies on the server:
   ```
   npm ci --production
   ```
4. Start the server with PM2 or similar process manager:
   ```
   pm2 start server/server.js
   ```

## Environment Configuration
Create `.env.production` files in both the client and server directories with appropriate settings before building.

### Client Environment Variables
```
REACT_APP_API_URL=https://your-production-server.com/api
REACT_APP_SOCKET_URL=https://your-production-server.com
GENERATE_SOURCEMAP=false
```

### Server Environment Variables
```
PORT=5001
NODE_ENV=production
CORS_ORIGIN=https://your-production-domain.com
```

## Data Persistence
By default, Level Up stores activity data in `server/data.json`. For production:

1. Consider implementing a database for improved data management
2. Set up regular backups of the data file
3. When using Docker, mount the data file as a volume as configured in docker-compose.yml

## Updating the Application
1. Pull the latest changes from the repository
2. Rebuild the client:
   ```
   npm run build
   ```
3. Restart the server 