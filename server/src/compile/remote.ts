import { runSubmission, Runner } from "./runner";
import { CompileResult, CompileUpdate } from "./types";

// Runs code through the runner service (runner/), which starts a locked-down
// sandbox container for each run. The server itself never runs student code
// unless ALLOW_UNSANDBOXED_RUNS=1 is set for local development.

// The runner ends every run within 30 s (its backstop) and says so. This limit
// is for when the runner itself hangs: a run never holds a queue slot longer.
const REMOTE_TIMEOUT_MS = 35_000;
const TIMEOUT_MESSAGE = "The code runner took too long to answer. Try again.";

// A runner that sends each run to the runner service at baseUrl and turns its
// stream (one JSON object per line) back into onUpdate calls and a result.
// Throws with a message the student can read when the run can't happen.
export function createRemoteRunner(baseUrl: string, token = ""): Runner {
  const url = new URL("/run", baseUrl).toString();

  return async (request, options) => {
    // Stop (options.signal) or the time limit, whichever comes first.
    const timeout = AbortSignal.timeout(REMOTE_TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ language: request.language, code: request.code, stdin: request.stdin }),
        // Aborting (Stop, the student left, or the time limit) closes the
        // request, and the runner removes the container.
        signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (timeout.aborted) throw new Error(TIMEOUT_MESSAGE);
      console.error("[compile] runner unreachable:", error);
      throw new Error("The code runner isn't available right now. Try again in a moment.");
    }

    if (response.status === 503) throw new Error("Lots of people are running code. Try again in a moment.");
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      console.error(`[compile] runner answered ${response.status}:`, detail.slice(0, 300));
      throw new Error(response.status === 400 ? "That code can't be run." : "The code runner failed. Try again.");
    }

    const decoder = new TextDecoder();
    let pending = "";
    let result: CompileResult | null = null;

    // Returns true once the run is over (a result or a fatal error).
    const handleLine = (line: string): boolean => {
      if (!line.trim()) return false;
      let value: any;
      try {
        value = JSON.parse(line);
      } catch {
        return false;
      }
      if (value?.type === "result") {
        result = toResult(value.result);
        return true;
      }
      if (value?.type === "fatal") {
        throw new Error(typeof value.message === "string" ? value.message : "The code runner failed. Try again.");
      }
      const update = toUpdate(value);
      if (update) {
        try {
          options.onUpdate?.(update);
        } catch (error) {
          console.error("[compile] update callback failed:", error);
        }
      }
      return false;
    };

    try {
      for await (const chunk of response.body) {
        pending += decoder.decode(chunk as Uint8Array, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) if (handleLine(line)) return result!;
      }
    } catch (error) {
      // A Stop and fatal lines pass through as they are; only the time limit
      // gets its own message.
      if (!options.signal?.aborted && timeout.aborted) {
        console.error("[compile] runner timed out mid-run");
        throw new Error(TIMEOUT_MESSAGE);
      }
      throw error;
    }
    pending += decoder.decode();
    if (handleLine(pending) && result) return result;

    if (options.signal?.aborted) throw new Error("Cancelled");
    throw new Error("The code runner stopped before the run finished. Try again.");
  };
}

// The runner's result, with every field checked, since it comes over the network.
function toResult(raw: any): CompileResult {
  return {
    executionId: String(raw?.executionId ?? ""),
    stdout: typeof raw?.stdout === "string" ? raw.stdout : "",
    stderr: typeof raw?.stderr === "string" ? raw.stderr : "",
    exitCode: Number.isInteger(raw?.exitCode) ? raw.exitCode : null,
    signal: typeof raw?.signal === "string" ? raw.signal : null,
    timedOut: raw?.timedOut === true,
    cancelled: raw?.cancelled === true,
    outputLimitExceeded: raw?.outputLimitExceeded === true,
  };
}

// One update from the runner, or null if it isn't a kind the queue uses.
function toUpdate(raw: any): CompileUpdate | null {
  const executionId = String(raw?.executionId ?? "");
  if (raw?.type === "output" && (raw.stream === "stdout" || raw.stream === "stderr") && typeof raw.chunk === "string") {
    return { executionId, type: "output", stream: raw.stream, chunk: raw.chunk };
  }
  if (raw?.type === "status" && (raw.phase === "compiling" || raw.phase === "running")) {
    return { executionId, type: "status", phase: raw.phase };
  }
  return null;
}

let warnedUnsandboxed = false;

// The runner the server's queue uses, chosen by environment when a run starts:
//   RUNNER_URL set             -> the runner service (RUNNER_TOKEN sent if set)
//   ALLOW_UNSANDBOXED_RUNS=1   -> run on this server directly (local development only!)
//   neither                    -> runs are refused, so code never runs unsandboxed by accident
export const defaultRunner: Runner = (request, options) => {
  const runnerUrl = process.env.RUNNER_URL;
  if (runnerUrl) return createRemoteRunner(runnerUrl, process.env.RUNNER_TOKEN ?? "")(request, options);

  if (process.env.ALLOW_UNSANDBOXED_RUNS === "1") {
    if (!warnedUnsandboxed) {
      warnedUnsandboxed = true;
      console.warn("[compile] ALLOW_UNSANDBOXED_RUNS=1: student code runs directly on this server. Never use this in production.");
    }
    return runSubmission(request, request.language, options);
  }

  return Promise.reject(new Error("Running code isn't set up on this server."));
};
