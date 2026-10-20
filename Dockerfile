# Multi-stage Dockerfile for Utsav
# Stage 1: Build client and server
FROM node:24-slim AS builder
WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci

# Copy source code and build config files
COPY tsconfig*.json vite.config.ts index.html ./
COPY src/ ./src/

# Build client (Vite) and server (tsup)
RUN npm run build

# Stage 2: Production runtime
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user and group
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs appuser

# Copy built artifacts and production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Set ownership to non-root user
USER appuser

EXPOSE 8080

CMD ["node", "dist/server/index.js"]
