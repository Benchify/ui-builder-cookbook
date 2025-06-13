'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/ui-builder/chat-interface';
import { PreviewCard } from '@/components/ui-builder/preview-card';
import { benchifyFileSchema } from '@/lib/schemas';
import { z } from 'zod';

type GenerationResult = {
    repairedFiles?: z.infer<typeof benchifyFileSchema>;
    originalFiles?: z.infer<typeof benchifyFileSchema>;
    buildOutput: string;
    previewUrl: string;
    buildErrors?: Array<{
        type: 'typescript' | 'build' | 'runtime';
        message: string;
        file?: string;
        line?: number;
        column?: number;
    }>;
    hasErrors?: boolean;
};

export default function ChatPage() {
    const router = useRouter();
    const [result, setResult] = useState<GenerationResult | null>(null);
    const [initialPrompt, setInitialPrompt] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        // Get the prompt and check if we have an existing result
        const storedPrompt = sessionStorage.getItem('initialPrompt');
        const storedResult = sessionStorage.getItem('builderResult');

        if (!storedPrompt) {
            // If no prompt found, redirect back to home
            router.push('/');
            return;
        }

        setInitialPrompt(storedPrompt);

        if (storedResult) {
            // If we have a stored result, use it
            setResult(JSON.parse(storedResult));
        } else {
            // If no result, start the generation process
            setIsGenerating(true);
            startGeneration(storedPrompt);
        }
    }, [router]);

    const startGeneration = async (prompt: string) => {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'component',
                    description: prompt,
                    preview: true,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate component');
            }

            const generationResult = await response.json();

            // Store the result
            sessionStorage.setItem('builderResult', JSON.stringify(generationResult));
            setResult(generationResult);
            setIsGenerating(false);
        } catch (error) {
            console.error('Error generating component:', error);
            setIsGenerating(false);
            // Handle error state
        }
    };

    // Show loading spinner if we don't have prompt yet
    if (!initialPrompt) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex">
            {/* Chat Interface - Left Side */}
            <div className="w-1/4 min-w-80 border-r border-border bg-card flex-shrink-0">
                <ChatInterface
                    initialPrompt={initialPrompt}
                    currentFiles={result?.repairedFiles || result?.originalFiles}
                    onUpdateResult={(updatedResult) => {
                        setResult(updatedResult);
                        // Save updated result to sessionStorage
                        sessionStorage.setItem('builderResult', JSON.stringify(updatedResult));
                    }}
                />
            </div>

            {/* Preview Area - Right Side */}
            <div className="flex-1 p-4 overflow-hidden">
                <PreviewCard
                    previewUrl={result?.previewUrl}
                    code={result?.repairedFiles || result?.originalFiles || []}
                    isGenerating={isGenerating}
                    prompt={initialPrompt}
                    buildErrors={result?.buildErrors}
                    hasErrors={result?.hasErrors}
                />
            </div>
        </div>
    );
} 