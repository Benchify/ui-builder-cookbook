// components/ui-builder/prompt-form.tsx
'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
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
    const router = useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        // Store the prompt in sessionStorage and navigate immediately
        sessionStorage.setItem('initialPrompt', values.description);
        sessionStorage.removeItem('builderResult'); // Clear any previous result

        // Navigate to the chat page immediately
        router.push('/chat');
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
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                    Build it
                </Button>
            </form>
        </Form>
    );
}