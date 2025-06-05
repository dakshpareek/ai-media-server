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

# Prune devDependencies after build for a smaller image
RUN npm prune --production

# Expose MCP server port (if needed)
EXPOSE 3000

CMD ["node", "dist/mcp-server.js", "--http"]
