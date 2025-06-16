// app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processAppRequest } from '@/lib/openai';
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
        console.log('🚀 API route started');
        const body = await request.json();

        // Validate the request using extended schema
        const validationResult = extendedComponentSchema.safeParse(body);

        if (!validationResult.success) {
            console.log('❌ Validation failed:', validationResult.error.format());
            return NextResponse.json(
                { error: 'Invalid request format', details: validationResult.error.format() },
                { status: 400 }
            );
        }

        const { description, existingFiles, editInstruction, useBuggyCode, useFixer } = validationResult.data;

        console.log('✅ Validation passed, API Request:', {
            isEdit: !!(existingFiles && editInstruction),
            filesCount: existingFiles?.length || 0,
            editInstruction: editInstruction || 'none',
            description: description || 'none',
            useBuggyCode,
            useFixer
        });

        // Process the app request using centralized logic
        const filesToSandbox = await processAppRequest(description, existingFiles, editInstruction, useBuggyCode);

        console.log('📦 Files ready for sandbox:', filesToSandbox.length);

        let repairedFiles = filesToSandbox;

        // Repair the generated code using Benchify's API if requested
        if (useFixer) {
            console.log('🔧 Running Benchify fixer...');
            try {
                const { data } = await benchify.fixer.run({
                    files: filesToSandbox.map((file: { path: string; content: string }) => ({
                        path: file.path,
                        contents: file.content
                    }))
                });

                if (data) {
                    const { success, diff } = data;

                    if (success && diff) {
                        console.log('✅ Fixer applied successfully');
                        repairedFiles = filesToSandbox.map((file: { path: string; content: string }) => {
                            const patchResult = applyPatch(file.content, diff);
                            return {
                                ...file,
                                content: typeof patchResult === 'string' ? patchResult : file.content
                            };
                        });
                    } else {
                        console.log('⚠️ Fixer ran but no fixes were applied');
                    }
                } else {
                    console.log('⚠️ Fixer returned no data');
                }
            } catch (error) {
                console.error('❌ Error running fixer:', error);
                // Continue with original files if fixer fails
            }
        } else {
            console.log('⏭️ Skipping fixer as requested');
        }

        console.log('🏗️  Creating sandbox...');
        const sandboxResult = await createSandbox({ files: repairedFiles });
        console.log('✅ Sandbox created successfully');

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
        console.error('💥 Error in API route:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate app',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}