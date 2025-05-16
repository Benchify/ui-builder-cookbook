# You can use most Debian-based base images
FROM node:21-slim

# Install dependencies and customize sandbox
WORKDIR /home/user/app

# Pre-install common dependencies to speed up runtime
RUN npm init -y
RUN npm install --legacy-peer-deps vue@3 
RUN npm install --legacy-peer-deps --save-dev tailwindcss@3 autoprefixer@10 postcss@8 @vue/compiler-sfc@3 vite @vitejs/plugin-vue

# Set up basic Vite configuration for Vue
RUN npx tailwindcss init
COPY nuxt.config.ts /home/user/app/