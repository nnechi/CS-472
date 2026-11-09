# The runner service. It needs the Docker CLI (not a whole Docker install):
# docker-compose mounts the host's /var/run/docker.sock so it can start
# sandbox containers. That makes this container root-equivalent on the host,
# so it stays small and never runs student code itself.
FROM node:20-alpine

RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 4000

# Runs as root: the mounted docker.sock belongs to root and the host's docker group.
CMD ["node", "dist/index.js"]
