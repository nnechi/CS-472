import { runSubmission, RunOptions } from "./runner";
import { CompileResult } from "./types";

export type { RunOptions as CRunOptions } from "./runner";

/** Compile main.c, then execute the program only when compilation succeeds. */
export function runC(
  input: unknown,
  options: RunOptions = {}
): Promise<CompileResult> {
  return runSubmission(input, "c", options);
}
