# Sri Krishna Department Store - backend API (Node.js + Express + Socket.io)
# Built and started by docker-compose.yml in the project root.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
# Tells the API that settings come from docker-compose (Account & Security cannot edit .env)
ENV RUNNING_IN_DOCKER=1

# Production packages only (this layer is cached until package files change)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App source (.dockerignore keeps node_modules, .env and uploads out of the image)
COPY . .

# Uploaded images are kept in a volume (see docker-compose.yml) so they survive rebuilds
RUN mkdir -p uploads/items uploads/offers uploads/settings && chown -R node:node uploads
USER node

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "server.js"]
