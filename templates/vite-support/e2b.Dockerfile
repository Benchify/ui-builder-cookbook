# Simpler Dockerfile
FROM node:21-slim

# Install necessary tools
RUN apt-get update && apt-get install -y bash curl && rm -rf /var/lib/apt/lists/*

# Set working directory directly
WORKDIR /app

# Set up Vite with React + TypeScript
RUN npm create vite@latest . -- --template react-ts

# Clean up boilerplate files
RUN rm -rf /app/src/assets/* \
    && rm -f /app/src/App.css \
    && rm -f /app/public/vite.svg \
    && echo 'import React from "react";\n\nconst App: React.FC = () => {\n  return (\n    <div className="flex min-h-screen items-center justify-center">\n      <h1 className="text-2xl font-bold">Your App</h1>\n    </div>\n  );\n};\n\nexport default App;' > /app/src/App.tsx \
    && echo 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);' > /app/src/main.tsx

# Install all dependencies
RUN npm install

# Install Tailwind CSS with Vite plugin (v4 approach)
RUN npm install -D tailwindcss @tailwindcss/vite

RUN npm install lucide-react

# Create tailwind.config.js for Tailwind v4 (with proper path)
RUN echo 'export default {\n  content: [\n    "./index.html",\n    "./src/**/*.{js,ts,jsx,tsx}",\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}' > /app/tailwind.config.js

# Create postcss.config.js for Tailwind v4
RUN echo 'export default {\n  plugins: {},\n}' > /app/postcss.config.js

# Update vite.config.ts to use the Tailwind plugin and include allowedHosts
RUN echo 'import { defineConfig } from "vite"\nimport react from "@vitejs/plugin-react"\nimport tailwindcss from "@tailwindcss/vite"\n\nexport default defineConfig({\n  plugins: [\n    react(),\n    tailwindcss(),\n  ],\n  server: {\n    host: true,\n    allowedHosts: [".e2b.app"],\n  },\n})' > /app/vite.config.ts

# Configure Tailwind CSS (simplified import for v4)
RUN echo '@import "tailwindcss";' > /app/src/index.css

# Replace tsconfig.json with a complete version that works standalone
RUN echo '{\n  "compilerOptions": {\n    "target": "ES2020",\n    "useDefineForClassFields": true,\n    "lib": ["ES2020", "DOM", "DOM.Iterable"],\n    "module": "ESNext",\n    "skipLibCheck": true,\n    "moduleResolution": "bundler",\n    "allowImportingTsExtensions": true,\n    "resolveJsonModule": true,\n    "isolatedModules": true,\n    "noEmit": true,\n    "jsx": "react-jsx",\n    "strict": true,\n    "noUnusedLocals": true,\n    "noUnusedParameters": true,\n    "noFallthroughCasesInSwitch": true\n  },\n  "include": ["src"]\n}' > /app/tsconfig.json

# Make directory writable (this is crucial)
RUN chmod -R 777 /app

# Set proper entrypoint
ENTRYPOINT ["bash", "-c", "cd /app && npm run dev -- --host --port 5173"]
