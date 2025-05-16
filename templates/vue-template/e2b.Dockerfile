# You can use most Debian-based base images
FROM node:21-slim

# Install dependencies and customize sandbox
WORKDIR /home/user/app

# Pre-install common dependencies to speed up runtime
RUN npm install -g typescript vue@3

# Copy in package.json and install dependencies
COPY package.json /home/user/app/
RUN npm install --legacy-peer-deps

# Set up basic Vite configuration for Vue
RUN npx tailwindcss init
COPY nuxt.config.ts /home/user/app/
COPY vite.config.ts /home/user/app/