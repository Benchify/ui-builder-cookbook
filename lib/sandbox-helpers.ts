import { z } from 'zod';
import { benchifyFileSchema } from './schemas';

/**
 * Transform functions for handling file content modifications
 */
export const transformations = {
    /**
     * Transforms Tailwind v3 syntax (@tailwind directives) to v4 syntax (@import "tailwindcss")
     * This is necessary because most AI-generated code will use the older syntax
     */
    tailwindSyntax(files: z.infer<typeof benchifyFileSchema>): z.infer<typeof benchifyFileSchema> {
        for (const file of files) {
            if (file.path.endsWith('.css') && file.content.includes('@tailwind')) {
                console.log(`Updating Tailwind v4 syntax in ${file.path}`);
                file.content = '@import "tailwindcss";';
            }
        }
        return files;
    },

    /**
     * Transforms React 17 ReactDOM.render to React 18+ createRoot API
     * This is necessary because most AI-generated code will use the older syntax
     */
    reactDomRender(files: z.infer<typeof benchifyFileSchema>): z.infer<typeof benchifyFileSchema> {
        for (const file of files) {
            if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
                // Check if file contains ReactDOM.render
                if (file.content.includes('ReactDOM.render(')) {
                    console.log(`Updating ReactDOM API in ${file.path}`);

                    // Fix the import statement
                    file.content = file.content.replace(
                        "import ReactDOM from 'react-dom';",
                        "import ReactDOM from 'react-dom/client';"
                    );
                    file.content = file.content.replace(
                        'import ReactDOM from "react-dom";',
                        'import ReactDOM from "react-dom/client";'
                    );

                    // Fix the render method (basic transformation)
                    file.content = file.content.replace(
                        /ReactDOM\.render\(\s*([\s\S]*?),\s*document\.getElementById\(['"](.*)['"]\)\s*\)/,
                        "ReactDOM.createRoot(document.getElementById('$2') as HTMLElement).render($1)"
                    );
                }
            }
        }
        return files;
    }
};

/**
 * Apply all standard transformations to files
 */
export function applyTransformations(files: z.infer<typeof benchifyFileSchema>): z.infer<typeof benchifyFileSchema> {
    return transformations.reactDomRender(transformations.tailwindSyntax(files));
} 