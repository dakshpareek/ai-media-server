FROM node:20-alpine

# Install curl, jq, and Docker CLI
RUN apk update && apk add --no-cache curl jq docker-cli-compose docker-cli

# Verify Docker CLI installation
RUN which docker || echo "Docker CLI not found"
RUN docker --version || echo "Docker version check failed"

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# After build, install only production dependencies
RUN npm ci --only=production

# Expose MCP server port (if needed)
EXPOSE 3000

# Create health check script
RUN echo '#!/bin/sh\nexit 0' > /health-check.sh && chmod +x /health-check.sh

# Set environment variables
ENV PROWLARR_URL=http://localhost:9696
ENV PROWLARR_API_KEY=44b56a79a82d4295a367713457e6b074
ENV DOCKER_HOST=unix:///var/run/docker.sock

# Start MCP server using built files
CMD ["npm", "run", "start"] 