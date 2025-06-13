'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/ui-builder/chat-interface';
import { PreviewCard } from '@/components/ui-builder/preview-card';
import { benchifyFileSchema } from '@/lib/schemas';
import { z } from 'zod';

export default function BuilderPage() {
    const router = useRouter();
    const [result, setResult] = useState<{
        repairedFiles?: z.infer<typeof benchifyFileSchema>;
        originalFiles?: z.infer<typeof benchifyFileSchema>;
        buildOutput: string;
        previewUrl: string;
    } | null>(null);
    const [initialPrompt, setInitialPrompt] = useState<string>('');

    useEffect(() => {
        // Get the result from sessionStorage
        const storedResult = sessionStorage.getItem('builderResult');
        const storedPrompt = sessionStorage.getItem('initialPrompt');

        if (storedResult && storedPrompt) {
            setResult(JSON.parse(storedResult));
            setInitialPrompt(storedPrompt);
        } else {
            // If no result found, redirect back to home
            router.push('/');
        }
    }, [router]);

    if (!result) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading your project...</p>
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
                    onUpdateResult={setResult}
                />
            </div>

            {/* Preview Area - Right Side */}
            <div className="flex-1 p-4 overflow-hidden">
                <PreviewCard
                    previewUrl={result.previewUrl}
                    code={result.repairedFiles || result.originalFiles || []}
                />
            </div>
        </div>
    );
} 