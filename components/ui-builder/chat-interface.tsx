'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { benchifyFileSchema } from '@/lib/schemas';
import { z } from 'zod';

interface Message {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ChatInterfaceProps {
    initialPrompt: string;
    onUpdateResult: (result: {
        repairedFiles?: z.infer<typeof benchifyFileSchema>;
        originalFiles?: z.infer<typeof benchifyFileSchema>;
        buildOutput: string;
        previewUrl: string;
    }) => void;
}

export function ChatInterface({ initialPrompt, onUpdateResult }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            type: 'user',
            content: initialPrompt,
            timestamp: new Date(),
        },
        {
            id: '2',
            type: 'assistant',
            content: "I've generated your UI component! You can see the preview on the right. What would you like to modify or improve?",
            timestamp: new Date(),
        },
    ]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            type: 'user',
            content: newMessage,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setNewMessage('');
        setIsLoading(true);

        try {
            // Here you would call your API to process the new request
            // For now, we'll add a placeholder response
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: 'assistant',
                content: "I understand your request. Let me update the component for you...",
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);

            // TODO: Implement actual regeneration with the new prompt
            // This would call your generate API with the conversation context

        } catch (error) {
            console.error('Error processing message:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: 'assistant',
                content: "I'm sorry, there was an error processing your request. Please try again.",
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleStartOver = () => {
        // Clear session storage and redirect to home
        sessionStorage.removeItem('builderResult');
        sessionStorage.removeItem('initialPrompt');
        window.location.href = '/';
    };

    return (
        <Card className="h-full flex flex-col border-0 rounded-none">
            <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Chat</CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStartOver}
                        className="h-8 px-2"
                    >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Start Over
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] p-3 rounded-lg ${message.type === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    <p className="text-xs opacity-70 mt-1">
                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-muted text-muted-foreground p-3 rounded-lg">
                                    <div className="flex items-center space-x-2">
                                        <div className="animate-pulse flex space-x-1">
                                            <div className="w-2 h-2 bg-current rounded-full"></div>
                                            <div className="w-2 h-2 bg-current rounded-full"></div>
                                            <div className="w-2 h-2 bg-current rounded-full"></div>
                                        </div>
                                        <span className="text-sm">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div ref={messagesEndRef} />
                </ScrollArea>

                <div className="p-4 border-t">
                    <div className="flex space-x-2">
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Describe your changes..."
                            disabled={isLoading}
                            className="flex-1"
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() || isLoading}
                            size="sm"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 