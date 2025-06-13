// app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateApp } from '@/lib/openai';
import { createSandbox } from '@/lib/e2b';
import { componentSchema } from '@/lib/schemas';
import { Benchify } from 'benchify';
import { applyPatch } from 'diff';

const benchify = new Benchify({
    apiKey: process.env.BENCHIFY_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate the request using Zod schema
        const validationResult = componentSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Invalid request format', details: validationResult.error.format() },
                { status: 400 }
            );
        }

        const { description } = validationResult.data;

        // Generate the Vue app using OpenAI
        const generatedFiles = await generateApp(description);

        // Repair the generated code using Benchify's API
        // const { data } = await benchify.fixer.run({
        //     files: generatedFiles.map(file => ({
        //         path: file.path,
        //         contents: file.content
        //     }))
        // });

        let repairedFiles = generatedFiles;
        // if (data) {
        //     const { success, diff } = data;

        //     if (success && diff) {
        //         repairedFiles = generatedFiles.map(file => {
        //             const patchResult = applyPatch(file.content, diff);
        //             return {
        //                 ...file,
        //                 content: typeof patchResult === 'string' ? patchResult : file.content
        //             };
        //         });
        //     }
        // }

        const { sbxId, template, url, allFiles } = await createSandbox({ files: repairedFiles });

        // Return the results to the client
        return NextResponse.json({
            originalFiles: generatedFiles,
            repairedFiles: allFiles, // Use the allFiles from the sandbox
            buildOutput: `Sandbox created with template: ${template}, ID: ${sbxId}`,
            previewUrl: url,
        });
    } catch (error) {
        console.error('Error generating app:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate app',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}