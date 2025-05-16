// lib/e2b.ts
import { Sandbox } from '@e2b/sdk';
import { GeneratedFile, DeployResult } from '@/lib/types';


const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
    throw new Error('E2B_API_KEY is not set');
}

// Ensure path has a leading slash
function normalizePath(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
}

// Initialize E2B SDK
export async function createSandbox() {
    try {
        const sandbox = await Sandbox.create({
            apiKey: E2B_API_KEY,
        });

        return sandbox;
    } catch (error: any) {
        console.error('E2B Error Details:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            data: error.data,
            headers: error.headers,
            url: error.url
        });
        throw error;
    }
}

// Set up a Vue environment with required dependencies
export async function prepareVueEnvironment(sandbox: Sandbox) {
    try {
        // Create necessary directories
        await sandbox.filesystem.makeDir('/src');
        await sandbox.filesystem.makeDir('/src/components');

        // Define base configuration files
        const packageJson = {
            name: "vue-app",
            version: "1.0.0",
            type: "module",
            scripts: {
                "dev": "vite",
                "build": "vue-tsc && vite build",
                "preview": "vite preview"
            },
            dependencies: {
                "vue": "^3.3.0",
                "vue-router": "^4.2.0",
                "pinia": "^2.1.0",
                "@vueuse/core": "^10.5.0"
            },
            devDependencies: {
                "@vitejs/plugin-vue": "^4.4.0",
                "typescript": "^5.2.0",
                "vite": "^4.5.0",
                "vue-tsc": "^1.8.0",
                "tailwindcss": "^3.3.0",
                "postcss": "^8.4.0",
                "autoprefixer": "^10.4.0"
            }
        };

        // Write initial configuration
        await sandbox.filesystem.write('/package.json', JSON.stringify(packageJson, null, 2));

        await sandbox.filesystem.write('/vite.config.ts', `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    server: {
        host: true,
        port: 3000
    }
})`);

        // Install dependencies with legacy peer deps to avoid conflicts
        await sandbox.process.start({
            cmd: 'npm install --legacy-peer-deps',
        });

        // Write Vue app files
        await sandbox.filesystem.write('/src/App.vue', `<template>
  <div class="min-h-screen">
    <router-view />
  </div>
</template>

<script setup lang="ts">
// App level setup
</script>`);

        await sandbox.filesystem.write('/tailwind.config.js', `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`);

        await sandbox.filesystem.write('/postcss.config.js', `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`);

        // Create index files
        await sandbox.filesystem.write('/index.html', `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`);

        await sandbox.filesystem.write('/src/main.ts', `import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')`);

        await sandbox.filesystem.write('/src/style.css', `@tailwind base;
@tailwind components;
@tailwind utilities;`);

        return sandbox;
    } catch (error: any) {
        console.error('E2B Environment Setup Error:', {
            message: error.message,
            details: error.details,
            command: error.command,
            exitCode: error.exitCode,
            stdout: error.stdout,
            stderr: error.stderr
        });
        throw error;
    }
}

// Deploy the app for preview
export async function deployApp(sandbox: Sandbox, files: GeneratedFile[]): Promise<DeployResult> {
    try {
        // Write all the generated files
        for (const file of files) {
            const normalizedPath = normalizePath(file.path);
            const dirPath = normalizedPath.split('/').slice(0, -1).join('/');

            if (dirPath && dirPath !== '/') {
                await sandbox.filesystem.makeDir(dirPath);
            }

            await sandbox.filesystem.write(normalizedPath, file.contents);
        }

        console.log('Starting development server...');
        // Start the development server
        const process = await sandbox.process.start({
            cmd: 'npm run dev',
        });

        const previewUrl = `https://${sandbox.id}-3000.code.e2b.dev`;
        console.log('Preview URL generated:', previewUrl);

        // Return the URL for preview
        return {
            previewUrl,
            process,
        };
    } catch (error: any) {
        console.error('E2B Deployment Error:', {
            message: error.message,
            sandboxId: sandbox?.id,
            status: error.status,
            statusText: error.statusText,
            data: error.data,
            url: error.url
        });
        throw error;
    }
}