import { runSubmission, RunOptions } from "./runner";
import { CompileResult } from "./types";

export {
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_TIMEOUT_MS,
} from "./runner";
export type { RunOptions as JavaScriptRunOptions } from "./runner";

/** Run one JavaScript submission; onUpdate can forward text to a WebSocket. */
export function runJavaScript(
  input: unknown,
  options: RunOptions = {}
): Promise<CompileResult> {
  return runSubmission(input, "javascript", options);
}
