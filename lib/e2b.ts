import { Sandbox } from '@e2b/code-interpreter';
import { benchifyFileSchema } from './schemas';
import { z } from 'zod';

const E2B_API_KEY = process.env.E2B_API_KEY;

if (!E2B_API_KEY) {
    throw new Error('E2B_API_KEY is not set');
}

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

    const previewUrl = `https://${sandbox.getHost(5173)}`;

    return {
        sbxId: sandbox.sandboxId,
        template: 'vite-support',
        url: previewUrl
    };
}

