import { Sandbox } from '@e2b/code-interpreter';
import { benchifyFileSchema } from './schemas';
import { z } from 'zod';
import { fetchAllSandboxFiles } from './file-filter';
import { applyTransformations } from './sandbox-helpers';

const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
    throw new Error('E2B_API_KEY is not set');
}


export async function createSandbox({ files }: { files: z.infer<typeof benchifyFileSchema> }) {
    // Create sandbox from the improved template
    const sandbox = await Sandbox.create('vite-support', { apiKey: E2B_API_KEY });
    console.log(`Sandbox created: ${sandbox.sandboxId}`);

    // Apply transformations (including Tailwind v4 syntax)
    const transformedFiles = applyTransformations(files);

    // Write files directly to the working directory (/app)
    const filesToWrite = transformedFiles.map(file => ({
        path: `/app/${file.path}`,
        data: file.content
    }));

    await sandbox.files.write(filesToWrite);

    // Check if package.json was written and install only new dependencies
    const packageJsonFile = transformedFiles.find(file => file.path === 'package.json');
    if (packageJsonFile) {
        console.log('package.json detected, checking for new dependencies...');
        try {
            const newPackages = extractNewPackages(packageJsonFile.content);

            if (newPackages.length > 0) {
                console.log('Installing new packages:', newPackages);
                const installCmd = `cd /app && npm install ${newPackages.join(' ')} --no-save`;
                const result = await sandbox.commands.run(installCmd);
                console.log('New packages installed successfully:', result.stdout);
                if (result.stderr) {
                    console.warn('npm install warnings:', result.stderr);
                }
            } else {
                console.log('No new packages to install');
            }
        } catch (error) {
            console.error('Failed to install new packages:', error);
            // Don't throw here, let the sandbox continue - users can still work with basic dependencies
        }
    }

    // Get all files from the sandbox using the improved filter logic
    const allFiles = await fetchAllSandboxFiles(sandbox);

    const previewUrl = `https://${sandbox.getHost(5173)}`;

    return {
        sbxId: sandbox.sandboxId,
        template: 'vite-support',
        url: previewUrl,
        allFiles: allFiles
    };
}

function extractNewPackages(packageJsonContent: string): string[] {
    try {
        const packageJson = JSON.parse(packageJsonContent);
        const dependencies = packageJson.dependencies || {};

        // Base packages that are already installed in the template
        const basePackages = [
            'react',
            'react-dom',
            '@vitejs/plugin-react',
            'tailwindcss',
            '@tailwindcss/vite',
            'typescript',
            'vite'
        ];

        // Find packages that aren't in our base template
        const newPackages = Object.entries(dependencies)
            .filter(([pkg]) => !basePackages.includes(pkg))
            .map(([pkg, version]) => `${pkg}@${version}`);

        return newPackages;
    } catch (error) {
        console.error('Error parsing package.json:', error);
        return [];
    }
}

