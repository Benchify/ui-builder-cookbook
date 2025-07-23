'use server';

import { generateAppCode } from '@/lib/openai';
import { createSandbox } from '@/lib/e2b';
import { Benchify } from 'benchify';
import { ProgressTracker } from '@/lib/progress-tracker';

const benchify = new Benchify({
    apiKey: process.env.BENCHIFY_API_KEY,
});

type GenerateAppInput = {
    type: string;
    description: string;
    preview: boolean;
    requirements?: string;
    existingFiles?: Array<{ path: string; contents: string }>;
    editInstruction?: string;
    useBuggyCode?: boolean;
    useFixer?: boolean;
    sessionId?: string;
};

export type GenerateAppResult = {
    originalFiles?: Array<{ path: string; contents: string }>;
    repairedFiles?: Array<{ path: string; contents: string }>;
    buildOutput: string;
    previewUrl: string;
    sandboxId?: string;
    buildErrors?: Array<{
        type: 'typescript' | 'build' | 'runtime';
        message: string;
        file?: string;
        line?: number;
        column?: number;
    }>;
    hasErrors?: boolean;
    editInstruction?: string;
    sessionId?: string;
} | {
    error: string;
    message: string;
    sessionId?: string;
};

export async function generateApp(input: GenerateAppInput): Promise<GenerateAppResult> {
    const { description, existingFiles, editInstruction, useBuggyCode, useFixer, sessionId } = input;

    // Define the actual steps that will happen
    const steps = [
        {
            id: 'generating-code',
            label: 'Generating Code',
            description: 'Creating components and functionality with AI assistance'
        },
        ...(useFixer ? [{
            id: 'fixing-code',
            label: 'Optimizing Code',
            description: 'Running Benchify fixer to optimize and fix potential issues'
        }] : []),
        {
            id: 'creating-sandbox',
            label: 'Creating Sandbox',
            description: 'Setting up development environment'
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
            description: 'Waiting for your application to fully load and render'
        }
    ];

    // Initialize progress tracker if sessionId is provided
    let progressTracker: ProgressTracker | null = null;
    if (sessionId) {
        console.log('🔄 Creating progress tracker for session:', sessionId);
        progressTracker = new ProgressTracker(sessionId, steps);
        console.log('📊 Progress tracker created with steps:', steps.map(s => s.label));
    } else {
        console.log('⚠️ No sessionId provided, skipping progress tracking');
    }

    try {
        // Step 1: Generate code
        progressTracker?.startStep('generating-code');
        const filesToSandbox = await generateAppCode(description, existingFiles, editInstruction, useBuggyCode);
        progressTracker?.completeStep('generating-code');

        let repairedFiles = filesToSandbox;

        console.log("Files to sandbox", filesToSandbox);

        // Step 2: Run fixer if requested
        if (useFixer) {
            try {
                progressTracker?.startStep('fixing-code');
                console.log("Trying fixer")
                const fixerResult = await benchify.fixer.run({
                    files: filesToSandbox.map((file: { path: string; contents: string }) => ({
                        path: file.path,
                        contents: file.contents
                    })),
                    fixes: {
                        stringLiterals: true,
                    }
                });

                const fixedFiles = (fixerResult as any).data?.suggested_changes?.all_files;
                if (fixedFiles && Array.isArray(fixedFiles)) {
                    repairedFiles = fixedFiles;
                }

                console.log('🔧 Benchify fixer data:', repairedFiles);
                progressTracker?.completeStep('fixing-code');

            } catch (error) {
                console.error('Fixer failed:', error);
                progressTracker?.errorStep('fixing-code', 'Fixer optimization failed, continuing with original code');
                // Continue with original files if fixer fails
            }
        }

        // Step 3: Create sandbox with progress tracking
        progressTracker?.startStep('creating-sandbox');
        const sandboxResult = await createSandbox({
            files: repairedFiles,
            progressTracker: progressTracker
        });
        progressTracker?.completeStep('finalizing-preview');

        // Return the results
        return {
            originalFiles: filesToSandbox,
            repairedFiles: sandboxResult.allFiles,
            buildOutput: `Sandbox created with template: ${sandboxResult.template}, ID: ${sandboxResult.sbxId}`,
            previewUrl: sandboxResult.url,
            sandboxId: sandboxResult.sbxId,
            buildErrors: sandboxResult.buildErrors,
            hasErrors: sandboxResult.hasErrors,
            sessionId,
            ...(editInstruction && { editInstruction }),
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
            error: 'Failed to generate app',
            message: errorMessage,
            sessionId
        };
    }
} 