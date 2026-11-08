import { runSubmission } from "./runner";
import { InvalidCompileRequestError, MAX_CODE_BYTES, MAX_STDIN_BYTES } from "./plan";
import { CompileLanguage, CompileUpdate } from "./types";

// Entry point inside a sandbox container (see server/Dockerfile.sandbox and
// runner/src/index.ts). Runs exactly one request and exits:
//
//   stdin:  one JSON request, { language, code, stdin? }
//   stdout: one JSON object per line, the stream the runner service forwards
//           to remote.ts: "status" and "output" lines, then a last "result"
//           or "fatal" line
//   stderr: diagnostics for the runner's log, never shown to students
//
// Nothing else may write to stdout, so debug output must use console.error.

// Code and stdin limits plus room for the JSON around them. createExecutionPlan
// checks the real limits; this only stops an oversized input from filling memory.
const MAX_INPUT_BYTES = MAX_CODE_BYTES + MAX_STDIN_BYTES + 16 * 1024;

function send(line: object): void {
  // JSON.stringify escapes newlines inside strings, so this is always one line.
  process.stdout.write(JSON.stringify(line) + "\n");
}

function fail(message: string): void {
  send({ type: "fatal", message });
  process.exitCode = 1;
}

async function readInput(): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += (chunk as Buffer).length;
    if (size > MAX_INPUT_BYTES) throw new InvalidCompileRequestError("Request is too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// remote.ts only uses status and output updates; "complete" and "error" are
// covered by the final result or fatal line.
function forward(update: CompileUpdate): void {
  if (update.type === "status" || update.type === "output") send(update);
}

async function main(): Promise<void> {
  let request: unknown;
  try {
    request = JSON.parse(await readInput());
  } catch (error) {
    // Too large, or not JSON.
    console.error("[sandbox] unreadable request:", error);
    return fail("That code can't be run.");
  }

  // createExecutionPlan (inside runSubmission) checks the language before it is
  // used, so passing it through as the expected language is safe.
  const language = (request as { language?: unknown } | null)?.language as CompileLanguage;

  try {
    const result = await runSubmission(request, language, { onUpdate: forward });
    send({ type: "result", result });
  } catch (error) {
    if (error instanceof InvalidCompileRequestError) return fail(error.message);
    console.error("[sandbox] run failed:", error);
    fail("The code runner failed. Try again.");
  }
}

// Let the process exit on its own (instead of process.exit) so stdout is
// fully flushed into the pipe before the container stops.
main().catch(error => {
  console.error("[sandbox] unexpected error:", error);
  fail("The code runner failed. Try again.");
});
