'use server';

import { generateAppCode } from '@/lib/openai';
import { createSandbox } from '@/lib/e2b';
import { Benchify } from 'benchify';

const benchify = new Benchify({
    apiKey: process.env.BENCHIFY_API_KEY,
});

type GenerateAppInput = {
    type: string;
    description: string;
    preview: boolean;
    requirements?: string;
    existingFiles?: Array<{ path: string; content: string }>;
    editInstruction?: string;
    useBuggyCode?: boolean;
    useFixer?: boolean;
};

export type GenerateAppResult = {
    originalFiles?: Array<{ path: string; content: string }>;
    repairedFiles?: Array<{ path: string; content: string }>;
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
    editInstruction?: string;
} | {
    error: string;
    message: string;
};

export async function generateApp(input: GenerateAppInput): Promise<GenerateAppResult> {
    try {
        const { description, existingFiles, editInstruction, useBuggyCode, useFixer } = input;

        // Process the app request using centralized logic
        const filesToSandbox = await generateAppCode(description, existingFiles, editInstruction, useBuggyCode);

        let repairedFiles = filesToSandbox;

        console.log("Files to sandbox", filesToSandbox);

        // Repair the generated code using Benchify's API if requested
        if (useFixer) {
            try {
                console.log("Trying fixer")
                const fixerResult = await benchify.fixer.run({
                    files: filesToSandbox.map((file: { path: string; content: string }) => ({
                        path: file.path,
                        contents: file.content
                    })),
                    fixes: {
                        stringLiterals: true,
                    }
                });

                console.log('🔧 Benchify fixer data:', JSON.stringify(fixerResult, null, 2));

            } catch (error) {
                // Continue with original files if fixer fails
                console.error('Fixer failed:', error);
            }
        }

        const sandboxResult = await createSandbox({ files: repairedFiles });

        // Return the results
        return {
            originalFiles: filesToSandbox,
            repairedFiles: sandboxResult.allFiles, // Use the allFiles from the sandbox
            buildOutput: `Sandbox created with template: ${sandboxResult.template}, ID: ${sandboxResult.sbxId}`,
            previewUrl: sandboxResult.url,
            buildErrors: sandboxResult.buildErrors,
            hasErrors: sandboxResult.hasErrors,
            ...(editInstruction && { editInstruction }),
        };
    } catch (error) {
        return {
            error: 'Failed to generate app',
            message: error instanceof Error ? error.message : String(error)
        };
    }
} 