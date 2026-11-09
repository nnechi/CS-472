import { runSubmission, RunOptions } from "./runner";
import { CompileResult } from "./types";

export type { RunOptions as CppRunOptions } from "./runner";

/** Compile main.cpp as C++17, then execute it when compilation succeeds. */
export function runCpp(input: unknown, options: RunOptions = {}): Promise<CompileResult> {
  return runSubmission(input, "cpp", options);
}
