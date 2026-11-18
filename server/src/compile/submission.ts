export const MAX_RUNS_PER_MINUTE = 5;
export const RUN_WINDOW_MS = 60_000;

// One in-memory history per socket. This limits accidental rapid retries;
// reconnecting creates a new socket and resets its history.
export function allowCodeRun(history: number[], now = Date.now()): boolean {
  while (history.length > 0 && history[0] <= now - RUN_WINDOW_MS) {
    history.shift();
  }
  if (history.length >= MAX_RUNS_PER_MINUTE) return false;
  history.push(now);
  return true;
}
