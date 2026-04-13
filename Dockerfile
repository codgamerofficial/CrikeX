# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY server/src ./src
COPY server/tests ./tests

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app

# Copy dependencies from builder
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/src ./src
COPY --from=builder --chown=app:app /app/tests ./tests
COPY server/package*.json ./

# Create log directory
RUN mkdir -p /app/logs && chown -R app:app /app

# Switch to app user
USER app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Start application
CMD ["node", "src/index.js"]
