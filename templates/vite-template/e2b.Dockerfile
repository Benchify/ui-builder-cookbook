# You can use most Debian-based base images
FROM ubuntu:22.04

# Install dependencies and customize sandbox
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    curl \
    git \
    bash \
    ca-certificates \
    gnupg \
    build-essential \
    sudo \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18.x LTS (more stable for this purpose)
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y nodejs && \
    npm install -g npm@10.2.4

# Create app user
RUN useradd -m -s /bin/bash viteuser && \
    echo "viteuser ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/viteuser

# Create app directory
WORKDIR /app

# Install Vite globally
RUN npm install -g vite create-vite

# Create basic Vite project structure
COPY ./template /app

# Set proper ownership and permissions
RUN chown -R viteuser:viteuser /app && \
    chmod -R 775 /app

# Install dependencies as the viteuser
USER viteuser
RUN cd /app && npm install

# Create Vite cache directories with proper permissions
RUN mkdir -p /app/node_modules/.vite && \
    mkdir -p /app/node_modules/.vite-temp && \
    chmod -R 777 /app/node_modules/.vite && \
    chmod -R 777 /app/node_modules/.vite-temp

# Expose port
EXPOSE 5173

# Set entrypoint
CMD ["npm", "run", "dev"]