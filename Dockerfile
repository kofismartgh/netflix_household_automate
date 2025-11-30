# Base image: slim Node, much smaller than Playwright image
FROM node:20-slim

WORKDIR /app

# Install only the libraries Chromium/Playwright needs
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    wget \
 && rm -rf /var/lib/apt/lists/*

# Install app dependencies (keeps your tsx/TypeScript start script)
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Directory for Playwright browser binaries and any tmp state
RUN mkdir -p /app/tmp && chmod 755 /app/tmp
ENV PLAYWRIGHT_BROWSERS_PATH=/app/tmp/browsers
ENV NODE_ENV=production

# Run as non‑root user (UID 1000)
RUN if id -u 1000 >/dev/null 2>&1; then \
      chown -R 1000:1000 /app; \
    else \
      useradd -m -u 1000 appuser && chown -R appuser:appuser /app; \
    fi
USER 1000

# Optional health check – same logic you had
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "tsx.*index.ts" || exit 1

# First container run will download Chromium into PLAYWRIGHT_BROWSERS_PATH
# (you can preinstall with: npx playwright install chromium)
CMD ["npm", "start"]
