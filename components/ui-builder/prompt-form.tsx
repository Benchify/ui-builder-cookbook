// components/ui-builder/prompt-form.tsx
'use client';

import { useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';

const formSchema = z.object({
    description: z.string().min(10, {
        message: "Description must be at least 10 characters.",
    }),
    useBuggyCode: z.boolean(),
    useFixer: z.boolean(),
})

export function PromptForm() {
    const router = useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: "",
            useBuggyCode: false,
            useFixer: false,
        },
    })

    // Watch the useBuggyCode field to auto-populate description
    const watchUseBuggyCode = form.watch('useBuggyCode');
    const currentDescription = form.watch('description');

    useEffect(() => {
        const buggyCodeText = 'Create a simple React app with a title "Welcome to my app" and a Hello World message displayed in a div';

        if (watchUseBuggyCode && currentDescription !== buggyCodeText) {
            form.setValue('description', buggyCodeText);
        } else if (!watchUseBuggyCode && currentDescription === buggyCodeText) {
            form.setValue('description', '');
        }
    }, [watchUseBuggyCode]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        // Store the prompt and settings in sessionStorage and navigate immediately
        sessionStorage.setItem('initialPrompt', values.description);
        sessionStorage.setItem('useBuggyCode', values.useBuggyCode.toString());
        sessionStorage.setItem('useFixer', values.useFixer.toString());
        sessionStorage.removeItem('builderResult'); // Clear any previous result

        // Navigate to the chat page immediately
        router.push('/chat');
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="useBuggyCode"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                        Use Buggy Code
                                    </FormLabel>
                                    <div className="text-sm text-muted-foreground">
                                        Use hardcoded code with issues for testing
                                    </div>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="useFixer"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                        Use Fixer
                                    </FormLabel>
                                    <div className="text-sm text-muted-foreground">
                                        Apply Benchify fixer to repair code issues
                                    </div>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>

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