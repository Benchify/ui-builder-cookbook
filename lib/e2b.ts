import { Sandbox } from '@e2b/code-interpreter';
import { benchifyFileSchema } from './schemas';
import { z } from 'zod';
import { fetchAllSandboxFiles } from './file-filter';
import { applyTransformations } from './sandbox-helpers';
import { ProgressTracker } from './progress-tracker';

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

export async function updateSandboxFiles({
    sandboxId,
    files,
    progressTracker
}: {
    sandboxId: string;
    files: z.infer<typeof benchifyFileSchema>;
    progressTracker?: ProgressTracker | null;
}): Promise<SandboxResult> {
    console.log(`Updating existing sandbox: ${sandboxId}`);

    // Connect to existing running sandbox
    const sandbox = await Sandbox.connect(sandboxId);

    // Apply transformations (including Tailwind v4 syntax)
    const transformedFiles = applyTransformations(files);

    // Write files directly to the working directory (/app), replacing existing ones
    const filesToWrite = transformedFiles.map(file => ({
        path: `/app/${file.path}`,
        data: file.contents
    }));

    progressTracker?.startStep('updating-files');
    await sandbox.files.write(filesToWrite);
    progressTracker?.completeStep('updating-files');

    // Check if package.json was updated and install any new dependencies
    progressTracker?.startStep('installing-deps');
    const packageJsonFile = transformedFiles.find(file => file.path === 'package.json');
    if (packageJsonFile) {
        console.log('package.json updated, checking for new dependencies...');
        try {
            const newPackages = extractNewPackages(packageJsonFile.contents);

            if (newPackages.length > 0) {
                console.log('Installing new packages:', newPackages);
                const installCmd = `cd /app && npm install ${newPackages.join(' ')} --no-save`;
                const result = await sandbox.commands.run(installCmd);
                console.log('New packages installed successfully:', result.stdout);
            } else {
                console.log('No new packages to install');
            }
        } catch (error) {
            console.error('Failed to install new packages:', error);
        }
    }
    progressTracker?.completeStep('installing-deps');

    // Wait for hot reload to take effect
    progressTracker?.startStep('hot-reloading');
    console.log('Waiting for hot reload to take effect...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief wait for hot reload
    progressTracker?.completeStep('hot-reloading');

    // Quick health check to ensure the updated app is working
    progressTracker?.startStep('verifying-update');
    const maxAttempts = 10; // Shorter timeout since server should already be running
    const pollInterval = 500;
    let isServerReady = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const healthCheck = await sandbox.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:5173', { timeoutMs: 3000 });

            if (healthCheck.stdout === '200') {
                console.log(`✅ Updated app is ready after ${attempt * pollInterval}ms!`);
                isServerReady = true;
                break;
            }
        } catch (healthError) {
            console.log(`Health check attempt ${attempt} failed:`, healthError);
        }

        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }
    progressTracker?.completeStep('verifying-update');

    // Get all files from the sandbox
    progressTracker?.startStep('finalizing-preview');
    const allFiles = await fetchAllSandboxFiles(sandbox);
    progressTracker?.completeStep('finalizing-preview');

    const previewUrl = `https://${sandbox.getHost(5173)}`;

    return {
        sbxId: sandbox.sandboxId,
        template: 'vite-support',
        url: previewUrl,
        allFiles: allFiles,
        buildErrors: undefined, // Assume no build errors for hot reload updates
        hasErrors: !isServerReady
    };
}

