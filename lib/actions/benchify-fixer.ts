'use server';

import { Benchify } from 'benchify';
import { createSandbox } from '@/lib/e2b';

const benchify = new Benchify({
    apiKey: process.env.BENCHIFY_API_KEY,
});

type BenchifyFixerInput = {
    files: Array<{ path: string; content: string }>;
};

export type BenchifyFixerResult = {
    originalFiles: Array<{ path: string; content: string }>;
    repairedFiles: Array<{ path: string; content: string }>;
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
} | {
    error: string;
    message: string;
};

export async function runBenchifyFixer(input: BenchifyFixerInput): Promise<BenchifyFixerResult> {
    try {
        const { files } = input;

        // Run the Benchify fixer
        const fixerResult = await benchify.fixer.run({
            files: files.map((file) => ({
                path: file.path,
                contents: file.content
            })),
            fixes: {
                stringLiterals: true,
            }
        });

        console.log('🔧 Benchify fixer data:', JSON.stringify(fixerResult, null, 2));

        // Convert the result back to the expected format
        // Use the correct path based on the actual Benchify response structure
        let repairedFiles: Array<{ path: string; content: string }>;

        const fixerData = fixerResult as any;
        if (fixerData?.data?.suggested_changes?.all_files) {
            repairedFiles = fixerData.data.suggested_changes.all_files.map((file: any) => ({
                path: file.path,
                content: file.contents
            }));
        } else {
            // If the fixer doesn't return the expected structure, return original files
            console.warn('Unexpected fixer response structure, returning original files');
            repairedFiles = files;
        }

        // Create sandbox with the repaired files
        const sandboxResult = await createSandbox({ files: repairedFiles });

        // Return the results in the same format as generate-app
        return {
            originalFiles: files,
            repairedFiles: sandboxResult.allFiles, // Use the allFiles from the sandbox
            buildOutput: `Sandbox created with template: ${sandboxResult.template}, ID: ${sandboxResult.sbxId}`,
            previewUrl: sandboxResult.url,
            buildErrors: sandboxResult.buildErrors,
            hasErrors: sandboxResult.hasErrors,
        };
    } catch (error) {
        return {
            error: 'Failed to run Benchify fixer',
            message: error instanceof Error ? error.message : String(error)
        };
    }
} 