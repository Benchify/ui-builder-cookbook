// lib/openai.ts
import { streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { VUE_APP_SYSTEM_PROMPT, VUE_APP_USER_PROMPT, TEMPERATURE, MODEL } from './prompts';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
}

// Schema for a single file
const fileSchema = z.object({
    path: z.string(),
    content: z.string()
});

// Generate a Vue application using AI SDK
export async function generateApp(
    description: string,
): Promise<Array<{ path: string; content: string }>> {
    console.log("Creating app with description: ", description);

    try {
        const { elementStream } = streamObject({
            model: openai(MODEL),
            output: 'array',
            schema: fileSchema,
            temperature: TEMPERATURE,
            messages: [
                { role: 'system', content: VUE_APP_SYSTEM_PROMPT },
                { role: 'user', content: VUE_APP_USER_PROMPT(description) }
            ]
        });

        const files = [];
        for await (const file of elementStream) {
            files.push(file);
        }

        if (!files.length) {
            throw new Error("Failed to generate files - received empty response");
        }

        console.log("Generated files: ", files);

        return files;
    } catch (error) {
        console.error('Error generating app:', error);
        throw error;
    }
}