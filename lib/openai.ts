// lib/openai.ts
import { streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { REACT_APP_SYSTEM_PROMPT, REACT_APP_USER_PROMPT, TEMPERATURE, MODEL, EDIT_SYSTEM_PROMPT, createEditUserPrompt } from './prompts';
import { benchifyFileSchema } from './schemas';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
}

// Schema for a single file
const fileSchema = z.object({
    path: z.string(),
    content: z.string()
});

// Generate a new application using AI SDK
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
                { role: 'system', content: REACT_APP_SYSTEM_PROMPT },
                { role: 'user', content: REACT_APP_USER_PROMPT(description) }
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

// Edit existing application using AI SDK
export async function editApp(
    existingFiles: z.infer<typeof benchifyFileSchema>,
    editInstruction: string,
): Promise<Array<{ path: string; content: string }>> {
    console.log("Editing app with instruction: ", editInstruction);

    try {
        const { elementStream } = streamObject({
            model: openai('gpt-4o-mini'),
            output: 'array',
            schema: fileSchema,
            temperature: 0.3, // Lower temperature for more consistent edits
            messages: [
                { role: 'system', content: EDIT_SYSTEM_PROMPT },
                { role: 'user', content: createEditUserPrompt(existingFiles, editInstruction) }
            ]
        });

        const updatedFiles = [];
        for await (const file of elementStream) {
            updatedFiles.push(file);
        }

        if (!updatedFiles.length) {
            throw new Error("Failed to generate updated files - received empty response");
        }

        console.log("Generated updated files: ", updatedFiles);

        return updatedFiles;
    } catch (error) {
        console.error('Error editing app:', error);
        throw error;
    }
}