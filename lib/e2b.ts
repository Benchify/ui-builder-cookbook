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

        console.log('=== DEV SERVER INITIAL RESULT ===');
        console.log('Exit code:', devServerResult.exitCode);
        console.log('Stderr length:', devServerResult.stderr?.length || 0);
        console.log('Stdout length:', devServerResult.stdout?.length || 0);
        console.log('Stderr content:', devServerResult.stderr || 'No stderr');
        console.log('Stdout content:', devServerResult.stdout || 'No stdout');

        // Give it a moment to start and potentially fail
        console.log('Waiting 5 seconds for dev server to start...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check if the dev server is actually running by trying to access it
        console.log('=== CHECKING IF DEV SERVER IS ACTUALLY RUNNING ===');
        try {
            const healthCheck = await sandbox.commands.run('curl -s -o /dev/null -w "%{http_code}" http://localhost:5173', { timeoutMs: 5000 });
            console.log('Health check result:', healthCheck);
            console.log('HTTP status code:', healthCheck.stdout);

            if (healthCheck.stdout === '200') {
                console.log('✅ Dev server is running successfully despite permission errors!');
            } else {
                console.log('❌ Dev server is not responding properly');
            }
        } catch (healthError) {
            console.log('Health check failed:', healthError);
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

        // Try multiple approaches to detect compilation errors
        try {
            // Approach 1: Try to build the project
            console.log('Trying npm run build...');
            const buildCheck = await sandbox.commands.run('cd /app && timeout 10s npm run build 2>&1 || true');
            console.log('Build check output:', buildCheck.stdout);
            console.log('Build check stderr:', buildCheck.stderr);

            if (buildCheck.stdout && (
                buildCheck.stdout.includes('Unterminated string constant') ||
                buildCheck.stdout.includes('SyntaxError') ||
                buildCheck.stdout.includes('Unexpected token') ||
                buildCheck.stdout.includes('Parse error') ||
                buildCheck.stdout.includes('[plugin:vite:') ||
                buildCheck.stdout.includes('Transform failed') ||
                buildCheck.stdout.includes('Build failed')
            )) {
                hasCompilationError = true;
                compilationErrorOutput = buildCheck.stdout;
                console.log('✅ Found compilation error in build output');
            }
        } catch (buildError) {
            console.log('Build check failed:', buildError);
        }

        // Approach 2: Try to check TypeScript compilation
        if (!hasCompilationError) {
            try {
                console.log('Trying tsc --noEmit...');
                const tscCheck = await sandbox.commands.run('cd /app && timeout 10s npx tsc --noEmit 2>&1 || true');
                console.log('TypeScript check output:', tscCheck.stdout);
                console.log('TypeScript check stderr:', tscCheck.stderr);

                if (tscCheck.stdout && (
                    tscCheck.stdout.includes('error TS') ||
                    tscCheck.stdout.includes('Unterminated string constant') ||
                    tscCheck.stdout.includes('SyntaxError')
                )) {
                    hasCompilationError = true;
                    compilationErrorOutput = tscCheck.stdout;
                    console.log('✅ Found compilation error in TypeScript check');
                }
            } catch (tscError) {
                console.log('TypeScript check failed:', tscError);
            }
        }

        // Approach 3: Try to parse files directly with Babel/ESLint
        if (!hasCompilationError) {
            try {
                console.log('Trying to parse main files...');
                const parseCheck = await sandbox.commands.run('cd /app && timeout 10s npx babel src/App.tsx --presets=@babel/preset-typescript 2>&1 || true');
                console.log('Parse check output:', parseCheck.stdout);
                console.log('Parse check stderr:', parseCheck.stderr);

                if (parseCheck.stderr && (
                    parseCheck.stderr.includes('Unterminated string constant') ||
                    parseCheck.stderr.includes('SyntaxError') ||
                    parseCheck.stderr.includes('Unexpected token')
                )) {
                    hasCompilationError = true;
                    compilationErrorOutput = parseCheck.stderr;
                    console.log('✅ Found compilation error in parse check');
                }
            } catch (parseError) {
                console.log('Parse check failed:', parseError);
            }
        }

        // Approach 4: Check if the dev server is actually serving errors
        if (!hasCompilationError) {
            try {
                console.log('Checking dev server response for errors...');
                const responseCheck = await sandbox.commands.run('cd /app && timeout 5s curl -s http://localhost:5173 2>&1 || true');
                console.log('Response check output:', responseCheck.stdout);

                if (responseCheck.stdout && (
                    responseCheck.stdout.includes('SyntaxError') ||
                    responseCheck.stdout.includes('Unterminated string') ||
                    responseCheck.stdout.includes('Parse error') ||
                    responseCheck.stdout.includes('Transform failed')
                )) {
                    hasCompilationError = true;
                    compilationErrorOutput = responseCheck.stdout;
                    console.log('✅ Found compilation error in dev server response');
                }
            } catch (responseError) {
                console.log('Response check failed:', responseError);
            }
        }

        // Approach 5: Check Vite logs more thoroughly
        if (!hasCompilationError) {
            try {
                console.log('Checking for Vite process logs...');
                const viteLogsCheck = await sandbox.commands.run('cd /app && ps aux | grep vite');
                console.log('Vite processes:', viteLogsCheck.stdout);

                // Try to get logs from the running Vite process
                const viteLogCheck = await sandbox.commands.run('cd /app && timeout 3s strace -p $(pgrep -f "vite --host") 2>&1 | head -20 || true');
                console.log('Vite process trace:', viteLogCheck.stdout);
            } catch (viteError) {
                console.log('Vite log check failed:', viteError);
            }
        }

        console.log('=== COMPILATION ERROR CHECK SUMMARY ===');
        console.log('Has compilation error:', hasCompilationError);
        console.log('Compilation error output length:', compilationErrorOutput.length);
        if (compilationErrorOutput) {
            console.log('Compilation error preview:', compilationErrorOutput.substring(0, 500));
        }

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
                buildErrors.push({
                    type: 'build',
                    message: errorOutput
                });
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

