import { useEffect, useState } from 'react';
import { CheckCircle, Circle, Loader2, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { benchifyFileSchema } from "@/lib/schemas";
import { z } from "zod";
import { CodeEditor } from "./code-editor";
import { DownloadButton } from "./download-button";
import { ErrorDisplay } from "./error-display";
import { useProgress } from "@/lib/hooks/use-progress";
import { ProgressStep } from "@/lib/progress-tracker";



interface BuildError {
    type: 'typescript' | 'build' | 'runtime';
    message: string;
    file?: string;
    line?: number;
    column?: number;
}

interface FixResult {
    originalFiles?: z.infer<typeof benchifyFileSchema>;
    repairedFiles?: z.infer<typeof benchifyFileSchema>;
    buildOutput: string;
    previewUrl: string;
    buildErrors?: BuildError[];
    hasErrors?: boolean;
    editInstruction?: string;
}

interface PreviewCardProps {
    previewUrl?: string;
    code: z.infer<typeof benchifyFileSchema>;
    isGenerating?: boolean;
    prompt?: string;
    buildErrors?: BuildError[];
    hasErrors?: boolean;
    onFixComplete?: (result: FixResult) => void;
    sessionId?: string;
}

export function PreviewCard({
    previewUrl,
    code,
    isGenerating = false,
    prompt,
    buildErrors = [],
    hasErrors = false,
    onFixComplete,
    sessionId
}: PreviewCardProps) {
    const files = code || [];
    const { progress, isConnected, error: progressError } = useProgress(sessionId || null);

    // Log only when there's actual progress
    if (progress && progress.steps.length > 0) {
        console.log('📊 PreviewCard: Progress -', progress.steps[progress.currentStepIndex]?.label || 'Unknown step');
    }

    // Get the current steps from progress, or use empty array as fallback
    const steps = progress?.steps || [];
    const isProgressComplete = progress?.isComplete || false;
    const progressHasError = progress?.hasError || false;

    return (
        <div className="h-full">
            <Tabs defaultValue="preview" className="w-full h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <TabsList>
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                        <TabsTrigger value="code">Code</TabsTrigger>
                    </TabsList>

                    <DownloadButton
                        files={files}
                        disabled={isGenerating}
                    />
                </div>

                <TabsContent value="preview" className="flex-1 m-0">
                    {isGenerating && prompt ? (
                        // Show loading progress inside the preview tab
                        <div className="w-full h-full flex items-center justify-center rounded-md border bg-background">
                            <Card className="w-full max-w-md mx-auto">
                                <CardHeader>
                                    <CardTitle>Building Your UI</CardTitle>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        &quot;{prompt.substring(0, 100)}{prompt.length > 100 ? '...' : ''}&quot;
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {progressError && (
                                        <div className="text-sm text-red-500 mb-4">
                                            Failed to connect to progress stream. Showing basic loading...
                                        </div>
                                    )}
                                    {steps.length > 0 ? (
                                        steps.map((step: ProgressStep) => {
                                            const isCompleted = step.status === 'completed';
                                            const isCurrent = step.status === 'in-progress';
                                            const hasError = step.status === 'error';

                                            return (
                                                <div key={step.id} className="flex items-start space-x-3">
                                                    <div className="flex-shrink-0 mt-1">
                                                        {hasError ? (
                                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                                        ) : isCompleted ? (
                                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                                        ) : isCurrent ? (
                                                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                                        ) : (
                                                            <Circle className="h-5 w-5 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-medium ${hasError ? 'text-red-700 dark:text-red-400' :
                                                            isCompleted ? 'text-green-700 dark:text-green-400' :
                                                                isCurrent ? 'text-primary' :
                                                                    'text-muted-foreground'
                                                            }`}>
                                                            {step.label}
                                                        </p>
                                                        <p className={`text-xs ${hasError ? 'text-red-600 dark:text-red-500' :
                                                            isCompleted || isCurrent ? 'text-muted-foreground' : 'text-muted-foreground/60'
                                                            }`}>
                                                            {hasError && step.error ? step.error : step.description}
                                                        </p>
                                                        {step.startTime && step.endTime && (
                                                            <p className="text-xs text-muted-foreground/50 mt-1">
                                                                Completed in {((step.endTime - step.startTime) / 1000).toFixed(1)}s
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        // Fallback loading state when no progress data is available
                                        <div className="flex items-center space-x-3">
                                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                            <div>
                                                <p className="text-sm font-medium text-primary">Getting Started</p>
                                                <p className="text-xs text-muted-foreground">Setting up your request...</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    ) : hasErrors && buildErrors.length > 0 ? (
                        // Show build errors if there are any
                        <ErrorDisplay
                            errors={buildErrors}
                            currentFiles={files}
                            onFixComplete={onFixComplete}
                            sessionId={sessionId}
                        />
                    ) : previewUrl ? (
                        // Show the actual preview iframe when ready
                        <div className="w-full h-full overflow-hidden rounded-md border bg-background">
                            <iframe
                                title="Preview"
                                src={previewUrl}
                                className="w-full h-full"
                                sandbox="allow-scripts allow-same-origin"
                            />
                        </div>
                    ) : (
                        // Show loading spinner if no preview URL yet
                        <div className="w-full h-full flex items-center justify-center rounded-md border bg-background">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
                                <p className="text-muted-foreground">Loading your project...</p>
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="code" className="flex-1 m-0">
                    <div className="h-full">
                        <CodeEditor files={files} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
