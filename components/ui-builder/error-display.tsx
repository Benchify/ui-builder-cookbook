'use client';

import { useState } from 'react';
import { AlertCircle, Code, FileX, Terminal, Wand2, Wrench, CheckCircle, Circle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { benchifyFileSchema } from '@/lib/schemas';
import { z } from 'zod';
import { generateApp } from '@/lib/actions/generate-app';
import { runBenchifyFixer } from '@/lib/actions/benchify-fixer';
import { generateSessionId, ProgressStep } from '@/lib/progress-tracker';
import { useProgress } from '@/lib/hooks/use-progress';

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

interface ErrorDisplayProps {
    errors: BuildError[];
    currentFiles?: z.infer<typeof benchifyFileSchema>;
    onFixComplete?: (result: FixResult) => void;
    sessionId?: string;
}

export function ErrorDisplay({ errors, currentFiles, onFixComplete, sessionId }: ErrorDisplayProps) {
    const [isFixing, setIsFixing] = useState(false);
    const [isBenchifyFixing, setIsBenchifyFixing] = useState(false);
    const [fixSessionId, setFixSessionId] = useState<string | null>(null);
    const [benchifyFixSessionId, setBenchifyFixSessionId] = useState<string | null>(null);

    // Progress tracking for AI fix
    const { progress: aiFixProgress, isConnected: aiFixConnected } = useProgress(fixSessionId);

    // Progress tracking for Benchify fix  
    const { progress: benchifyProgress, isConnected: benchifyConnected } = useProgress(benchifyFixSessionId);

    const getErrorIcon = (type: BuildError['type']) => {
        switch (type) {
            case 'typescript':
                return <Code className="h-4 w-4" />;
            case 'build':
                return <Terminal className="h-4 w-4" />;
            case 'runtime':
                return <AlertCircle className="h-4 w-4" />;
            default:
                return <FileX className="h-4 w-4" />;
        }
    };

    const getErrorColor = (type: BuildError['type']) => {
        switch (type) {
            case 'typescript':
                return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
            case 'build':
                return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
            case 'runtime':
                return 'bg-red-500/10 text-red-700 dark:text-red-400';
            default:
                return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
        }
    };

    const groupedErrors = errors.reduce((acc, error) => {
        if (!acc[error.type]) {
            acc[error.type] = [];
        }
        acc[error.type].push(error);
        return acc;
    }, {} as Record<string, BuildError[]>);

    // Helper function to render progress steps
    const renderProgressSteps = (steps: ProgressStep[], title: string) => (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                    Analyzing and fixing the detected errors
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {steps.map((step: ProgressStep) => {
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
                })}
            </CardContent>
        </Card>
    );

    const handleFixWithAI = async () => {
        if (!currentFiles || errors.length === 0 || isFixing) return;

        setIsFixing(true);
        const newSessionId = generateSessionId();
        setFixSessionId(newSessionId);

        try {
            // Format errors into an edit instruction
            const errorDetails = errors.map(error => {
                let errorInfo = `${error.type.toUpperCase()} ERROR: ${error.message}`;
                if (error.file) {
                    errorInfo += ` (in ${error.file}`;
                    if (error.line) errorInfo += ` at line ${error.line}`;
                    if (error.column) errorInfo += `, column ${error.column}`;
                    errorInfo += ')';
                }
                return errorInfo;
            }).join('\n\n');

            const fixInstruction = `Fix the following build errors:

${errorDetails}

Please make the minimal changes necessary to resolve these errors while maintaining existing functionality.`;

            // Get toggle values from sessionStorage
            const useBuggyCode = sessionStorage.getItem('useBuggyCode') === 'true';
            const useFixer = sessionStorage.getItem('useFixer') === 'true';

            // Use the server action
            const fixResult = await generateApp({
                type: 'component',
                description: '',
                preview: true,
                existingFiles: currentFiles,
                editInstruction: fixInstruction,
                useBuggyCode,
                useFixer,
                sessionId: newSessionId,
            });

            if ('error' in fixResult) {
                throw new Error(fixResult.message);
            }

            // Notify parent component of the fix result
            if (onFixComplete) {
                onFixComplete(fixResult);
            }

        } catch (error) {
            console.error('Error fixing with AI:', error);
            // Could add error toast here
        } finally {
            setIsFixing(false);
            setFixSessionId(null);
        }
    };

    const handleFixWithBenchify = async () => {
        if (!currentFiles || errors.length === 0 || isBenchifyFixing) return;

        setIsBenchifyFixing(true);
        const newSessionId = generateSessionId();
        setBenchifyFixSessionId(newSessionId);

        try {
            // Run the Benchify fixer on current files
            const fixResult = await runBenchifyFixer({
                files: currentFiles,
                sessionId: newSessionId,
            });

            if ('error' in fixResult) {
                throw new Error(fixResult.message);
            }

            // Notify parent component of the fix result
            if (onFixComplete) {
                onFixComplete(fixResult);
            }

        } catch (error) {
            console.error('Error fixing with Benchify:', error);
            // Could add error toast here
        } finally {
            setIsBenchifyFixing(false);
            setBenchifyFixSessionId(null);
        }
    };

    // Show progress tracking if any fix is running
    if (isFixing && aiFixProgress?.steps && aiFixProgress.steps.length > 0) {
        return (
            <div className="w-full h-full flex items-center justify-center rounded-md border bg-background p-6">
                {renderProgressSteps(aiFixProgress.steps, "Fixing with AI")}
            </div>
        );
    }

    if (isBenchifyFixing && benchifyProgress?.steps && benchifyProgress.steps.length > 0) {
        return (
            <div className="w-full h-full flex items-center justify-center rounded-md border bg-background p-6">
                {renderProgressSteps(benchifyProgress.steps, "Fixing with Benchify")}
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center justify-center rounded-md border bg-background p-6">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-6">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Build Errors Detected</h3>
                    <p className="text-muted-foreground text-sm">
                        Your project has some issues that need to be fixed before it can run properly.
                    </p>
                </div>

                <ScrollArea className="max-h-96 mb-6">
                    <div className="space-y-4">
                        {Object.entries(groupedErrors).map(([type, typeErrors]) => (
                            <div key={type} className="space-y-2">
                                <div className="flex items-center gap-2 mb-3">
                                    {getErrorIcon(type as BuildError['type'])}
                                    <h4 className="font-medium capitalize">{type} Errors</h4>
                                    <Badge variant="secondary" className="text-xs">
                                        {typeErrors.length}
                                    </Badge>
                                </div>

                                {typeErrors.map((error, index) => (
                                    <Alert key={index} className="border-l-4 border-destructive">
                                        <AlertTitle className="flex items-center gap-2 text-sm">
                                            <Badge
                                                variant="outline"
                                                className={`text-xs ${getErrorColor(error.type)}`}
                                            >
                                                {error.type}
                                            </Badge>
                                            {error.file && (
                                                <span className="text-muted-foreground">
                                                    {error.file}
                                                    {error.line && `:${error.line}`}
                                                    {error.column && `:${error.column}`}
                                                </span>
                                            )}
                                        </AlertTitle>
                                        <AlertDescription className="mt-2 text-sm font-mono bg-muted/50 p-2 rounded text-wrap break-words">
                                            {error.message}
                                        </AlertDescription>
                                    </Alert>
                                ))}
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                {/* Fix Buttons - Moved below errors with improved styling */}
                {currentFiles && (
                    <div className="border-t pt-4">
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button
                                onClick={handleFixWithAI}
                                disabled={isFixing || isBenchifyFixing}
                                className="flex-1 sm:flex-none"
                            >
                                {isFixing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                                        Fixing with AI...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-4 w-4 mr-2" />
                                        Fix with AI
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleFixWithBenchify}
                                disabled={isFixing || isBenchifyFixing}
                                variant="outline"
                                className="flex-1 sm:flex-none"
                            >
                                {isBenchifyFixing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                                        Fixing with Benchify...
                                    </>
                                ) : (
                                    <>
                                        <Wrench className="h-4 w-4 mr-2" />
                                        Fix with Benchify
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 