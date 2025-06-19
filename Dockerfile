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
    adduser -S sveltekit -u 1001 -G nodejs

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/package*.json ./
COPY --from=builder --chown=sveltekit:nodejs /app/node_modules ./node_modules

# Create logs directory
RUN mkdir -p /app/logs && \
    chown -R sveltekit:nodejs /app

# Drop privileges
USER sveltekit

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start application
CMD ["node", "build/index.js"]