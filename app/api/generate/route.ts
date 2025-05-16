// app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateApp } from '@/lib/openai';
import { repairCode } from '@/lib/benchify';
import { createSandbox } from '@/lib/e2b';
import { componentSchema } from '@/lib/schemas';
import { benchifyFileSchema } from '@/lib/schemas';

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

        // // Parse through schema before passing to repair
        const validatedFiles = benchifyFileSchema.parse(generatedFiles);

        // // Repair the generated code using Benchify's API
        // const { repairedFiles, buildOutput } = await repairCode(validatedFiles);

        const { sbxId, template, url } = await createSandbox({ files: generatedFiles });

        console.log("Preview URL: ", url);

        // Return the results to the client
        return NextResponse.json({
            originalFiles: generatedFiles,
            // repairedFiles: repairedFiles,
            // buildOutput: buildOutput,
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