import { runSubmission, RunOptions } from "./runner";
import { CompileResult } from "./types";

export type { RunOptions as JavaRunOptions } from "./runner";

/** Compile Main.java, then execute Main only when compilation succeeds. */
export function runJava(
  input: unknown,
  options: RunOptions = {}
): Promise<CompileResult> {
  return runSubmission(input, "java", options);
}
