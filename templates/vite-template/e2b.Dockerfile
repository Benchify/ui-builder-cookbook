# You can use most Debian-based base images
FROM node:21-slim

# Install dependencies and customize sandbox
WORKDIR /home/user/app

# Pre-install common dependencies to speed up runtime
RUN npm install -g typescript vue@3

# Copy in package.json and install dependencies
COPY package.json /home/user/app/
RUN npm install --legacy-peer-deps

# Initialize Tailwind
RUN npx tailwindcss init

# Copy in application files
COPY . /home/user/app/
