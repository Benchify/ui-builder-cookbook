import { useLiveTimer } from '@/lib/hooks/use-live-timer';
import { ProgressStep } from '@/lib/progress-tracker';

interface StepTimerProps {
    step: ProgressStep;
}

export function StepTimer({ step }: StepTimerProps) {
    const isActive = step.status === 'in-progress';
    const elapsed = useLiveTimer(step.startTime, step.endTime, isActive);

    if (!step.startTime || elapsed === 0) {
        return null;
    }

    const seconds = (elapsed / 1000).toFixed(1);
    const isCompleted = step.status === 'completed';

    return (
        <p className="text-xs text-muted-foreground/50 mt-1">
            {isCompleted ? `Completed in ${seconds}s` : `Running for ${seconds}s`}
        </p>
    );
} 