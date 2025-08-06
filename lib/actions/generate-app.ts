'use server';

import { generateAppCode } from '@/lib/openai';
import { createSandbox, updateSandboxFiles } from '@/lib/e2b';
import { Benchify } from 'benchify';
import { ProgressTracker } from '@/lib/progress-tracker';

const benchify = new Benchify({
    baseURL: 'http://localhost:8082',
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
    existingSandboxId?: string; // Add support for reusing existing sandbox
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
    const { description, existingFiles, editInstruction, useBuggyCode, useFixer, sessionId, existingSandboxId } = input;

    // Detect if this is a repair operation (fixing build errors)
    const isRepairMode = existingSandboxId && editInstruction && editInstruction.includes('Fix the following build errors');

    // Define the actual steps that will happen (different for new vs existing vs repair)
    const steps = existingSandboxId ? [
        {
            id: 'generating-code',
            label: isRepairMode ? 'Generating Patch' : 'Generating Code',
            description: isRepairMode
                ? 'Attempting to generate patch with AI to fix build errors'
                : 'Creating components and functionality with AI assistance'
        },
        ...(useFixer ? [{
            id: 'fixing-code',
            label: 'Optimizing Code',
            description: 'Running Benchify fixer to optimize and fix potential issues'
        }] : []),
        {
            id: 'updating-files',
            label: 'Updating Files',
            description: 'Applying generated code to your existing sandbox'
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
            description: 'Ensuring the updated code is working correctly'
        },
        {
            id: 'finalizing-preview',
            label: 'Finalizing',
            description: 'Your updated application is ready!'
        }
    ] : [
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
                console.log("Trying fixer")
                progressTracker?.startStep('fixing-code');
                repairedFiles = await benchify.runFixer(filesToSandbox, {
                    fixes: {
                        stringLiterals: true,
                    }
                });
                progressTracker?.completeStep('fixing-code');

                console.log('🔧 Benchify fixer data:', repairedFiles);

            } catch (error) {
                console.error('Fixer failed:', error);
                progressTracker?.errorStep('fixing-code', 'Fixer optimization failed, continuing with original code');
                // Continue with original files if fixer fails
            }
        }

        // Step 3: Create or update sandbox with progress tracking
        let sandboxResult;
        if (existingSandboxId) {
            // Update existing sandbox with generated/fixed files
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
            sandboxResult = await createSandbox({
                files: repairedFiles,
                progressTracker: progressTracker
            });
        }

        progressTracker?.completeStep('finalizing-preview');

        // Return the results
        return {
            originalFiles: filesToSandbox,
            repairedFiles: sandboxResult.allFiles,
            buildOutput: existingSandboxId
                ? `Sandbox updated with AI-generated code, ID: ${sandboxResult.sbxId}`
                : `Sandbox created with template: ${sandboxResult.template}, ID: ${sandboxResult.sbxId}`,
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