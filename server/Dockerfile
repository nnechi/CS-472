# Start from an official Node.js image. "alpine" is a small Linux base.
FROM node:20-alpine

# All following commands run inside /app in the container.
WORKDIR /app

# Copy ONLY the manifest files first. Docker caches this layer, so
# "npm install" re-runs only when your dependencies actually change.
COPY package*.json ./
RUN npm install

# Copy the rest of the source code into the image.
COPY . .

# Document the port the server listens on (see docker-compose for the mapping).
EXPOSE 3000

# Start the dev server with hot reload. tsx runs TypeScript directly.
CMD ["npm", "run", "dev"]
