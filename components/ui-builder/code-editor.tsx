import { useState } from "react";
import { benchifyFileSchema } from "@/lib/schemas";
import { z } from "zod";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CodeEditorProps {
    files: z.infer<typeof benchifyFileSchema>;
}

export function CodeEditor({ files = [] }: CodeEditorProps) {
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);

    // Selected file data
    const selectedFile = files[selectedFileIndex];

    // Determine file language for syntax highlighting
    const getLanguage = (path: string) => {
        if (path.endsWith('.js')) return 'javascript';
        if (path.endsWith('.jsx')) return 'jsx';
        if (path.endsWith('.ts')) return 'typescript';
        if (path.endsWith('.tsx')) return 'tsx';
        if (path.endsWith('.css')) return 'css';
        if (path.endsWith('.html')) return 'html';
        if (path.endsWith('.vue')) return 'markup';
        if (path.endsWith('.json')) return 'json';
        if (path.endsWith('.md')) return 'markdown';
        return 'text';
    };

    // Extract filename from path
    const getFileName = (path: string) => {
        const parts = path.split('/');
        return parts[parts.length - 1];
    };

    return (
        <div className="grid grid-cols-[180px_1fr] h-[700px] gap-4">
            {/* File sidebar */}
            <div className="border rounded-md overflow-hidden bg-card min-w-0 h-full">
                <div className="p-2 border-b bg-muted/50 font-medium text-sm">Files</div>
                <ScrollArea className="h-[calc(100%-33px)]">
                    <div className="py-1">
                        {files.map((file, index) => (
                            <button
                                key={file.path}
                                onClick={() => setSelectedFileIndex(index)}
                                className={cn(
                                    "w-full text-left px-2 py-1.5 text-xs hover:bg-muted/50",
                                    selectedFileIndex === index && "bg-primary/10 text-primary font-medium"
                                )}
                                title={file.path}
                            >
                                <span className="block truncate">{file.path}</span>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Code content */}
            <div className="border rounded-md overflow-hidden h-full min-w-0 flex-1">
                {selectedFile ? (
                    <div className="flex flex-col h-full">
                        <div className="p-2 border-b bg-muted/50 font-medium flex items-center">
                            <span className="text-sm truncate">{getFileName(selectedFile.path)}</span>
                        </div>
                        <SyntaxHighlighter
                            language={getLanguage(selectedFile.path)}
                            style={vscDarkPlus}
                            showLineNumbers
                            customStyle={{
                                margin: 0,
                                padding: '1rem',
                                height: '100%',
                                width: '100%',
                                backgroundColor: 'var(--muted)',
                                opacity: 0.9,
                                fontSize: '0.875rem',
                                borderRadius: '0.375rem',
                            }}
                            wrapLongLines={false}
                            wrapLines={false}
                            codeTagProps={{
                                style: {
                                    fontFamily: 'var(--font-mono)',
                                    whiteSpace: 'pre',
                                    wordBreak: 'keep-all'
                                }
                            }}
                            PreTag={({ children, ...props }) => (
                                <pre
                                    className="h-full w-full m-0 p-0 rounded-md"
                                    {...props}
                                >
                                    {children}
                                </pre>
                            )}
                        >
                            {selectedFile.content}
                        </SyntaxHighlighter>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No file selected
                    </div>
                )}
            </div>
        </div>
    );
} 