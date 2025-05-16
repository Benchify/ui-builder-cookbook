import { Sandbox } from '@e2b/code-interpreter';
import { benchifyFileSchema } from './schemas';
import { z } from 'zod';

const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
    throw new Error('E2B_API_KEY is not set');
}

export async function createSandbox({ files }: { files: z.infer<typeof benchifyFileSchema> }) {
    const sandbox = await Sandbox.create('vue-dynamic-sandbox', { apiKey: E2B_API_KEY });

    // Write all files to the sandbox at once
    await sandbox.files.write(
        files.map(file => ({
            path: `/home/user/app/${file.path}`,
            data: file.contents
        }))
    );

    console.log("sandbox created", sandbox.sandboxId);

    // Find package.json to check for new dependencies
    const packageJsonFile = files.find(file => file.path === 'package.json');
    if (packageJsonFile) {
        try {
            const packageJson = JSON.parse(packageJsonFile.contents);
            const dependencies = packageJson.dependencies || {};
            const devDependencies = packageJson.devDependencies || {};

            // Filter out pre-installed dependencies (vue, tailwindcss, etc.)
            const preInstalled = ['vue', 'tailwindcss', 'autoprefixer', 'postcss', 'vite', '@vitejs/plugin-vue', '@vue/compiler-sfc'];

            // Get new deps that need to be installed
            const newDeps = Object.keys(dependencies).filter(dep => !preInstalled.includes(dep));
            const newDevDeps = Object.keys(devDependencies).filter(dep => !preInstalled.includes(dep));

            // Install only new dependencies if any exist
            if (newDeps.length > 0) {
                console.log("Installing new dependencies:", newDeps.join(", "));
                await sandbox.commands.run(`cd /home/user/app && npm install --legacy-peer-deps ${newDeps.join(' ')}`);
            }

            if (newDevDeps.length > 0) {
                console.log("Installing new dev dependencies:", newDevDeps.join(", "));
                await sandbox.commands.run(`cd /home/user/app && npm install --legacy-peer-deps --save-dev ${newDevDeps.join(' ')}`);
            }
        } catch (error) {
            console.error("Error parsing package.json:", error);
        }
    }

    // Run the Vite app
    await sandbox.commands.run('cd /home/user/app && npx vite');

    return {
        sbxId: sandbox.sandboxId,
        template: 'vue-dynamic-sandbox',
        url: `https://${sandbox.getHost(5173)}`
    };
}

