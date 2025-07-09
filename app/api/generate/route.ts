// app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateAppCode } from '@/lib/openai';
import { createSandbox } from '@/lib/e2b';
import { componentSchema } from '@/lib/schemas';
import { Benchify } from 'benchify';
import { applyPatch } from 'diff';
import { z } from 'zod';
import { benchifyFileSchema } from '@/lib/schemas';

const benchify = new Benchify({
    apiKey: process.env.BENCHIFY_API_KEY,
});

// Extended schema to support editing
const extendedComponentSchema = componentSchema.extend({
    existingFiles: benchifyFileSchema.optional(),
    editInstruction: z.string().optional(),
    useBuggyCode: z.boolean().optional().default(false),
    useFixer: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
    try {

        // Validate the request
        const validation = await validateRequest(request);

        if (!validation.success) {
            return validation.error;
        }

        const { description, existingFiles, editInstruction, useBuggyCode, useFixer } = validation.data;

        // Process the app request using centralized logic
        const filesToSandbox = await generateAppCode(description, existingFiles, editInstruction, useBuggyCode);

        let repairedFiles = filesToSandbox;

        // Repair the generated code using Benchify's API if requested
        if (useFixer) {
            try {
                console.log("Trying fixer")
                const { data } = await benchify.fixer.run({
                    files: filesToSandbox.map((file: { path: string; content: string }) => ({
                        path: file.path,
                        contents: file.content
                    })),
                    fixes: {
                        css: false,
                        imports: false,
                        stringLiterals: true,
                        tsSuggestions: false
                    }
                });

                console.log('🔧 Benchify fixer data:', data);

                if (data) {
                    const { success, diff } = data;

                    if (success && diff) {
                        repairedFiles = filesToSandbox.map((file: { path: string; content: string }) => {
                            const patchResult = applyPatch(file.content, diff);
                            return {
                                ...file,
                                content: typeof patchResult === 'string' ? patchResult : file.content
                            };
                        });
                    }
                }
            } catch (error) {
                // Continue with original files if fixer fails
            }
        }

        const sandboxResult = await createSandbox({ files: repairedFiles });

        // Return the results to the client
        return NextResponse.json({
            originalFiles: filesToSandbox,
            repairedFiles: sandboxResult.allFiles, // Use the allFiles from the sandbox
            buildOutput: `Sandbox created with template: ${sandboxResult.template}, ID: ${sandboxResult.sbxId}`,
            previewUrl: sandboxResult.url,
            buildErrors: sandboxResult.buildErrors,
            hasErrors: sandboxResult.hasErrors,
            ...(editInstruction && { editInstruction }),
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Failed to generate app',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}


async function validateRequest(request: NextRequest) {
    const body = await request.json();
    const validationResult = extendedComponentSchema.safeParse(body);

    if (!validationResult.success) {
        return {
            success: false as const,
            error: NextResponse.json(
                { error: 'Invalid request format', details: validationResult.error.format() },
                { status: 400 }
            )
        };
    }

    return {
        success: true as const,
        data: validationResult.data
    };
}
