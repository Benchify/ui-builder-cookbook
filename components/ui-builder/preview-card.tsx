import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { benchifyFileSchema } from "@/lib/schemas";
import { z } from "zod";
import { CodeEditor } from "./code-editor";

interface PreviewCardProps {
    previewUrl: string;
    code: z.infer<typeof benchifyFileSchema>;
}

export function PreviewCard({ previewUrl, code }: PreviewCardProps) {
    const files = code || [];

    return (
        <div className="h-full">
            <Tabs defaultValue="preview" className="w-full h-full flex flex-col">
                <TabsList className="mb-4 self-start">
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="code">Code</TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="flex-1 m-0">
                    <div className="w-full h-full overflow-hidden rounded-md border bg-background">
                        <iframe
                            title="Preview"
                            src={previewUrl}
                            className="w-full h-full"
                            sandbox="allow-scripts allow-same-origin"
                        />
                    </div>
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