export async function createSandbox({ files, progressTracker }: {
    files: z.infer<typeof benchifyFileSchema>;
    progressTracker?: ProgressTracker | null;
}): Promise<SandboxResult> {
    // Create sandbox from the improved template
    const sandbox = await Sandbox.create('vite-support', { apiKey: E2B_API_KEY });
    console.log(`Sandbox created: ${sandbox.sandboxId}`);

    // Apply transformations (including Tailwind v4 syntax)
    const transformedFiles = applyTransformations(files);

    // Write files directly to the working directory (/app)
    const filesToWrite = transformedFiles.map(file => ({
        path: `/app/${file.path}`,
        data: file.contents
    }));

    await sandbox.files.write(filesToWrite);
    progressTracker?.completeStep('creating-sandbox');

    const buildErrors: BuildError[] = [];

    // Check if package.json was written and install only new dependencies
    progressTracker?.startStep('installing-deps');
    const packageJsonFile = transformedFiles.find(file => file.path === 'package.json');
    if (packageJsonFile) {
        console.log('package.json detected, checking for new dependencies...');
        try {
            const newPackages = extractNewPackages(packageJsonFile.contents);

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
    progressTracker?.completeStep('installing-deps');

    // Start the dev server and check logs for errors (let Vite handle error detection)
    progressTracker?.startStep('starting-server');
    try {
        console.log('Starting dev server...');
        // Start dev server in background
        const devServerResult = await sandbox.commands.run('cd /app && npm run dev', { background: true });

        console.log('=== DEV SERVER INITIAL RESULT ===');
        console.log('Exit code:', devServerResult.exitCode);
        console.log('Stderr length:', devServerResult.stderr?.length || 0);
        console.log('Stdout length:', devServerResult.stdout?.length || 0);
        console.log('Stderr content:', devServerResult.stderr || 'No stderr');
        console.log('Stdout content:', devServerResult.stdout || 'No stdout');

        // Poll the dev server until it's ready or timeout
        console.log('Polling dev server for readiness...');
        const maxAttempts = 20; // 20 attempts with 500ms intervals = 10 seconds max
        const pollInterval = 250; // 500ms between attempts
        let isServerReady = false;

        console.log('=== CHECKING IF DEV SERVER IS ACTUALLY RUNNING ===');
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const healthCheck = await sandbox.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:5173', { timeoutMs: 3000 });
                console.log(`Health check attempt ${attempt}/${maxAttempts}:`, healthCheck.stdout);

                if (healthCheck.stdout === '200') {
                    console.log(`✅ Dev server is ready after ${(attempt - 1) * pollInterval + pollInterval}ms!`);
                    isServerReady = true;
                    break;
                }
            } catch (healthError) {
                console.log(`Health check attempt ${attempt} failed:`, healthError);
            }

            // Don't wait after the last attempt
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        if (!isServerReady) {
            console.log('❌ Dev server did not become ready within timeout period');
        }

        // Check what processes are running
        console.log('=== CHECKING RUNNING PROCESSES ===');
        try {
            const processCheck = await sandbox.commands.run('ps aux | grep -E "(vite|node)" | grep -v grep');
            console.log('Running processes:', processCheck.stdout);
        } catch (processError) {
            console.log('Process check failed:', processError);
        }

        // Check if there are any recent logs
        console.log('=== CHECKING FOR RECENT COMMAND OUTPUT ===');
        try {
            const recentLogs = await sandbox.commands.run('cd /app && timeout 2s npm run dev 2>&1 || true');
            console.log('Recent dev server attempt:', recentLogs.stdout);
            console.log('Recent dev server stderr:', recentLogs.stderr);
        } catch (logError) {
            console.log('Recent logs check failed:', logError);
        }

        // Simplified error detection: if there's stderr output or non-zero exit, it's likely an error
        const hasStderr = devServerResult.stderr && devServerResult.stderr.trim().length > 0;
        const hasErrorInStdout = devServerResult.stdout && (
            devServerResult.stdout.includes('error') ||
            devServerResult.stdout.includes('Error') ||
            devServerResult.stdout.includes('failed') ||
            devServerResult.stdout.includes('Failed')
        );

        // Check if the errors are just permission issues that don't prevent the server from working
        const isPermissionError = devServerResult.stderr &&
            devServerResult.stderr.includes('EACCES: permission denied') &&
            devServerResult.stderr.includes('/app/node_modules/.vite-temp/');

        // Check for actual compilation/build errors in the recent logs
        let hasCompilationError = false;
        let compilationErrorOutput = '';

        console.log('=== COMPILATION ERROR CHECK ===');

        // Simplified approach - just try one quick check
        try {
            console.log('Trying quick build check...');
            const buildCheck = await sandbox.commands.run('cd /app && timeout 5s npm run build 2>&1 || true');
            console.log('Build check output:', buildCheck.stdout?.substring(0, 500));

            if (buildCheck.stdout && (
                buildCheck.stdout.includes('Unterminated string constant') ||
                buildCheck.stdout.includes('Unterminated string literal') ||
                buildCheck.stdout.includes('SyntaxError') ||
                buildCheck.stdout.includes('Unexpected token') ||
                buildCheck.stdout.includes('error TS') ||
                buildCheck.stdout.includes('[plugin:vite:') ||
                buildCheck.stdout.includes('Parse error') ||
                buildCheck.stdout.includes('Parsing error')
            )) {
                hasCompilationError = true;
                compilationErrorOutput = buildCheck.stdout;
                console.log('✅ Found compilation error in build output');
            }
        } catch (buildError) {
            console.log('Build check failed:', buildError);
        }

        console.log('=== COMPILATION ERROR CHECK SUMMARY ===');
        console.log('Has compilation error:', hasCompilationError);
        console.log('Compilation error output length:', compilationErrorOutput.length);

        console.log('Dev server started, output checked');
        console.log('Total build errors found:', buildErrors.length);

        console.log('=== ERROR ANALYSIS ===');
        console.log('Has stderr:', hasStderr);
        console.log('Has error in stdout:', hasErrorInStdout);
        console.log('Is permission error:', isPermissionError);
        console.log('Has compilation error:', hasCompilationError);

        if (hasCompilationError || ((hasStderr || hasErrorInStdout) && !isPermissionError)) {
            console.log('🔴 REAL ERRORS DETECTED IN DEV SERVER OUTPUT');

            // Get the actual error output for display
            let errorOutput = '';

            if (hasCompilationError) {
                // Use the compilation error output we found
                errorOutput = compilationErrorOutput;
                console.log('Using compilation error output for display');
            } else {
                // Use the original stderr/stdout
                errorOutput = [devServerResult.stderr, devServerResult.stdout]
                    .filter(Boolean)
                    .join('\n')
                    .trim();
                console.log('Using dev server stderr/stdout for display');
            }

            if (errorOutput) {
                console.log('Adding build error with message length:', errorOutput.length);

                // Parse TypeScript errors for better display
                const parsedErrors = parseTypeScriptErrors(errorOutput);
                if (parsedErrors.length > 0) {
                    buildErrors.push(...parsedErrors);
                } else {
                    // Fallback to raw error output
                    buildErrors.push({
                        type: 'build',
                        message: errorOutput
                    });
                }
            }
        } else if (isPermissionError) {
            console.log('⚠️  Permission errors detected but likely non-critical (E2B sandbox issue)');
        } else {
            console.log('✅ No errors detected in dev server output');
        }
    } catch (error) {
        console.error('Dev server check failed:', error);
        buildErrors.push({
            type: 'build',
            message: `Dev server failed to start: ${error instanceof Error ? error.message : String(error)}`
        });
    }
    progressTracker?.completeStep('starting-server');

    // Get all files from the sandbox using the improved filter logic
    progressTracker?.startStep('finalizing-preview');
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

function parseTypeScriptErrors(output: string): BuildError[] {
    const errors: BuildError[] = [];

    // Match TypeScript error format: file(line,col): error TSxxxx: message
    const tsErrorRegex = /([^(]+)\((\d+),(\d+)\): error (TS\d+): (.+)/g;

    let match;
    while ((match = tsErrorRegex.exec(output)) !== null) {
        const [, file, line, col, errorCode, message] = match;
        errors.push({
            type: 'typescript',
            message: `${errorCode}: ${message}`,
            file: file.trim(),
            line: parseInt(line, 10),
            column: parseInt(col, 10)
        });
    }

    // If no specific TypeScript errors found, try to extract any line that looks like an error
    if (errors.length === 0) {
        const lines = output.split('\n');
        for (const line of lines) {
            if (line.includes('error') || line.includes('Error')) {
                errors.push({
                    type: 'build',
                    message: line.trim()
                });
            }
        }
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

