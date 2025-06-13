'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { benchifyFileSchema } from '@/lib/schemas';
import { z } from 'zod';
import JSZip from 'jszip';

interface DownloadButtonProps {
    files: z.infer<typeof benchifyFileSchema>;
    disabled?: boolean;
    className?: string;
}

export function DownloadButton({ files, disabled = false, className }: DownloadButtonProps) {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!files.length) return;

        setIsDownloading(true);
        try {
            const zip = new JSZip();

            // Add each file to the ZIP
            files.forEach(file => {
                zip.file(file.path, file.content);
            });

            // Generate the ZIP file
            const content = await zip.generateAsync({ type: 'blob' });

            // Create download link
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'generated-ui-project.zip';
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error creating download:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    if (!files.length) return null;

    return (
        <Button
            onClick={handleDownload}
            disabled={disabled || isDownloading}
            variant="outline"
            size="sm"
            className={`flex items-center gap-2 ${className}`}
        >
            {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Download className="h-4 w-4" />
            )}
            {isDownloading ? 'Downloading...' : 'Download Project'}
        </Button>
    );
} 