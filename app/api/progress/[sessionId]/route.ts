import { NextRequest } from 'next/server';
import { ProgressTracker } from '@/lib/progress-tracker';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const { sessionId } = await params;
    console.log('📡 SSE connection request for session:', sessionId);

    // Set up Server-Sent Events
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            // Send initial connection message
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`)
            );

            // Subscribe to progress updates for this session
            // The subscription will automatically send current state if it exists
            const unsubscribe = ProgressTracker.subscribe(sessionId, (state) => {
                try {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'progress', data: state })}\n\n`)
                    );
                } catch (error) {
                    console.error('Error sending SSE update:', error);
                }
            });

            // Clean up when the connection is closed
            request.signal.addEventListener('abort', () => {
                unsubscribe();
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Cache-Control',
        },
    });
} 