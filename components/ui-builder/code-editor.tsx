import { useState, useEffect, useCallback, useMemo } from "react";
import { benchifyFileSchema } from "@/lib/schemas";
import { z } from "zod";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    ChevronDown,
    ChevronRight,
    Folder,
    FileText,
    FileCode,
    Settings,
    Palette,
    Globe,
    Package
} from "lucide-react";

interface CodeEditorProps {
    files: z.infer<typeof benchifyFileSchema>;
}

interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileNode[];
    contents?: string;
}

export function CodeEditor({ files = [] }: CodeEditorProps) {
    const [selectedFilePath, setSelectedFilePath] = useState<string>('');
    const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

    // Build file tree structure (pure function, no side effects)
    const buildFileTree = useCallback((files: Array<{ path: string; contents: string }>): { tree: FileNode[], allFolders: string[] } => {
        const root: FileNode[] = [];
        const folderMap = new Map<string, FileNode>();
        const allFolders: string[] = [];

        // Sort files to ensure consistent ordering
        const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

        sortedFiles.forEach(file => {
            const parts = file.path.split('/');
            let currentPath = '';
            let currentLevel = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLast = i === parts.length - 1;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                if (isLast) {
                    // It's a file
                    currentLevel.push({
                        name: part,
                        path: file.path,
                        type: 'file',
                        contents: file.contents
                    });
                } else {
                    // It's a folder
                    let folder = folderMap.get(currentPath);
                    if (!folder) {
                        folder = {
                            name: part,
                            path: currentPath,
                            type: 'folder',
                            children: []
                        };
                        folderMap.set(currentPath, folder);
                        currentLevel.push(folder);
                        allFolders.push(currentPath);
                    }
                    currentLevel = folder.children!;
                }
            }
        });

        return { tree: root, allFolders };
    }, []);

    // Memoize the file tree calculation to prevent infinite re-renders
    const { tree: fileTree, allFolders } = useMemo(() => buildFileTree(files), [files, buildFileTree]);
    const selectedFile = files.find(f => f.path === selectedFilePath);

    // Open all folders by default (only once when files change)
    useEffect(() => {
        if (allFolders.length > 0) {
            setOpenFolders(new Set(allFolders));
        }
    }, [allFolders]);

    // Auto-select first file if none selected (only once when files change)
    useEffect(() => {
        if (!selectedFilePath && files.length > 0) {
            setSelectedFilePath(files[0].path);
        }
    }, [files, selectedFilePath]); // Include files since we access files[0]

    // Get file icon based on extension
    const getFileIcon = (path: string) => {
        if (path.endsWith('.tsx') || path.endsWith('.jsx')) return <FileCode className="h-4 w-4 text-blue-500" />;
        if (path.endsWith('.ts') || path.endsWith('.js')) return <FileCode className="h-4 w-4 text-yellow-500" />;
        if (path.endsWith('.css')) return <Palette className="h-4 w-4 text-pink-500" />;
        if (path.endsWith('.html')) return <Globe className="h-4 w-4 text-orange-500" />;
        if (path.endsWith('.json') || path.includes('config')) return <Settings className="h-4 w-4 text-gray-500" />;
        if (path.includes('package.json')) return <Package className="h-4 w-4 text-green-500" />;
        return <FileText className="h-4 w-4 text-gray-400" />;
    };

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

    const toggleFolder = (folderPath: string) => {
        setOpenFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderPath)) {
                newSet.delete(folderPath);
            } else {
                newSet.add(folderPath);
            }
            return newSet;
        });
    };

    const renderFileTree = (nodes: FileNode[], depth = 0) => {
        return nodes.map(node => {
            if (node.type === 'folder') {
                const isOpen = openFolders.has(node.path);

                return (
                    <Collapsible key={node.path} open={isOpen} onOpenChange={() => toggleFolder(node.path)}>
                        <CollapsibleTrigger className="flex items-center w-full text-left py-1 px-2 hover:bg-muted/50 text-sm">
                            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 12}px` }}>
                                {isOpen ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <Folder className="h-4 w-4 text-blue-400" />
                                <span className="font-medium">{node.name}</span>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            {node.children && renderFileTree(node.children, depth + 1)}
                        </CollapsibleContent>
                    </Collapsible>
                );
            } else {
                const isSelected = selectedFilePath === node.path;

                return (
                    <button
                        key={node.path}
                        onClick={() => setSelectedFilePath(node.path)}
                        className={cn(
                            "flex items-center w-full text-left py-1.5 px-2 hover:bg-muted/50 text-sm transition-colors",
                            isSelected && "bg-primary/10 text-primary"
                        )}
                    >
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 12 + 20}px` }}>
                            {getFileIcon(node.path)}
                            <span className="truncate">{node.name}</span>
                        </div>
                    </button>
                );
            }
        });
    };

    return (
        <div className="grid grid-cols-[320px_1fr] h-[700px] gap-4">
            {/* File sidebar - now wider */}
            <div className="border rounded-md overflow-hidden bg-card min-w-0 h-full">
                <div className="p-3 border-b bg-muted/50 font-semibold text-sm flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    Files
                </div>
                <ScrollArea className="h-[calc(100%-41px)]">
                    <div className="py-2">
                        {renderFileTree(fileTree)}
                    </div>
                </ScrollArea>
            </div>

            {/* Code content */}
            <div className="border rounded-md overflow-hidden h-full min-w-0 flex-1">
                {selectedFile ? (
                    <div className="flex flex-col h-full">
                        <div className="p-3 border-b bg-muted/50 font-medium flex items-center gap-2">
                            {getFileIcon(selectedFile.path)}
                            <span className="text-sm truncate">{selectedFile.path}</span>
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
                            {selectedFile.contents}
                        </SyntaxHighlighter>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Select a file to view its contents</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 