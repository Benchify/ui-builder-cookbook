// lib/openai.ts
import { streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { REACT_APP_SYSTEM_PROMPT, REACT_APP_USER_PROMPT, TEMPERATURE, MODEL, EDIT_SYSTEM_PROMPT, createEditUserPrompt } from './prompts';
import { benchifyFileSchema } from './schemas';
import { readFileSync } from 'fs';
import { join } from 'path';


function readBuggyFile(filename: string): string {
  const filePath = join(process.cwd(), 'lib', 'buggy-code-files', filename);
  return readFileSync(filePath, 'utf8');
}
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

// Schema for a single file
const fileSchema = z.object({
  path: z.string(),
  contents: z.string()
});

// Generate a new application using AI SDK
export async function createNewApp(
  description: string,
): Promise<Array<{ path: string; contents: string }>> {
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

// Helper function to merge updated files with existing files
function mergeFiles(existingFiles: z.infer<typeof benchifyFileSchema>, updatedFiles: z.infer<typeof benchifyFileSchema>): z.infer<typeof benchifyFileSchema> {
  const existingMap = new Map(existingFiles.map(file => [file.path, file]));

  // Apply updates
  updatedFiles.forEach(updatedFile => {
    existingMap.set(updatedFile.path, updatedFile);
  });

  return Array.from(existingMap.values());
}

// Edit existing application using AI SDK and merge results
export async function editApp(
  existingFiles: z.infer<typeof benchifyFileSchema>,
  editInstruction: string,
): Promise<z.infer<typeof benchifyFileSchema>> {
  console.log("Editing app with instruction: ", editInstruction);
  console.log('Existing files:', existingFiles.map(f => ({ path: f.path, contentLength: f.contents.length })));

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

    console.log("Generated updated files: ", updatedFiles.map(f => ({ path: f.path, contentLength: f.contents.length })));

    // Merge the updated files with the existing files
    const mergedFiles = mergeFiles(existingFiles, updatedFiles);
    console.log('Final merged files:', mergedFiles.map(f => ({ path: f.path, contentLength: f.contents.length })));

    return mergedFiles;
  } catch (error) {
    console.error('Error editing app:', error);
    throw error;
  }
}

// Main function to handle both generation and editing
export async function generateAppCode(
  description: string,
  existingFiles?: z.infer<typeof benchifyFileSchema>,
  editInstruction?: string,
  useBuggyCode: boolean = false
): Promise<z.infer<typeof benchifyFileSchema>> {
  // Determine if this is an edit request or new generation
  if (existingFiles && editInstruction) {
    // Edit existing code (including error fixes)
    console.log('📝 Processing edit request...');
    return await editApp(existingFiles, editInstruction);
  } else {
    // Generate new app
    console.log('🆕 Processing new generation request...');
    if (useBuggyCode) {
      console.log('🐛 Using buggy code as requested');
      // Return the buggy code in the expected format from JSON file
      try {
        return [{
          "path": "src/StringIssues.tsx",
          "contents": readBuggyFile('string-issues.txt')
        }]
      } catch (error) {
        console.error('Error reading buggy code from JSON file:', error);
        // Fallback to default buggy code if file reading fails
        const fallbackBuggyCode = [{
          path: "src/App.tsx",
          contents: `console.log('Hello World')`
        }];
        return fallbackBuggyCode;
      }
    } else {
      console.log('🤖 Calling AI to generate app...');
      return await createNewApp(description);
    }
  }
}