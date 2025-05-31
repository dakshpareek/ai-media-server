FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && \
    apt-get install -y \
    curl \
    wget \
    iputils-ping \
    iproute2 \
    iptables \
    ca-certificates \
    gnupg \
    lsb-release \
    apt-transport-https \
    && rm -rf /var/lib/apt/lists/*

# Add NordVPN repository and install manually (non-interactive)
RUN curl -sSf https://repo.nordvpn.com/gpg/nordvpn_public.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/nordvpn.gpg > /dev/null && \
    echo "deb https://repo.nordvpn.com/deb/nordvpn/debian stable main" | tee /etc/apt/sources.list.d/nordvpn.list && \
    apt-get update && \
    apt-get install -y nordvpn && \
    rm -rf /var/lib/apt/lists/*

# Add nordvpn user to nordvpn group
RUN usermod -aG nordvpn root

# Create entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Health check script
COPY healthcheck.sh /healthcheck.sh  
RUN chmod +x /healthcheck.sh

ENTRYPOINT ["/entrypoint.sh"] 