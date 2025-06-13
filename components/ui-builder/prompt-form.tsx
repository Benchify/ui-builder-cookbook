// components/ui-builder/prompt-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Textarea } from '@/components/ui/textarea';

const formSchema = z.object({
    description: z.string().min(10, {
        message: "Description must be at least 10 characters.",
    }),
})

export function PromptForm() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true);
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'component',
                    description: values.description,
                    preview: true,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate component');
            }

            const result = await response.json();

            // Store the result in sessionStorage for the builder page
            sessionStorage.setItem('builderResult', JSON.stringify(result));
            sessionStorage.setItem('initialPrompt', values.description);

            // Navigate to the builder page
            router.push('/builder');
        } catch (error) {
            console.error('Error generating component:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>What would you like to build?</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Describe what you want to create..."
                                    className="min-h-32 resize-none bg-muted border-border"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Building...
                        </>
                    ) : (
                        'Build it'
                    )}
                </Button>
            </form>
        </Form>
    );
}