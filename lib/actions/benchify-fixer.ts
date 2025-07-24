'use server';

import { Benchify } from 'benchify';
import { createSandbox } from '@/lib/e2b';
import { FixerRunResponse } from 'benchify/resources/fixer.mjs';

const benchify = new Benchify({
    apiKey: process.env.BENCHIFY_API_KEY,
});

type BenchifyFixerInput = {
    files: Array<{ path: string; contents: string }>;
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