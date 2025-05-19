// lib/schemas.ts
import { z } from 'zod';

// Benchify API schema - matching the exact format in the API docs
export const benchifyFileSchema = z.array(z.object({
    path: z.string(),
    content: z.string()
}));

export const benchifyRequestSchema = z.object({
    repoUrl: z.string().optional(),
    files: benchifyFileSchema.optional(),
    jobName: z.string(),
    buildCmd: z.string()
});

// Type for the Benchify Fixer API request
export type BenchifyFixerRequest = z.infer<typeof benchifyRequestSchema>;

// Response from Benchify API
export interface BenchifyFixerResponse {
    build_status: number;
    build_output: string;
    diff: string;
}

// Component generation schema
export const componentSchema = z.object({
    type: z.string(),
    description: z.string(),
    requirements: z.string().optional(),
    preview: z.boolean().default(false)
});

export type ComponentRequest = z.infer<typeof componentSchema>;

// Complete response to the client
export interface GenerateResponse {
    originalCode: string;
    repairedCode: string;
    buildOutput: string;
    previewUrl?: string;
}