# Dockerfile for open-reception application

# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S openreception -u 1001 -G nodejs

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=openreception:nodejs /app/build ./build
COPY --from=builder --chown=openreception:nodejs /app/package*.json ./
COPY --from=builder --chown=openreception:nodejs /app/node_modules ./node_modules

# Copy migration files (required at runtime)
COPY --from=builder --chown=openreception:nodejs /app/migrations ./migrations
COPY --from=builder --chown=openreception:nodejs /app/tenant-migrations ./tenant-migrations

# Copy drizzle configs (required for migrations)
COPY --from=builder --chown=openreception:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=openreception:nodejs /app/drizzle.tenant.config.ts ./drizzle.tenant.config.ts

# Copy static files (includes argon2 WASM)
COPY --from=builder --chown=openreception:nodejs /app/static ./static

# Create logs directory
RUN mkdir -p /app/logs && \
    chown -R openreception:nodejs /app

# Drop privileges
USER openreception

# Expose port
EXPOSE 3000

# Security: In docker compose, this container should run with:
# - cap_drop: ALL (no Linux capabilities needed)
# - security_opt: no-new-privileges:true
# - read_only: true (with tmpfs for /tmp and /app/logs)

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start application
CMD ["node", "build/index.js"]