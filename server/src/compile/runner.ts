import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { createExecutionPlan } from "./plan";
import {
  CommandSpec,
  CompilePhase,
  CompileResult,
  OnCompileUpdate,
  OutputStream,
} from "./types";

export const DEFAULT_TIMEOUT_MS = 5_000;
export const DEFAULT_COMPILE_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;

export interface RunOptions {
  onUpdate?: OnCompileUpdate;
  signal?: AbortSignal;
  timeoutMs?: number;
  compileTimeoutMs?: number;
  maxOutputBytes?: number;
}

/** Shared process and output handling for supported submission runners. */
export async function runSubmission(
  input: unknown,
  expectedLanguage: "javascript" | "typescript" | "python",
  options: RunOptions = {}
): Promise<CompileResult> {
  const plan = createExecutionPlan(input);
  if (plan.request.language !== expectedLanguage) {
    const name = { javascript: "JavaScript", typescript: "TypeScript", python: "Python" }[expectedLanguage];
    throw new Error(`run${name} only supports ${name}`);
  }

  const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, "timeoutMs");
  const compileTimeoutMs = positiveInteger(
    options.compileTimeoutMs,
    DEFAULT_COMPILE_TIMEOUT_MS,
    "compileTimeoutMs"
  );
  const maxOutputBytes = positiveInteger(
    options.maxOutputBytes,
    DEFAULT_MAX_OUTPUT_BYTES,
    "maxOutputBytes"
  );

  const executionId = randomUUID();
  const emit: OnCompileUpdate = (update) => {
    try {
      options.onUpdate?.(update);
    } catch (error) {
      // A WebSocket delivery failure must not crash the process running code.
      console.error("[compile] update callback failed:", error);
    }
  };
  const result: CompileResult = {
    executionId,
    stdout: "",
    stderr: "",
    exitCode: null,
    signal: null,
    timedOut: false,
    cancelled: false,
    outputLimitExceeded: false,
  };

  if (options.signal?.aborted) {
    result.cancelled = true;
    emitCompletion(result, emit);
    return result;
  }

  const workDir = await mkdtemp(join(tmpdir(), "littlepointers-code-"));
  try {
    await writeFile(join(workDir, plan.language.sourceFile), plan.request.code, {
      encoding: "utf8",
      flag: "wx",
    });

    let outputBytes = 0;
    const runStage = async (
      phase: CompilePhase,
      command: CommandSpec,
      stageTimeoutMs: number,
      stdin: string
    ): Promise<void> => {
      result.exitCode = null;
      result.signal = null;
      if (options.signal?.aborted) {
        result.cancelled = true;
        return;
      }

      emit({ executionId, type: "status", phase });
      const executable = command.executable === "tsc" || command.executable === "node"
        ? process.execPath
        : command.executable;
      const args = command.executable === "tsc"
        ? [require.resolve("typescript/bin/tsc"), ...command.args]
        : command.args;
      const child = spawn(executable, args, {
        cwd: workDir,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        // Do not pass server secrets or NODE_OPTIONS into submitted programs.
        env: {},
      });

      const decoders = {
        stdout: new StringDecoder("utf8"),
        stderr: new StringDecoder("utf8"),
      };
      const onChunk = (stream: OutputStream, chunk: Buffer) => {
        if (result.outputLimitExceeded) return;
        const remaining = maxOutputBytes - outputBytes;
        const accepted = chunk.subarray(0, remaining);
        outputBytes += accepted.length;
        const text = decoders[stream].write(accepted);
        if (text) {
          result[stream] += text;
          emit({ executionId, type: "output", stream, chunk: text });
        }
        if (chunk.length > remaining || outputBytes >= maxOutputBytes) {
          result.outputLimitExceeded = true;
          child.kill();
        }
      };
      child.stdout.on("data", (chunk: Buffer) => onChunk("stdout", chunk));
      child.stderr.on("data", (chunk: Buffer) => onChunk("stderr", chunk));
      // A program can exit before consuming stdin; EPIPE is expected then.
      child.stdin.on("error", () => {});

      const onAbort = () => {
        result.cancelled = true;
        child.kill();
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted) onAbort();

      const timer = setTimeout(() => {
        result.timedOut = true;
        child.kill();
      }, stageTimeoutMs);
      try {
        child.stdin.end(stdin);
        const outcome = await new Promise<{
          code: number | null;
          signal: NodeJS.Signals | null;
          error?: Error;
        }>((resolve) => {
          let spawnError: Error | undefined;
          child.once("error", (error) => { spawnError = error; });
          child.once("close", (code, signal) => {
            resolve({ code, signal, error: spawnError });
          });
        });

        for (const stream of ["stdout", "stderr"] as const) {
          const tail = decoders[stream].end();
          if (tail) {
            result[stream] += tail;
            emit({ executionId, type: "output", stream, chunk: tail });
          }
        }
        result.exitCode = outcome.code;
        result.signal = outcome.signal;
        if (outcome.error) {
          emit({ executionId, type: "error", message: outcome.error.message });
        }
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
      }
    };

    if (plan.language.compile) {
      await runStage("compiling", plan.language.compile, compileTimeoutMs, "");
    }
    if (
      !result.cancelled &&
      !result.timedOut &&
      !result.outputLimitExceeded &&
      (plan.language.compile === undefined || result.exitCode === 0)
    ) {
      await runStage("running", plan.language.run, timeoutMs, plan.request.stdin ?? "");
    }

    emitCompletion(result, emit);
    return result;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  const actual = value ?? fallback;
  if (!Number.isSafeInteger(actual) || actual <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return actual;
}

function emitCompletion(result: CompileResult, emit: OnCompileUpdate): void {
  emit({
    executionId: result.executionId,
    type: "complete",
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    cancelled: result.cancelled,
    outputLimitExceeded: result.outputLimitExceeded,
  });
}
