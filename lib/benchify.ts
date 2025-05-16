// lib/benchify.ts
import {
    benchifyRequestSchema,
    benchifyFileSchema,
    type BenchifyFixerResponse
} from './schemas';
import { applyPatch } from 'diff';
import { z } from 'zod';

const BENCHIFY_API_KEY = process.env.BENCHIFY_API_KEY;
const BENCHIFY_API_URL = 'https://api.benchify.com/v1';

if (!BENCHIFY_API_KEY) {
    throw new Error('BENCHIFY_API_KEY is not set');
}

// Repair code using Benchify Fixer API
export async function repairCode(files: z.infer<typeof benchifyFileSchema>): Promise<{ repairedFiles: z.infer<typeof benchifyFileSchema>, buildOutput: string }> {
    try {
        // Simple build command to verify syntax
        const buildCmd = "npm run dev";

        // Validate request against Benchify API schema
        const requestData = benchifyRequestSchema.parse({
            files,
            jobName: "ui-component-fix",
            buildCmd
        });

        console.log('Sending request to Benchify:', {
            url: `${BENCHIFY_API_URL}/fixer`,
            filesCount: files.length,
            jobName: requestData.jobName
        });

        // Send request to Benchify API
        const response = await fetch(`${BENCHIFY_API_URL}/fixer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BENCHIFY_API_KEY}`,
            },
            body: JSON.stringify(requestData),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error('Benchify API Error:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                errorData,
                requestData: {
                    filesCount: files.length,
                    jobName: requestData.jobName,
                    buildCmd: requestData.buildCmd
                }
            });
            throw new Error(`Benchify API error: ${response.statusText}`);
        }

        // Parse the response
        const result = await response.json() as BenchifyFixerResponse;
        console.log('Benchify API Response:', {
            buildStatus: result.build_status,
            hasDiff: !!result.diff,
            buildOutputLength: result.build_output?.length || 0
        });

        // Parse and apply patches to each file if diff exists
        const parsedFiles = benchifyFileSchema.parse(files);
        const repairedFiles = parsedFiles.map(file => {
            if (result.diff) {
                const patchResult = applyPatch(file.contents, result.diff);
                return {
                    path: file.path,
                    content: typeof patchResult === 'string' ? patchResult : file.content
                };
            }
            return file;
        });

        return { repairedFiles, buildOutput: result.build_output };
    } catch (error) {
        if (error instanceof Error) {
            console.error('Benchify Processing Error:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                cause: error.cause
            });
        } else {
            console.error('Unknown Benchify Error:', error);
        }
        throw error;
    }
}