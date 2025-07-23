'use server';

import { Benchify } from 'benchify';
import { createSandbox } from '@/lib/e2b';
import { FixerRunResponse } from 'benchify/resources/fixer.mjs';
import { ProgressTracker } from '@/lib/progress-tracker';

const benchify = new Benchify({
    apiKey: process.env.BENCHIFY_API_KEY,
});

type BenchifyFixerInput = {
    files: Array<{ path: string; contents: string }>;
    sessionId?: string;
};

export type BenchifyFixerResult = {
    originalFiles: Array<{ path: string; contents: string }>;
    repairedFiles: Array<{ path: string; contents: string }>;
    buildOutput: string;
    previewUrl: string;
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
    const { files, sessionId } = input;

    // Define the steps for the fixer process
    const steps = [
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

        // Step 2-5: Create sandbox with detailed progress tracking
        progressTracker?.startStep('creating-sandbox');
        const sandboxResult = await createSandbox({ files: repairedFiles, progressTracker: progressTracker });

        // Return the results in the same format as generate-app
        return {
            originalFiles: files,
            repairedFiles: sandboxResult.allFiles,
            buildOutput: `Sandbox created with template: ${sandboxResult.template}, ID: ${sandboxResult.sbxId}`,
            previewUrl: sandboxResult.url,
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