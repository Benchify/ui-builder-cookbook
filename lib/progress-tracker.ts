export interface ProgressStep {
    id: string;
    label: string;
    description: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    startTime?: number;
    endTime?: number;
    error?: string;
}

export interface ProgressState {
    sessionId: string;
    steps: ProgressStep[];
    currentStepIndex: number;
    isComplete: boolean;
    hasError: boolean;
}

// Global stores - use globalThis to survive module reloads in development
declare global {
    var __progressStore: Map<string, ProgressState> | undefined;
    var __progressStaticSubscriptions: Map<string, Set<(state: ProgressState) => void>> | undefined;
}

const progressStore = globalThis.__progressStore || (globalThis.__progressStore = new Map<string, ProgressState>());
const staticSubscriptions = globalThis.__progressStaticSubscriptions || (globalThis.__progressStaticSubscriptions = new Map<string, Set<(state: ProgressState) => void>>());

export class ProgressTracker {
    private sessionId: string;
    private subscribers: Set<(state: ProgressState) => void> = new Set();

    constructor(sessionId: string, steps: Omit<ProgressStep, 'status'>[]) {
        this.sessionId = sessionId;
        const initialSteps: ProgressStep[] = steps.map(step => ({
            ...step,
            status: 'pending'
        }));

        const initialState = {
            sessionId,
            steps: initialSteps,
            currentStepIndex: -1,
            isComplete: false,
            hasError: false
        };
        progressStore.set(sessionId, initialState);
        console.log('🔄 Creating progress tracker for session:', sessionId);
        console.log('📊 Progress tracker created with steps:', steps.map(s => s.label));
    }

    private emitUpdate() {
        const state = progressStore.get(this.sessionId);
        if (state) {
            // Notify instance subscribers
            this.subscribers.forEach(callback => callback(state));

            // Notify static subscribers (for SSE connections)
            const staticCallbacks = staticSubscriptions.get(this.sessionId);
            if (staticCallbacks) {
                staticCallbacks.forEach(callback => callback(state));
            }
        }
    }

    subscribe(callback: (state: ProgressState) => void) {
        this.subscribers.add(callback);
        // Emit current state immediately
        const state = progressStore.get(this.sessionId);
        if (state) {
            callback(state);
        }

        return () => {
            this.subscribers.delete(callback);
        };
    }

    static subscribe(sessionId: string, callback: (state: ProgressState) => void) {
        // Add to static subscriptions first
        if (!staticSubscriptions.has(sessionId)) {
            staticSubscriptions.set(sessionId, new Set());
        }

        const callbacks = staticSubscriptions.get(sessionId)!;
        callbacks.add(callback);

        // Send existing state immediately if it exists
        const existingState = progressStore.get(sessionId);
        if (existingState) {
            callback(existingState);
        } else {
            // Wait for state to be created (handles race condition)
            let attempts = 0;
            const maxAttempts = 20; // 1 second / 50ms

            const pollForState = () => {
                attempts++;
                const state = progressStore.get(sessionId);
                if (state) {
                    callback(state);
                } else if (attempts < maxAttempts) {
                    setTimeout(pollForState, 50);
                }
            };

            setTimeout(pollForState, 50);
        }

        return () => {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                staticSubscriptions.delete(sessionId);
            }
        };
    }

    startStep(stepId: string) {
        console.log('▶️ Starting step:', stepId, 'for session:', this.sessionId);
        const state = progressStore.get(this.sessionId);
        if (!state) return;

        const stepIndex = state.steps.findIndex(step => step.id === stepId);
        if (stepIndex === -1) return;

        // Update step status
        state.steps[stepIndex].status = 'in-progress';
        state.steps[stepIndex].startTime = Date.now();
        state.currentStepIndex = stepIndex;

        progressStore.set(this.sessionId, state);
        this.emitUpdate();
    }

    completeStep(stepId: string) {
        console.log('✅ Completing step:', stepId, 'for session:', this.sessionId);
        const state = progressStore.get(this.sessionId);
        if (!state) return;

        const stepIndex = state.steps.findIndex(step => step.id === stepId);
        if (stepIndex === -1) return;

        // Update step status
        state.steps[stepIndex].status = 'completed';
        state.steps[stepIndex].endTime = Date.now();

        // Check if all steps are complete
        const allComplete = state.steps.every(step => step.status === 'completed');
        if (allComplete) {
            state.isComplete = true;
        }

        progressStore.set(this.sessionId, state);
        this.emitUpdate();
    }

    errorStep(stepId: string, errorMessage: string) {
        const state = progressStore.get(this.sessionId);
        if (!state) return;

        const stepIndex = state.steps.findIndex(step => step.id === stepId);
        if (stepIndex === -1) return;

        // Update step status
        state.steps[stepIndex].status = 'error';
        state.steps[stepIndex].endTime = Date.now();
        state.steps[stepIndex].error = errorMessage;
        state.hasError = true;

        progressStore.set(this.sessionId, state);
        this.emitUpdate();
    }

    getState(): ProgressState | undefined {
        return progressStore.get(this.sessionId);
    }

    cleanup() {
        progressStore.delete(this.sessionId);
        this.subscribers.clear();
    }

    static getProgress(sessionId: string): ProgressState | undefined {
        return progressStore.get(sessionId);
    }
}

export function generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
} 