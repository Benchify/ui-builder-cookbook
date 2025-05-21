import { Sandbox } from '@e2b/code-interpreter';
import { benchifyFileSchema } from './schemas';
import { z } from 'zod';
import { fetchAllSandboxFiles } from './file-filter';
import { applyTransformations } from './sandbox-helpers';

const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
    throw new Error('E2B_API_KEY is not set');
}


export async function createSandbox({ files }: { files: z.infer<typeof benchifyFileSchema> }) {
    // Create sandbox from the improved template
    const sandbox = await Sandbox.create('vite-support', { apiKey: E2B_API_KEY });
    console.log(`Sandbox created: ${sandbox.sandboxId}`);

    // Apply transformations (including Tailwind v4 syntax)
    const transformedFiles = applyTransformations(files);

    // Write files directly to the working directory (/app)
    const filesToWrite = transformedFiles.map(file => ({
        path: `/app/${file.path}`,
        data: file.content
    }));

    await sandbox.files.write(filesToWrite);

    // Get all files from the sandbox using the improved filter logic
    const allFiles = await fetchAllSandboxFiles(sandbox);

    const previewUrl = `https://${sandbox.getHost(5173)}`;

    return {
        sbxId: sandbox.sandboxId,
        template: 'vite-support',
        url: previewUrl,
        allFiles: allFiles
    };
}

