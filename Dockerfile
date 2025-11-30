# Use Playwright base image with Node.js and Chromium
FROM mcr.microsoft.com/playwright:v1.51.1-jammy

# Set working directory
WORKDIR /app

# Install dependencies first (for better layer caching)
# Note: We need devDependencies (TypeScript, tsx) for the start script
COPY package.json package-lock.json* ./
RUN npm ci && \
    npm cache clean --force

# Copy application source code
COPY tsconfig.json ./
COPY src/ ./src/

# Create tmp directory for storage state persistence
RUN mkdir -p /app/tmp && \
    chmod 755 /app/tmp

# Set environment to production
ENV NODE_ENV=production

# Expose no ports (application doesn't serve HTTP)

# Run as non-root user for security
# Playwright image already has a user, so we'll use that or create one
RUN if id -u 1000 > /dev/null 2>&1; then \
      chown -R 1000:1000 /app; \
    else \
      useradd -m -u 1000 appuser && chown -R appuser:appuser /app; \
    fi
USER 1000

# Health check (optional - checks if process is running)
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "tsx.*index.ts" || exit 1

# Start the application
CMD ["npm", "start"]

