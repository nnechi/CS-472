import { runSubmission, RunOptions } from "./runner";
import { CompileResult } from "./types";

export type { RunOptions as TypeScriptRunOptions } from "./runner";

/** Type-check and compile TypeScript, then run the emitted JavaScript. */
export function runTypeScript(
  input: unknown,
  options: RunOptions = {}
): Promise<CompileResult> {
  return runSubmission(input, "typescript", options);
}
