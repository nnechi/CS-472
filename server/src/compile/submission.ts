import { createExecutionPlan, InvalidCompileRequestError } from "./plan";

export const MAX_RUNS_PER_MINUTE = 5;
export const RUN_WINDOW_MS = 60_000;

export interface CodeReceipt {
  language: "javascript" | "typescript";
  bytes: number;
}

// Validate what arrived over the socket. Receipt does not compile, run, or
// retain the submitted source code.
export function receiveCode(input: unknown): CodeReceipt {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new InvalidCompileRequestError("Expected a code submission object");
  }
  const fields = Object.keys(input);
  if (fields.length !== 2 || !fields.includes("language") || !fields.includes("code")) {
    throw new InvalidCompileRequestError("Send only language and code");
  }
  if (typeof (input as { code?: unknown }).code === "string" &&
      (input as { code: string }).code.includes("\0")) {
    throw new InvalidCompileRequestError("Code cannot contain NUL characters");
  }

  const { request } = createExecutionPlan(input);
  if (request.language !== "javascript" && request.language !== "typescript") {
    throw new InvalidCompileRequestError("Only JavaScript and TypeScript are available here");
  }
  return {
    language: request.language,
    bytes: Buffer.byteLength(request.code, "utf8"),
  };
}

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
