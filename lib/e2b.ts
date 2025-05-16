import { Sandbox } from '@e2b/code-interpreter';
import { benchifyFileSchema } from './schemas';
import { z } from 'zod';

const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
    throw new Error('E2B_API_KEY is not set');
}

export async function createSandbox({ files }: { files: z.infer<typeof benchifyFileSchema> }) {
    const sandbox = await Sandbox.create('vite-template', { apiKey: E2B_API_KEY });

    // Debug: Log template files before writing anything
    try {
        console.log("TEMPLATE VERIFICATION:");
        const { stdout: templateFiles } = await sandbox.commands.run('ls -la /app', { cwd: '/app' });
        console.log("Template files in /app:", templateFiles);

        const { stdout: templatePkgJson } = await sandbox.commands.run('cat /app/package.json', { cwd: '/app' });
        console.log("Template package.json:", templatePkgJson);
    } catch (error) {
        console.error("Error checking template:", error);
    }

    // Find AI-generated package.json to extract dependencies
    const aiPackageJsonFile = files.find(file => file.path === 'package.json');

    // Filter out package.json from files to write (we'll handle it separately)
    const filesToWrite = files
        .filter(file => file.path !== 'package.json')
        .map(file => ({
            path: `/app/${file.path}`,
            data: file.content
        }));

    // Write all files to the sandbox EXCEPT package.json
    await sandbox.files.write(filesToWrite);

    console.log("sandbox created", sandbox.sandboxId);

    // Debug: Verify files after writing
    try {
        console.log("AFTER WRITING FILES:");
        const { stdout: rootContents } = await sandbox.commands.run('ls -la /app', { cwd: '/app' });
        console.log("Files in /app:", rootContents);

        const { stdout: packageJson } = await sandbox.commands.run('cat /app/package.json', { cwd: '/app' });
        console.log("Current package.json:", packageJson);

        const { stdout: scriptsList } = await sandbox.commands.run('npm run', { cwd: '/app' });
        console.log("Available npm scripts:", scriptsList);
    } catch (error) {
        console.error("Error in debug commands:", error);
    }

    // Process dependencies if AI provided a package.json
    if (aiPackageJsonFile) {
        try {
            const aiPackageJson = JSON.parse(aiPackageJsonFile.content);
            const dependencies = aiPackageJson.dependencies || {};
            const devDependencies = aiPackageJson.devDependencies || {};

            // Filter out pre-installed dependencies
            const preInstalled = [
                'react', 'react-dom', '@tailwindcss/vite', 'tailwindcss',
                '@types/react', '@types/react-dom', '@vitejs/plugin-react',
                'typescript', 'vite', 'postcss', 'autoprefixer'
            ];

            // Get new deps that need to be installed
            const newDeps = Object.keys(dependencies).filter(dep => !preInstalled.includes(dep));
            const newDevDeps = Object.keys(devDependencies).filter(dep => !preInstalled.includes(dep));

            // Install only new dependencies if any exist
            if (newDeps.length > 0) {
                console.log("Installing new dependencies:", newDeps.join(", "));
                await sandbox.commands.run(`cd /app && npm install --legacy-peer-deps ${newDeps.join(' ')}`);
            }

            if (newDevDeps.length > 0) {
                console.log("Installing new dev dependencies:", newDevDeps.join(", "));
                await sandbox.commands.run(`cd /app && npm install --legacy-peer-deps --save-dev ${newDevDeps.join(' ')}`);
            }
        } catch (error) {
            console.error("Error parsing package.json:", error);
        }
    }

    // Fix permissions with sudo before starting
    try {
        await sandbox.commands.run('sudo rm -rf /app/node_modules/.vite', { cwd: '/app' });
        await sandbox.commands.run('sudo mkdir -p /app/node_modules/.vite', { cwd: '/app' });
        await sandbox.commands.run('sudo chmod -R 777 /app/node_modules/.vite', { cwd: '/app' });
    } catch (error) {
        console.error("Error fixing permissions:", error);
    }

    // Run the Vite app
    try {
        await sandbox.commands.run('npm run dev -- --host', {
            cwd: '/app',
            timeoutMs: 0,
        });
    } catch (error) {
        console.error("Error running Vite:", error);
    }

    return {
        sbxId: sandbox.sandboxId,
        template: 'vite-template',
        url: `https://${sandbox.getHost(5173)}`
    };
}

