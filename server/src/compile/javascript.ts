import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { createExecutionPlan } from "./plan";
import { CompileResult, OnCompileUpdate, OutputStream } from "./types";

export const DEFAULT_TIMEOUT_MS = 5_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;

export interface JavaScriptRunOptions {
  onUpdate?: OnCompileUpdate;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

/** Run one JavaScript submission. The callback is the future WebSocket bridge. */
export async function runJavaScript(
  input: unknown,
  options: JavaScriptRunOptions = {}
): Promise<CompileResult> {
  const plan = createExecutionPlan(input);
  if (plan.request.language !== "javascript") {
    throw new Error("runJavaScript only supports JavaScript");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive integer");
  }
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw new RangeError("maxOutputBytes must be a positive integer");
  }

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

  const workDir = await mkdtemp(join(tmpdir(), "littlepointers-js-"));
  try {
    await writeFile(join(workDir, plan.language.sourceFile), plan.request.code, {
      encoding: "utf8",
      flag: "wx",
    });

    if (options.signal?.aborted) {
      result.cancelled = true;
      emitCompletion(result, emit);
      return result;
    }

    emit({ executionId, type: "status", phase: "running" });
    const child = spawn(process.execPath, plan.language.run.args, {
      cwd: workDir,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      // Avoid passing server secrets or NODE_OPTIONS into submitted programs.
      env: {},
    });

    let outputBytes = 0;
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
    }, timeoutMs);

    try {
      child.stdin.end(plan.request.stdin ?? "");
      const outcome = await new Promise<{
        code: number | null;
        signal: NodeJS.Signals | null;
        error?: Error;
      }>((resolve) => {
        let spawnError: Error | undefined;
        child.once("error", (error) => {
          spawnError = error;
        });
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
      emitCompletion(result, emit);
      return result;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
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
