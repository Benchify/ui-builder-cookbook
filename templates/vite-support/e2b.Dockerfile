# Simpler Dockerfile
FROM node:21-slim

# Install necessary tools
RUN apt-get update && apt-get install -y bash curl && rm -rf /var/lib/apt/lists/*

# Set working directory directly
WORKDIR /app

# Set up Vite with React + TypeScript
RUN npm create vite@latest . -- --template react-ts

# Install all dependencies
RUN npm install

# Install Tailwind CSS with Vite plugin (v4 approach)
RUN npm install -D tailwindcss @tailwindcss/vite

# Update vite.config.ts to use the Tailwind plugin and include allowedHosts
RUN echo 'import { defineConfig } from "vite"\nimport react from "@vitejs/plugin-react"\nimport tailwindcss from "@tailwindcss/vite"\n\nexport default defineConfig({\n  plugins: [\n    react(),\n    tailwindcss(),\n  ],\n  server: {\n    host: true,\n    allowedHosts: [".e2b.app"],\n  },\n})' > vite.config.ts

# Configure Tailwind CSS (simplified import for v4)
RUN echo '@import "tailwindcss";' > ./src/index.css

# Make directory writable (this is crucial)
RUN chmod -R 777 /app

# Set proper entrypoint
ENTRYPOINT ["bash", "-c", "cd /app && npm run dev -- --host --port 5173"]