import { LANGUAGE_SPECS } from "./languages";
import {
  COMPILE_LANGUAGES,
  CompileLanguage,
  CompileRequest,
  ExecutionPlan,
} from "./types";

export const MAX_CODE_BYTES = 64 * 1024;
export const MAX_STDIN_BYTES = 32 * 1024;

export class InvalidCompileRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCompileRequestError";
  }
}

export function createExecutionPlan(input: unknown): ExecutionPlan {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new InvalidCompileRequestError("Expected a compile request object");
  }

  const candidate = input as Record<string, unknown>;
  if (
    typeof candidate.language !== "string" ||
    !COMPILE_LANGUAGES.includes(candidate.language as CompileLanguage)
  ) {
    throw new InvalidCompileRequestError("Unsupported language");
  }
  if (typeof candidate.code !== "string" || !candidate.code.trim()) {
    throw new InvalidCompileRequestError("Code must be a non-empty string");
  }
  if (Buffer.byteLength(candidate.code, "utf8") > MAX_CODE_BYTES) {
    throw new InvalidCompileRequestError("Code exceeds the size limit");
  }
  if (
    candidate.stdin !== undefined &&
    (typeof candidate.stdin !== "string" ||
      Buffer.byteLength(candidate.stdin, "utf8") > MAX_STDIN_BYTES)
  ) {
    throw new InvalidCompileRequestError("Invalid or oversized stdin");
  }

  const language = candidate.language as CompileLanguage;
  const request: CompileRequest = {
    language,
    code: candidate.code,
    ...(candidate.stdin === undefined ? {} : { stdin: candidate.stdin as string }),
  };
  return { request, language: LANGUAGE_SPECS[language] };
}
