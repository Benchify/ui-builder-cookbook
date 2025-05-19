import { Sandbox } from '@e2b/code-interpreter';
import { benchifyFileSchema } from './schemas';
import { z } from 'zod';

const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
    throw new Error('E2B_API_KEY is not set');
}

type FileEntry = {
    path: string;
    content: string;
};

export async function createSandbox({ files }: { files: z.infer<typeof benchifyFileSchema> }) {
    // Create sandbox from the improved template
    const sandbox = await Sandbox.create('vite-support', { apiKey: E2B_API_KEY });
    console.log(`Sandbox created: ${sandbox.sandboxId}`);

    // Check if the user provided CSS files with old Tailwind syntax
    const cssFiles = files.filter(file => file.path.endsWith('.css'));
    for (const cssFile of cssFiles) {
        // If the file contains @tailwind directives, replace with the new v4 syntax
        if (cssFile.content.includes('@tailwind')) {
            console.log(`Updating Tailwind v4 syntax in ${cssFile.path}`);
            cssFile.content = '@import "tailwindcss";';
        }
    }

    // Check if the user provided a postcss.config.js and if it needs to be updated for Tailwind v4
    const postcssFile = files.find(file => file.path === 'postcss.config.js');
    if (postcssFile && postcssFile.content.includes('tailwindcss')) {
        // Fix postcss config to use @tailwindcss/postcss
        const fixedContent = postcssFile.content.replace(/['"]tailwindcss['"]/, '"@tailwindcss/postcss"');
        // Update the file with fixed content
        postcssFile.content = fixedContent;
    }

    // Write files directly to the working directory (/app)
    const filesToWrite = files.map(file => ({
        path: `/app/${file.path}`,
        data: file.content
    }));

    await sandbox.files.write(filesToWrite);

    // Get all files from the sandbox recursively
    const allFiles = await fetchAllSandboxFiles(sandbox);
    console.log(`Found ${allFiles.length} files in sandbox`);
    console.log("allFiles", allFiles);

    const previewUrl = `https://${sandbox.getHost(5173)}`;

    return {
        sbxId: sandbox.sandboxId,
        template: 'vite-support',
        url: previewUrl,
        allFiles: allFiles
    };
}

/**
 * Recursively fetches all files from the sandbox and returns them in benchifyFileSchema format
 */
async function fetchAllSandboxFiles(sandbox: Sandbox): Promise<z.infer<typeof benchifyFileSchema>> {
    const result: FileEntry[] = [];

    // Start the recursive traversal from /app
    await listFilesRecursively(sandbox, '/app', result);

    return result;
}

/**
 * Recursively lists files in a directory and reads their content
 */
async function listFilesRecursively(
    sandbox: Sandbox,
    dirPath: string,
    result: FileEntry[]
): Promise<void> {
    try {
        // List all files and directories in the current path
        const items = await sandbox.files.list(dirPath);

        // Process each item
        for (const item of items) {
            // Skip node_modules and hidden files
            if (item.name === 'node_modules' || item.name.startsWith('.')) {
                continue;
            }

            const fullPath = item.path;

            if (item.type === 'dir') {
                // Recursively process directories
                await listFilesRecursively(sandbox, fullPath, result);
            } else {
                try {
                    // Skip binary files
                    if (
                        item.name.endsWith('.jpg') ||
                        item.name.endsWith('.png') ||
                        item.name.endsWith('.gif') ||
                        item.name.endsWith('.ico') ||
                        item.name.endsWith('.woff') ||
                        item.name.endsWith('.woff2')
                    ) {
                        continue;
                    }

                    // Read the file content
                    const content = await sandbox.files.read(fullPath);

                    // Add file to result array with normalized path (without /app/ prefix)
                    result.push({
                        path: fullPath.replace('/app/', ''),
                        content: content.toString()
                    });
                } catch (error) {
                    console.error(`Error reading file ${fullPath}:`, error);
                }
            }
        }
    } catch (error) {
        console.error(`Error listing directory ${dirPath}:`, error);
    }
}

