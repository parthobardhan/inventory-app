# Production Dockerfile for Textile Inventory Management System
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for sharp and image processing
RUN apk add --no-cache \
    vips-dev \
    python3 \
    make \
    g++ \
    curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
