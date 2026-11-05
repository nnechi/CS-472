import { runSubmission, RunOptions } from "./runner";
import { CompileResult } from "./types";

export type { RunOptions as PythonRunOptions } from "./runner";

/** Execute one Python source file with unbuffered output. */
export function runPython(
  input: unknown,
  options: RunOptions = {}
): Promise<CompileResult> {
  return runSubmission(input, "python", options);
}
