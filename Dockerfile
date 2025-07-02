FROM node:16-alpine as build

WORKDIR /app

# Copy root package.json and install dependencies
COPY package*.json ./
RUN npm ci

# Copy client package.json and install its dependencies
COPY client/package*.json ./client/
RUN cd client && npm ci

# Copy server package.json and install its dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci

# Copy the rest of the application code
COPY . .

# Run the build command
RUN npm run build

FROM node:16-alpine

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001

WORKDIR /app

# Copy built application with proper ownership
COPY --from=build --chown=appuser:nodejs /app/server ./server
COPY --from=build --chown=appuser:nodejs /app/client/build ./client/build
COPY --chown=appuser:nodejs package*.json ./

# Switch to non-root user before installing dependencies
USER appuser

RUN npm ci --production

EXPOSE 5001

# Run as non-root user
CMD ["npm", "start"] 