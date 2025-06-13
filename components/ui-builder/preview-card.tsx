import { useEffect, useState } from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { benchifyFileSchema } from "@/lib/schemas";
import { z } from "zod";
import { CodeEditor } from "./code-editor";
import { DownloadButton } from "./download-button";
import { ErrorDisplay } from "./error-display";

interface Step {
    id: string;
    label: string;
    description: string;
}

const GENERATION_STEPS: Step[] = [
    {
        id: 'analyzing',
        label: 'Analyzing Request',
        description: 'Understanding your requirements and design specifications',
    },
    {
        id: 'generating',
        label: 'Generating Code',
        description: 'Creating UI components with AI assistance',
    },
    {
        id: 'building',
        label: 'Building Project',
        description: 'Setting up development environment and dependencies',
    },
    {
        id: 'deploying',
        label: 'Creating Preview',
        description: 'Deploying your project for live preview',
    },
];

interface BuildError {
    type: 'typescript' | 'build' | 'runtime';
    message: string;
    file?: string;
    line?: number;
    column?: number;
}

interface PreviewCardProps {
    previewUrl?: string;
    code: z.infer<typeof benchifyFileSchema>;
    isGenerating?: boolean;
    prompt?: string;
    buildErrors?: BuildError[];
    hasErrors?: boolean;
}

export function PreviewCard({
    previewUrl,
    code,
    isGenerating = false,
    prompt,
    buildErrors = [],
    hasErrors = false
}: PreviewCardProps) {
    const files = code || [];
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        if (isGenerating) {
            // Reset to first step when generation starts
            setCurrentStep(0);

            // Automatically advance through steps for visual feedback
            const stepTimer = setInterval(() => {
                setCurrentStep(prev => {
                    // Cycle through steps, but don't go past the last one
                    if (prev < GENERATION_STEPS.length - 1) {
                        return prev + 1;
                    }
                    return prev;
                });
            }, 2000); // Advance every 2 seconds

            return () => clearInterval(stepTimer);
        }
    }, [isGenerating]);

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
                                        "{prompt.substring(0, 100)}{prompt.length > 100 ? '...' : ''}"
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {GENERATION_STEPS.map((step, index) => {
                                        const isCompleted = index < currentStep;
                                        const isCurrent = index === currentStep;

                                        return (
                                            <div key={step.id} className="flex items-start space-x-3">
                                                <div className="flex-shrink-0 mt-1">
                                                    {isCompleted ? (
                                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                                    ) : isCurrent ? (
                                                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                                    ) : (
                                                        <Circle className="h-5 w-5 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${isCompleted ? 'text-green-700 dark:text-green-400' :
                                                        isCurrent ? 'text-primary' :
                                                            'text-muted-foreground'
                                                        }`}>
                                                        {step.label}
                                                    </p>
                                                    <p className={`text-xs ${isCompleted || isCurrent ? 'text-muted-foreground' : 'text-muted-foreground/60'
                                                        }`}>
                                                        {step.description}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </div>
                    ) : hasErrors && buildErrors.length > 0 ? (
                        // Show build errors if there are any
                        <ErrorDisplay errors={buildErrors} />
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
