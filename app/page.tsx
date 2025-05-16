// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { PromptForm } from '@/components/ui-builder/prompt-form';
import { Card, CardContent } from '@/components/ui/card';
import { benchifyFileSchema } from '@/lib/schemas';
import { z } from 'zod';

export default function Home() {
  const [result, setResult] = useState<{
    repairedFiles: z.infer<typeof benchifyFileSchema>;
    buildOutput: string;
    previewUrl: string;
  } | null>(null);

  useEffect(() => {
    if (result) {
      console.log(result);
    }
  }, [result]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="w-full max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-bold mb-4 text-center">
          UI App Builder
        </h1>
        <p className="text-lg text-muted-foreground mb-8 text-center">
          Generate UI components with AI and automatically repair issues with Benchify
        </p>
        {!result ? (
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <PromptForm onGenerate={setResult} />
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <iframe title="Preview" src={result.previewUrl} className="w-full h-full" />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}