import { useState, useEffect } from 'react';

export function useLiveTimer(startTime?: number, endTime?: number, isActive?: boolean) {
    const [elapsedTime, setElapsedTime] = useState<number>(0);

    useEffect(() => {
        if (!startTime || endTime || !isActive) {
            return;
        }

        // Update immediately
        setElapsedTime(Date.now() - startTime);

        // Set up interval to update every 100ms for smooth updates
        const interval = setInterval(() => {
            setElapsedTime(Date.now() - startTime);
        }, 100);

        return () => clearInterval(interval);
    }, [startTime, endTime, isActive]);

    // If step is completed, return the actual duration
    if (startTime && endTime) {
        return endTime - startTime;
    }

    // If step is active and has start time, return live elapsed time
    if (startTime && isActive && !endTime) {
        return elapsedTime;
    }

    return 0;
} 