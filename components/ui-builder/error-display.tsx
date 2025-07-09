'use client';

import { useState } from 'react';
import { AlertCircle, Code, FileX, Terminal, Wand2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { benchifyFileSchema } from '@/lib/schemas';
import { z } from 'zod';

interface BuildError {
    type: 'typescript' | 'build' | 'runtime';
    message: string;
    file?: string;
    line?: number;
    column?: number;
}

interface FixResult {
    originalFiles: z.infer<typeof benchifyFileSchema>;
    repairedFiles: z.infer<typeof benchifyFileSchema>;
    buildOutput: string;
    previewUrl: string;
    buildErrors?: BuildError[];
    hasErrors: boolean;
    editInstruction?: string;
}

interface ErrorDisplayProps {
    errors: BuildError[];
    currentFiles?: z.infer<typeof benchifyFileSchema>;
    onFixComplete?: (result: FixResult) => void;
}

export function ErrorDisplay({ errors, currentFiles, onFixComplete }: ErrorDisplayProps) {
    const [isFixing, setIsFixing] = useState(false);

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

    const handleFixWithAI = async () => {
        if (!currentFiles || errors.length === 0 || isFixing) return;

        setIsFixing(true);

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

            // Use the existing edit API
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'component',
                    description: '',
                    existingFiles: currentFiles,
                    editInstruction: fixInstruction,
                    useBuggyCode,
                    useFixer,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to fix errors with AI');
            }

            const fixResult = await response.json();

            // Notify parent component of the fix result
            if (onFixComplete) {
                onFixComplete(fixResult);
            }

        } catch (error) {
            console.error('Error fixing with AI:', error);
            // Could add error toast here
        } finally {
            setIsFixing(false);
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-center rounded-md border bg-background p-6">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-6">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Build Errors Detected</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                        Your project has some issues that need to be fixed before it can run properly.
                    </p>

                    {/* Fix with AI Button */}
                    {currentFiles && (
                        <Button
                            onClick={handleFixWithAI}
                            disabled={isFixing}
                            className="mb-4"
                            size="sm"
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
                    )}
                </div>

                <ScrollArea className="max-h-96">
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
            </div>
        </div>
    );
} 