import { RUN_OUTPUT_MAX_LENGTH, STUDENT_CODE_MAX_LENGTH, type RunResult } from "./types";

// Client output is work to display, never evidence of a trusted grade. Accept
// only the exact current source and copy known fields rather than client metadata.
export function parseBrowserRun(payload: unknown, codes: readonly string[]): { questionIndex: number; result: RunResult } | null {
  if (!payload || typeof payload !== "object") return null;
  const { questionIndex, code, result } = payload as Record<string, unknown>;
  if (typeof questionIndex !== "number" || !Number.isInteger(questionIndex) || questionIndex < 0 ||
      typeof code !== "string" || code.length > STUDENT_CODE_MAX_LENGTH || codes[questionIndex] !== code ||
      !result || typeof result !== "object") return null;
  const raw = result as Record<string, unknown>;
  if (typeof raw.stdout !== "string" || typeof raw.stderr !== "string" ||
      raw.stdout.length > RUN_OUTPUT_MAX_LENGTH || raw.stderr.length > RUN_OUTPUT_MAX_LENGTH ||
      !(raw.exitCode === null || (typeof raw.exitCode === "number" && Number.isSafeInteger(raw.exitCode))) ||
      typeof raw.timedOut !== "boolean" || typeof raw.outputLimitExceeded !== "boolean") return null;
  return { questionIndex, result: {
    stdout: raw.stdout, stderr: raw.stderr, exitCode: raw.exitCode,
    timedOut: raw.timedOut, outputLimitExceeded: raw.outputLimitExceeded,
    finishedAt: new Date().toISOString(),
  } };
}

export const MAX_RUN_REPORTS_PER_MINUTE = 10;
export const RUN_REPORT_WINDOW_MS = 60_000;

export function allowRunReport(history: number[], now = Date.now()): boolean {
  while (history.length > 0 && history[0] <= now - RUN_REPORT_WINDOW_MS) history.shift();
  if (history.length >= MAX_RUN_REPORTS_PER_MINUTE) return false;
  history.push(now);
  return true;
}
