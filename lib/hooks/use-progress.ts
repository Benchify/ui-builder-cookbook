import { useEffect, useState, useRef } from 'react';
import { ProgressState } from '@/lib/progress-tracker';

interface UseProgressReturn {
    progress: ProgressState | null;
    isConnected: boolean;
    error: string | null;
}

export function useProgress(sessionId: string | null): UseProgressReturn {
    const [progress, setProgress] = useState<ProgressState | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!sessionId) {
            return;
        }

        // Close existing connection if any
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        const eventSource = new EventSource(`/api/progress/${sessionId}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setIsConnected(true);
            setError(null);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'connected') {
                    console.log('✅ Connected to progress stream:', data.sessionId);
                } else if (data.type === 'progress') {
                    console.log('📊 Progress update:', data.data.steps[data.data.currentStepIndex]?.label || 'Unknown step');
                    setProgress(data.data);
                }
            } catch (err) {
                console.error('Error parsing SSE data:', err);
                setError('Failed to parse progress data');
            }
        };

        eventSource.onerror = (event) => {
            console.error('SSE connection error for session:', sessionId, event);
            setIsConnected(false);
            setError('Connection to progress stream failed');
        };

        return () => {
            eventSource.close();
            eventSourceRef.current = null;
        };
    }, [sessionId]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    return {
        progress,
        isConnected,
        error
    };
} 