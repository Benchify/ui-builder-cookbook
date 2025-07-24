'use server';

import { Benchify } from 'benchify';
import { createSandbox, updateSandboxFiles } from '@/lib/e2b';
import { FixerRunResponse } from 'benchify/resources/fixer.mjs';
import { ProgressTracker } from '@/lib/progress-tracker';

const benchify = new Benchify({
    apiKey: process.env.BENCHIFY_API_KEY,
});

type BenchifyFixerInput = {
    files: Array<{ path: string; contents: string }>;
    sessionId?: string;
    existingSandboxId?: string; // Optional: reuse existing sandbox instead of creating new one
};

export type BenchifyFixerResult = {
    originalFiles: Array<{ path: string; contents: string }>;
    repairedFiles: Array<{ path: string; contents: string }>;
    buildOutput: string;
    previewUrl: string;
    sandboxId: string; // Add sandbox ID so it can be reused
    buildErrors?: Array<{
        type: 'typescript' | 'build' | 'runtime';
        message: string;
        file?: string;
        line?: number;
        column?: number;
    }>;
    hasErrors?: boolean;
    sessionId?: string;
} | {
    error: string;
    message: string;
    sessionId?: string;
};

export async function runBenchifyFixer(input: BenchifyFixerInput): Promise<BenchifyFixerResult> {
    const { files, sessionId, existingSandboxId } = input;

    // Define the steps for the fixer process (different steps for new vs existing sandbox)
    const steps = existingSandboxId ? [
        {
            id: 'running-fixer',
            label: 'Running Benchify Fixer',
            description: 'Analyzing and optimizing code for better performance and quality'
        },
        {
            id: 'updating-files',
            label: 'Updating Files',
            description: 'Applying optimized code to your existing sandbox'
        },
        {
            id: 'installing-deps',
            label: 'Installing Dependencies',
            description: 'Installing any new required packages'
        },
        {
            id: 'hot-reloading',
            label: 'Hot Reloading',
            description: 'Applying changes with hot reload for instant updates'
        },
        {
            id: 'verifying-update',
            label: 'Verifying Update',
            description: 'Ensuring the optimized code is working correctly'
        },
        {
            id: 'finalizing-preview',
            label: 'Finalizing',
            description: 'Your optimized application is ready!'
        }
    ] : [
        {
            id: 'running-fixer',
            label: 'Running Benchify Fixer',
            description: 'Analyzing and optimizing code for better performance and quality'
        },
        {
            id: 'creating-sandbox',
            label: 'Creating Sandbox',
            description: 'Setting up development environment with optimized code'
        },
        {
            id: 'installing-deps',
            label: 'Installing Dependencies',
            description: 'Installing required packages and dependencies'
        },
        {
            id: 'starting-server',
            label: 'Starting Dev Server',
            description: 'Starting development server and running health checks'
        },
        {
            id: 'finalizing-preview',
            label: 'Loading Application',
            description: 'Waiting for your optimized application to fully load and render'
        }
    ];

    // Initialize progress tracker if sessionId is provided
    let progressTracker: ProgressTracker | null = null;
    if (sessionId) {
        progressTracker = new ProgressTracker(sessionId, steps);
    }

    try {
        // Step 1: Run the Benchify fixer
        progressTracker?.startStep('running-fixer');
        const fixerResult = await benchify.fixer.run({
            files: files.map((file) => ({
                path: file.path,
                contents: file.contents
            })),
            fixes: {
                stringLiterals: true,
            }
        });

        console.log('🔧 Benchify fixer data:', JSON.stringify(fixerResult, null, 2));

        // Use the correct path based on the actual Benchify response structure
        let repairedFiles: Array<{ path: string; contents: string }>;

        const fixerData = fixerResult as FixerRunResponse;
        const allFilesFormat = fixerData?.data?.suggested_changes as { all_files?: Array<{ path: string; contents: string }> };
        if (allFilesFormat?.all_files) {
            repairedFiles = allFilesFormat.all_files;
        } else {
            // If the fixer doesn't return the expected structure, return original files
            console.warn('Unexpected fixer response structure, returning original files');
            repairedFiles = files;
        }

        progressTracker?.completeStep('running-fixer');

        // Step 2-5: Create or update sandbox with detailed progress tracking
        let sandboxResult;
        if (existingSandboxId) {
            // Update existing sandbox with optimized files
            console.log(`🔄 Updating existing sandbox: ${existingSandboxId}`);
            sandboxResult = await updateSandboxFiles({
                sandboxId: existingSandboxId,
                files: repairedFiles,
                progressTracker: progressTracker
            });
        } else {
            // Create new sandbox
            console.log('🆕 Creating new sandbox');
            progressTracker?.startStep('creating-sandbox');
            sandboxResult = await createSandbox({ files: repairedFiles, progressTracker: progressTracker });
        }

        // Return the results in the same format as generate-app
        return {
            originalFiles: files,
            repairedFiles: sandboxResult.allFiles,
            buildOutput: existingSandboxId
                ? `Sandbox updated with optimized code, ID: ${sandboxResult.sbxId}`
                : `Sandbox created with template: ${sandboxResult.template}, ID: ${sandboxResult.sbxId}`,
            previewUrl: sandboxResult.url,
            sandboxId: sandboxResult.sbxId,
            buildErrors: sandboxResult.buildErrors,
            hasErrors: sandboxResult.hasErrors,
            sessionId,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Mark current step as failed if we have a progress tracker
        if (progressTracker) {
            const currentState = progressTracker.getState();
            if (currentState && currentState.currentStepIndex >= 0) {
                const currentStep = currentState.steps[currentState.currentStepIndex];
                progressTracker.errorStep(currentStep.id, errorMessage);
            }
        }

        return {
            error: 'Failed to run Benchify fixer',
            message: errorMessage,
            sessionId
        };
    }
} 