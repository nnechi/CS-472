export const COMPILE_LANGUAGES = [
  "javascript",
  "typescript",
  "c",
  "cpp",
  "java",
  "python",
] as const;

export type CompileLanguage = (typeof COMPILE_LANGUAGES)[number];

export interface CompileRequest {
  language: CompileLanguage;
  code: string;
  stdin?: string;
}

export type CompilePhase = "compiling" | "running";
export type OutputStream = "stdout" | "stderr";

// The caller decides whether these updates go to Socket.IO, another WebSocket
// implementation, or a test harness. Every update belongs to one execution.
export type CompileUpdate =
  | { executionId: string; type: "status"; phase: CompilePhase }
  | { executionId: string; type: "output"; stream: OutputStream; chunk: string }
  | {
      executionId: string;
      type: "complete";
      exitCode: number | null;
      signal: string | null;
      timedOut: boolean;
      cancelled: boolean;
    }
  | { executionId: string; type: "error"; message: string };

export type OnCompileUpdate = (update: CompileUpdate) => void;

export interface CommandSpec {
  executable: string;
  args: readonly string[];
}

export interface LanguageSpec {
  sourceFile: string;
  compile?: CommandSpec;
  run: CommandSpec;
}

export interface ExecutionPlan {
  request: CompileRequest;
  language: LanguageSpec;
}
