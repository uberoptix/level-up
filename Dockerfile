FROM node:16-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:16-alpine

WORKDIR /app
COPY --from=build /app/server ./server
COPY --from=build /app/client/build ./client/build
COPY package*.json ./

RUN npm ci --production

EXPOSE 5001
CMD ["npm", "start"] 