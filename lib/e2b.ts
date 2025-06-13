import { Sandbox } from '@e2b/code-interpreter';
import { benchifyFileSchema } from './schemas';
import { z } from 'zod';
import { fetchAllSandboxFiles } from './file-filter';
import { applyTransformations } from './sandbox-helpers';

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
                    // Parse npm install errors
                    if (result.stderr.includes('npm ERR!')) {
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

    // Run TypeScript check to catch type errors
    try {
        console.log('Running TypeScript check...');
        const tscResult = await sandbox.commands.run('cd /app && npx tsc --noEmit --skipLibCheck');

        if (tscResult.exitCode !== 0 && tscResult.stderr) {
            console.log('TypeScript errors found:', tscResult.stderr);
            const tsErrors = parseTypeScriptErrors(tscResult.stderr);
            buildErrors.push(...tsErrors);
        }
    } catch (error) {
        console.error('TypeScript check failed:', error);
        buildErrors.push({
            type: 'typescript',
            message: `TypeScript check failed: ${error instanceof Error ? error.message : String(error)}`
        });
    }

    // Try to build the project to catch build-time errors
    try {
        console.log('Running build check...');
        const buildResult = await sandbox.commands.run('cd /app && npm run build');

        if (buildResult.exitCode !== 0) {
            console.log('Build errors found:', buildResult.stderr);
            const viteErrors = parseViteBuildErrors(buildResult.stderr);
            buildErrors.push(...viteErrors);
        }
    } catch (error) {
        console.error('Build check failed:', error);
        buildErrors.push({
            type: 'build',
            message: `Build failed: ${error instanceof Error ? error.message : String(error)}`
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

function parseTypeScriptErrors(stderr: string): BuildError[] {
    const errors: BuildError[] = [];
    const lines = stderr.split('\n');

    for (const line of lines) {
        // Match TypeScript error pattern: file(line,column): error TS####: message
        const match = line.match(/(.+)\((\d+),(\d+)\): error TS\d+: (.+)/);
        if (match) {
            const [, file, line, column, message] = match;
            errors.push({
                type: 'typescript',
                message: message.trim(),
                file: file.replace('/app/', ''),
                line: parseInt(line),
                column: parseInt(column)
            });
        }
    }

    // If no specific errors found but stderr has content, add generic error
    if (errors.length === 0 && stderr.trim()) {
        errors.push({
            type: 'typescript',
            message: 'TypeScript compilation failed: ' + stderr.trim()
        });
    }

    return errors;
}

function parseViteBuildErrors(stderr: string): BuildError[] {
    const errors: BuildError[] = [];
    const lines = stderr.split('\n');

    for (const line of lines) {
        // Match Vite build error patterns
        if (line.includes('error') || line.includes('Error')) {
            errors.push({
                type: 'build',
                message: line.trim()
            });
        }
    }

    // If no specific errors found but stderr has content, add generic error
    if (errors.length === 0 && stderr.trim()) {
        errors.push({
            type: 'build',
            message: 'Build failed: ' + stderr.trim()
        });
    }

    return errors;
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

