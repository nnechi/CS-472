FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached until package.json changes).
COPY package*.json ./
RUN npm install

# Copy the rest of the client source.
COPY . .

# Vite's default dev port.
EXPOSE 5173

# Run the dev server, bound to 0.0.0.0 (via --host in the npm script).
CMD ["npm", "run", "dev"]
