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
    existingFiles?: Array<{ path: string; contents: string }>;
    editInstruction?: string;
    useBuggyCode?: boolean;
    useFixer?: boolean;
};

export type GenerateAppResult = {
    originalFiles?: Array<{ path: string; contents: string }>;
    repairedFiles?: Array<{ path: string; contents: string }>;
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
                    // Use the fixer files directly since they already have the correct format
                    repairedFiles = fixedFiles;
                }

                console.log('🔧 Benchify fixer data:', repairedFiles);

            } catch (error) {
                // Continue with original files if fixer fails
                console.error('Fixer failed:', error);
            }
        }

        const sandboxResult = await createSandbox({ files: repairedFiles });

        console.log("url", sandboxResult.url);

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