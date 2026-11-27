export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES_PER_ACCOUNT = 10;
export const LOGIN_MAX_FAILURES_PER_IP = 100;
const SWEEP_AT_SIZE = 10_000;

export interface FailureLimiter {
    retryAfterMs(key: string, now?: number): number;
    fail(key: string, now?: number): void;
    reset(key: string): void;
}

export function createFailureLimiter(maxFailures: number, windowMs = LOGIN_WINDOW_MS): FailureLimiter {
    const failures = new Map<string, number[]>();

    const recent = (key: string, now: number): number[] => {
        const kept = (failures.get(key) ?? []).filter((at) => at > now - windowMs);
        if (kept.length > 0) failures.set(key, kept);
        else failures.delete(key);
        return kept;
    };

    const sweep = (now: number) => {
        if (failures.size < SWEEP_AT_SIZE) return;
        for (const key of [...failures.keys()]) recent(key, now);
    };

    return {
        retryAfterMs(key, now = Date.now()) {
            const kept = recent(key, now);
            return kept.length >= maxFailures ? kept[kept.length - maxFailures] + windowMs - now : 0;
        },
        fail(key, now = Date.now()) {
            sweep(now);
            const kept = recent(key, now);
            kept.push(now);
            failures.set(key, kept.slice(-maxFailures));
        },
        reset(key) {
            failures.delete(key);
        },
    };
}
