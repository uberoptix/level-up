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

WORKDIR /app
COPY --from=build /app/server ./server
COPY --from=build /app/client/build ./client/build
COPY package*.json ./

RUN npm ci --production

EXPOSE 5001
CMD ["npm", "start"] 