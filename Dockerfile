# Cloud Run container for the PKK backend.
FROM node:20-slim

WORKDIR /app

# Install production deps reproducibly from the lockfile.
COPY package*.json ./
RUN npm ci --omit=dev

# App source
COPY . .

ENV NODE_ENV=production
# Cloud Run injects PORT (default 8080); server.js already uses process.env.PORT.
EXPOSE 8080

CMD ["node", "server.js"]
