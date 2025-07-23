'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/ui-builder/chat-interface';
import { PreviewCard } from '@/components/ui-builder/preview-card';
import { generateApp, GenerateAppResult } from '@/lib/actions/generate-app';
import { generateSessionId } from '@/lib/progress-tracker';

// Extract the success type from the union
type GenerationResult = Extract<GenerateAppResult, { buildOutput: string }> & { sandboxId?: string };

export default function ChatPage() {
    const router = useRouter();
    const [result, setResult] = useState<GenerationResult | null>(null);
    const [initialPrompt, setInitialPrompt] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const generationStartedRef = useRef(false);

    useEffect(() => {
        // Get the prompt and check if we have an existing result
        const storedPrompt = sessionStorage.getItem('initialPrompt');
        const storedResult = sessionStorage.getItem('builderResult');
        const storedSessionId = sessionStorage.getItem('progressSessionId');

        if (!storedPrompt) {
            // If no prompt found, redirect back to home
            router.push('/');
            return;
        }

        setInitialPrompt(storedPrompt);

        if (storedResult) {
            // If we have a stored result, use it
            const parsedResult = JSON.parse(storedResult);
            setResult(parsedResult);
            // IMPORTANT: Use sessionId from the result first, then fallback to stored
            const resultSessionId = parsedResult.sessionId || storedSessionId;
            console.log('💾 Using stored result with sessionId:', resultSessionId);
            setSessionId(resultSessionId);

            // Clear the stored session ID to prevent confusion on next generation
            sessionStorage.removeItem('progressSessionId');
        } else if (!generationStartedRef.current) {
            // If no result and generation hasn't started yet, start the generation process
            generationStartedRef.current = true;
            const newSessionId = generateSessionId();
            console.log('💡 Generated new session ID for generation:', newSessionId);
            setSessionId(newSessionId);
            sessionStorage.setItem('progressSessionId', newSessionId);
            setIsGenerating(true);
            startGeneration(storedPrompt, newSessionId);
        }
    }, [router]);

    const startGeneration = async (prompt: string, progressSessionId: string) => {
        console.log('🚀 Starting generation with sessionId:', progressSessionId);

        try {
            // Get toggle values from sessionStorage
            const useBuggyCode = sessionStorage.getItem('useBuggyCode') === 'true';
            const useFixer = sessionStorage.getItem('useFixer') === 'true';

            const generationResult = await generateApp({
                type: 'component',
                description: prompt,
                preview: true,
                useBuggyCode,
                useFixer,
                sessionId: progressSessionId,
            });

            console.log('📦 Generation result received:', {
                hasError: 'error' in generationResult,
                sessionId: generationResult.sessionId
            });

            // Check if it's an error result
            if ('error' in generationResult) {
                throw new Error(generationResult.message);
            }

            // Store the result (make sure sessionId is included)
            const resultWithSession = {
                ...generationResult,
                sessionId: progressSessionId // Ensure sessionId is always present
            };
            sessionStorage.setItem('builderResult', JSON.stringify(resultWithSession));
            setResult(resultWithSession);

            // CRITICAL: Make sure sessionId state matches the result
            console.log('🔄 Ensuring sessionId state matches result:', progressSessionId);
            setSessionId(progressSessionId);

            setIsGenerating(false);
            generationStartedRef.current = false; // Reset flag for future generations
        } catch (error) {
            console.error('Error generating component:', error);
            setIsGenerating(false);
            generationStartedRef.current = false; // Reset flag even on error
            // Handle error state
        }
    };

    const handleUpdateResult = (updatedResult: GenerationResult) => {
        // Preserve the session ID when updating results
        const resultWithSession = {
            ...updatedResult,
            sessionId: sessionId || updatedResult.sessionId
        };
        setResult(resultWithSession);
        sessionStorage.setItem('builderResult', JSON.stringify(resultWithSession));
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
                    onUpdateResult={handleUpdateResult}
                    sessionId={sessionId || undefined}
                    sandboxId={result?.sandboxId}
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
                    onFixComplete={handleUpdateResult}
                    sessionId={sessionId || undefined}
                    sandboxId={result?.sandboxId}
                />
            </div>
        </div>
    );
} 