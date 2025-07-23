import { Sandbox } from '@e2b/code-interpreter';
import { z } from 'zod';
import { benchifyFileSchema } from './schemas';

export type FileEntry = {
    path: string;
    contents: string;
};

// List of boilerplate files to filter out from results
export const BOILERPLATE_FILES = [
    'README.md',
    'eslint.config.js',
    'package-lock.json',
];

// Paths that should be filtered
export const BOILERPLATE_PATHS = [
    'node_modules',
    'public/vite.svg',
    'src/assets/react.svg',
    '.vscode',
    '.git'
];

// Essential files that should always be included
export const ESSENTIAL_FILES = [
    'package.json',
    'vite.config.ts',
    'tsconfig.json',
    'postcss.config.js',
    'tailwind.config.js',
    'src/index.css',
    'src/main.tsx',
    'index.html'
];

/**
 * Recursively fetches all files from the sandbox and returns them in benchifyFileSchema format
 */
export async function fetchAllSandboxFiles(sandbox: Sandbox): Promise<z.infer<typeof benchifyFileSchema>> {
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
            // Get normalized path for filtering (without /app/ prefix)
            const normalizedPath = item.path.replace('/app/', '');
            const fullPath = item.path;

            // Skip node_modules and hidden files
            if (item.name === 'node_modules' || item.name.startsWith('.')) {
                continue;
            }

            // Skip files that are in the boilerplate list
            if (BOILERPLATE_FILES.includes(normalizedPath)) {
                continue;
            }

            // Skip files that match boilerplate paths
            let shouldSkip = false;
            for (const boilerplatePath of BOILERPLATE_PATHS) {
                if (normalizedPath.startsWith(boilerplatePath)) {
                    shouldSkip = true;
                    break;
                }
            }
            if (shouldSkip) {
                continue;
            }

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
                    const contentStr = content.toString();

                    // Skip Vite default App
                    if (normalizedPath === 'src/App.tsx' && contentStr.includes('Your App')) {
                        continue;
                    }

                    // Add file to result array with normalized path
                    result.push({
                        path: normalizedPath,
                        contents: contentStr
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