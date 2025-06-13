'use client';

import { AlertCircle, Code, FileX, Terminal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BuildError {
    type: 'typescript' | 'build' | 'runtime';
    message: string;
    file?: string;
    line?: number;
    column?: number;
}

interface ErrorDisplayProps {
    errors: BuildError[];
}

export function ErrorDisplay({ errors }: ErrorDisplayProps) {
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

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">💡 Common Solutions:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Check for missing imports or typos in component names</li>
                        <li>• Verify that all props are properly typed</li>
                        <li>• Make sure all dependencies are correctly installed</li>
                        <li>• Try regenerating the component with more specific requirements</li>
                    </ul>
                </div>
            </div>
        </div>
    );
} 