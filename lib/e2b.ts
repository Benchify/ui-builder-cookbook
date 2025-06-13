import { Sandbox } from '@e2b/code-interpreter';
import { benchifyFileSchema } from './schemas';
import { z } from 'zod';
import { fetchAllSandboxFiles } from './file-filter';
import { applyTransformations } from './sandbox-helpers';
import { detectCodeErrors, parseTypeScriptErrors } from './error-detection';

const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
    throw new Error('E2B_API_KEY is not set');
}

interface BuildError {
    type: 'typescript' | 'build' | 'runtime';
    message: string;
    file?: string;
    line?: number;
    column?: number;
}

interface SandboxResult {
    sbxId: string;
    template: string;
    url: string;
    allFiles: z.infer<typeof benchifyFileSchema>;
    buildErrors?: BuildError[];
    hasErrors: boolean;
}

export async function createSandbox({ files }: { files: z.infer<typeof benchifyFileSchema> }): Promise<SandboxResult> {
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

    const buildErrors: BuildError[] = [];

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
                    // Only treat critical npm errors as build errors (not warnings or peer dep issues)
                    if (result.stderr.includes('npm ERR!') &&
                        (result.stderr.includes('ENOTFOUND') ||
                            result.stderr.includes('ECONNREFUSED') ||
                            result.stderr.includes('permission denied'))) {
                        buildErrors.push({
                            type: 'build',
                            message: 'Package installation failed: ' + result.stderr.split('npm ERR!')[1]?.trim()
                        });
                    }
                }
            } else {
                console.log('No new packages to install');
            }
        } catch (error) {
            console.error('Failed to install new packages:', error);
            buildErrors.push({
                type: 'build',
                message: `Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    // Start the dev server and check logs for errors (let Vite handle error detection)
    try {
        console.log('Starting dev server...');
        // Start dev server in background
        const devServerResult = await sandbox.commands.run('cd /app && npm run dev', { background: true });

        console.log('Dev server command executed');
        console.log('Dev server exit code:', devServerResult.exitCode);
        console.log('Dev server stderr:', devServerResult.stderr || 'No stderr');
        console.log('Dev server stdout:', devServerResult.stdout || 'No stdout');

        // Give it a moment to start and potentially fail
        console.log('Waiting 3 seconds for dev server to start...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check the initial output for immediate errors
        if (devServerResult.stderr || devServerResult.stdout) {
            const allOutput = (devServerResult.stderr || '') + '\n' + (devServerResult.stdout || '');

            // Use the error detection module
            const errorResult = detectCodeErrors(allOutput);

            if (errorResult.hasErrors) {
                console.log('🔴 CODE ERRORS DETECTED!');
                buildErrors.push(...errorResult.errors);
            } else if (errorResult.isInfrastructureOnly) {
                console.log('⚠️  Only infrastructure errors detected (ignoring)');
            } else {
                console.log('✅ No errors detected');
            }
        } else {
            console.log('⚠️  No stderr or stdout from dev server command');
        }

        console.log('Dev server started, output checked');
        console.log('Total build errors found:', buildErrors.length);
    } catch (error) {
        console.error('Dev server check failed:', error);
        buildErrors.push({
            type: 'build',
            message: `Dev server failed to start: ${error instanceof Error ? error.message : String(error)}`
        });
    }

    // Get all files from the sandbox using the improved filter logic
    const allFiles = await fetchAllSandboxFiles(sandbox);

    const previewUrl = `https://${sandbox.getHost(5173)}`;

    return {
        sbxId: sandbox.sandboxId,
        template: 'vite-support',
        url: previewUrl,
        allFiles: allFiles,
        buildErrors: buildErrors.length > 0 ? buildErrors : undefined,
        hasErrors: buildErrors.length > 0
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

