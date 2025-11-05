# Multi-stage Docker build for PoolVisual
# Stage 1: Build the client
FROM node:18-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --only=production

COPY client/ ./
RUN npm run build

# Stage 2: Build the server
FROM node:18-alpine AS server-builder

WORKDIR /app/server
COPY server/package*.json ./
COPY shared/ ./shared/
RUN npm ci --only=production

COPY server/ ./
RUN npm run build

# Stage 3: Production image
FROM node:18-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S poolvisual -u 1001

# Set working directory
WORKDIR /app

# Copy built applications
COPY --from=client-builder /app/client/dist ./client/dist
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/shared ./shared
COPY --from=server-builder /app/public ./public

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install production dependencies
RUN npm ci --only=production && \
    cd server && npm ci --only=production

# Create uploads directory
RUN mkdir -p uploads && chown -R poolvisual:nodejs uploads

# Switch to non-root user
USER poolvisual

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "server/dist/index.js"]
