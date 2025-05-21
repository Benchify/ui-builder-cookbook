import { Card, CardContent } from "@/components/ui/card";
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
        <Card className="border-border bg-card">
            <CardContent>
                <Tabs defaultValue="preview" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                        <TabsTrigger value="code">Code</TabsTrigger>
                    </TabsList>

                    <TabsContent value="preview" className="w-full">
                        <div className="w-full overflow-hidden rounded-md border">
                            <iframe
                                title="Preview"
                                src={previewUrl}
                                className="w-full h-[700px]"
                                sandbox="allow-scripts allow-same-origin"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="code" className="w-full h-[700px]">
                        <CodeEditor files={files} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
