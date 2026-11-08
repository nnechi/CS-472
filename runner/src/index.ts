import { ChildProcess, execFile, spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import http, { IncomingMessage, ServerResponse } from "node:http";

// The runner service. The server's remote.ts POSTs each code run here; this
// starts one locked-down sandbox container for it (server/Dockerfile.sandbox)
// and streams the container's stdout back as the response, one JSON object
// per line. sandbox.ts (server/src/compile) runs inside each container.
//
// This process has Docker access, which is root on the host. It must never run
// student code itself and must not be reachable from outside the compose network.

const PORT = positiveInteger(process.env.PORT, 4000);
// Required. This service can start containers on the host, so it never runs
// without a token, however it's started.
const RUNNER_TOKEN = process.env.RUNNER_TOKEN ?? "";
if (!RUNNER_TOKEN.trim()) {
  console.error("[runner] RUNNER_TOKEN is not set. Refusing to start: anyone who could reach this port could run code.");
  console.error("[runner] Generate one with: openssl rand -hex 32");
  process.exit(1);
}
const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? "littlepointers-sandbox";
// The same MAX_CONCURRENT_RUNS the server's queue reads (docker-compose.yml
// gives both the one value). The server's queue is the real limit; this is a
// backstop.
const MAX_CONCURRENT = positiveInteger(process.env.MAX_CONCURRENT_RUNS, 2);

// Code and stdin limits (server/src/compile/plan.ts) plus JSON overhead, with
// room to spare. The sandbox checks the real limits.
const MAX_BODY_BYTES = 1024 * 1024;
// Well above the sandbox's own limits (10 s compile + 5 s run) plus container
// start. Only reached if something inside the sandbox hangs.
const BACKSTOP_MS = 30_000;
// How long a run waits for a free slot before getting a 503. The server's queue
// frees its slot as soon as a run's result arrives, but this service frees its
// own only once Docker has removed the container, a moment later. Without a
// short wait, the server's next queued run lands in that gap and fails.
const SLOT_WAIT_MS = 5_000;
// SLOT_WAIT_MS + BACKSTOP_MS must stay below REMOTE_TIMEOUT_MS in
// server/src/compile/remote.ts, or the server gives up on a run first.

// Keep in sync with COMPILE_LANGUAGES in server/src/compile/types.ts. This is a
// separate package, so it can't import it.
const LANGUAGES = new Set(["javascript", "typescript", "c", "cpp", "java", "python"]);

// Every sandbox container gets this label, so leftovers can be found and removed.
const RUN_LABEL = "littlepointers.run=1";

const SANDBOX_FLAGS = [
  "run", "--rm", "-i",
  "--pull", "never",                       // never fetch an image from a registry
  "--label", RUN_LABEL,
  "--network", "none",                     // no internet, no Mongo, no server
  "--memory", "512m", "--memory-swap", "512m",
  "--cpus", "1",
  "--pids-limit", "128",                   // stops fork bombs; threads count too, and the JVM and node use many
  "--read-only",
  "--tmpfs", "/tmp:rw,exec,size=64m",      // runSubmission's work dir; exec for C/C++ binaries
  "--cap-drop", "ALL",
  "--security-opt", "no-new-privileges",
  "--user", "1000:1000",
  "--ulimit", "nofile=256",
  "--log-driver", "none",                  // Docker keeps no copy of student output
];

interface RunBody {
  language: string;
  code: string;
  stdin?: string;
}

// Names of containers currently running, for shutdown.
const activeRuns = new Set<string>();

// Run slots. A slot is taken before a container starts and given back once the
// container is gone. Runs that arrive while all are taken wait here, in order.
let slotsInUse = 0;
const slotWaiters: ((granted: boolean) => void)[] = [];

// Takes a slot, waiting up to SLOT_WAIT_MS for one. False if none came free in
// time or the client went away while waiting.
function acquireSlot(res: ServerResponse): Promise<boolean> {
  if (slotsInUse < MAX_CONCURRENT) {
    slotsInUse++;
    return Promise.resolve(true);
  }
  return new Promise(resolve => {
    const settle = (granted: boolean) => {
      clearTimeout(timer);
      res.off("close", onClose);
      const i = slotWaiters.indexOf(settle);
      if (i !== -1) slotWaiters.splice(i, 1);
      resolve(granted);
    };
    const onClose = () => settle(false);
    const timer = setTimeout(() => settle(false), SLOT_WAIT_MS);
    res.on("close", onClose);
    slotWaiters.push(settle);
  });
}

// Gives a slot back: straight to the longest-waiting run if there is one.
function releaseSlot(): void {
  const next = slotWaiters[0];
  if (next) next(true); // the slot passes on, so slotsInUse stays the same
  else slotsInUse--;
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error("[runner] request failed:", error);
    if (!res.headersSent) sendStatus(res, 500, "Internal error");
    else res.end();
  });
});

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? "/", "http://runner").pathname;

  if (req.method === "GET" && path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, active: slotsInUse, waiting: slotWaiters.length, max: MAX_CONCURRENT }));
    return;
  }
  if (req.method !== "POST" || path !== "/run") return sendStatus(res, 404, "Not found");

  if (!authorized(req.headers.authorization)) return sendStatus(res, 401, "Unauthorized");

  const raw = await readBody(req);
  if (raw === null) {
    // Too large. Close the connection rather than reading the rest.
    res.writeHead(400, { "Content-Type": "text/plain", Connection: "close" });
    res.end("Request is too large", () => req.destroy());
    return;
  }

  const body = parseBody(raw);
  if (!body) return sendStatus(res, 400, "Invalid run request");

  if (!(await acquireSlot(res))) {
    if (!res.destroyed) sendStatus(res, 503, "Runner is busy");
    return;
  }
  // The client may have gone away just as the slot came free.
  if (res.destroyed) return releaseSlot();

  run(body, res);
}

// Starts the sandbox container and streams its output into res.
function run(body: RunBody, res: ServerResponse): void {
  const name = `run-${randomUUID()}`;
  activeRuns.add(name);

  const docker = spawn("docker", [...SANDBOX_FLAGS, "--name", name, SANDBOX_IMAGE], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });

  let responseEnded = false;
  let lastByte = "\n"; // last byte forwarded, so a fatal line never joins a partial line
  let released = false;

  // Ends the response, optionally with a fatal line the student will see.
  const endResponse = (fatalMessage?: string) => {
    if (responseEnded) return;
    responseEnded = true;
    clearTimeout(backstop);
    docker.stdout.unpipe(res);
    if (fatalMessage && !res.destroyed) {
      const prefix = lastByte === "\n" ? "" : "\n";
      res.write(prefix + JSON.stringify({ type: "fatal", message: fatalMessage }) + "\n");
    }
    res.end();
  };

  // Frees the slot once the container is really gone, not just the response.
  const release = () => {
    if (released) return;
    released = true;
    activeRuns.delete(name);
    releaseSlot();
  };

  const backstop = setTimeout(() => {
    console.error(`[runner] ${name} hit the ${BACKSTOP_MS} ms backstop; killing it`);
    removeContainer(name, docker);
    endResponse("Your program took too long.");
  }, BACKSTOP_MS);

  docker.stdout.on("data", (chunk: Buffer) => {
    if (chunk.length) lastByte = String.fromCharCode(chunk[chunk.length - 1]);
  });
  docker.stdout.pipe(res, { end: false });

  // The sandbox's stderr is diagnostics for us, never for students.
  docker.stderr.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString("utf8").split("\n")) {
      if (line.trim()) console.error(`[runner] ${name}: ${line}`);
    }
  });

  docker.on("error", error => {
    // The docker CLI itself couldn't start (not installed, not on PATH).
    console.error("[runner] could not start docker:", error);
    release();
    endResponse("The code runner isn't available right now. Try again in a moment.");
  });

  docker.on("close", code => {
    release();
    if (code === 125 || code === 126 || code === 127) {
      // Docker couldn't create or start the container (image missing, daemon
      // down, bad flag). Its reason is in the stderr lines logged above.
      console.error(`[runner] ${name}: docker run failed with exit code ${code}`);
      endResponse("The code runner isn't available right now. Try again in a moment.");
      return;
    }
    // Otherwise the sandbox already wrote its result or fatal line. If it
    // didn't, remote.ts reports that the runner stopped early.
    endResponse();
  });

  // Stop pressed or the student left: remote.ts aborts its fetch, which closes
  // the response before we've ended it.
  res.on("close", () => {
    if (!responseEnded) {
      removeContainer(name, docker);
      endResponse();
    }
  });

  // The request goes in on stdin. Closing stdin tells sandbox.ts it has it all.
  docker.stdin.on("error", () => {}); // EPIPE if the container already died
  docker.stdin.end(JSON.stringify(body));
}

// Killing the docker CLI does NOT stop the container: the daemon owns it. Ask
// the daemon to remove it, and retry while the CLI is still attached, in case
// the container didn't exist yet when we first asked.
function removeContainer(name: string, docker: ChildProcess): void {
  execFile("docker", ["rm", "-f", name], error => {
    if (error && docker.exitCode === null && docker.signalCode === null) {
      setTimeout(() => removeContainer(name, docker), 500);
    }
  });
}

function authorized(header: string | undefined): boolean {
  const expected = Buffer.from(`Bearer ${RUNNER_TOKEN}`);
  const actual = Buffer.from(header ?? "");
  // timingSafeEqual throws on different lengths, so check that first.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// The request body as text, or null if it's over MAX_BODY_BYTES.
async function readBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// A quick shape check so obvious junk gets a 400 instead of a container.
function parseBody(raw: string): RunBody | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { language, code, stdin } = value as Record<string, unknown>;
  if (typeof language !== "string" || !LANGUAGES.has(language)) return null;
  if (typeof code !== "string") return null;
  if (stdin !== undefined && typeof stdin !== "string") return null;
  // Forward only the known fields.
  return stdin === undefined ? { language, code } : { language, code, stdin };
}

function sendStatus(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { "Content-Type": "text/plain" });
  res.end(message);
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`Expected a positive integer, got "${value}"`);
  return n;
}

// Removes sandbox containers left over from a runner that crashed or was killed.
function removeLeftovers(): Promise<void> {
  return new Promise(resolve => {
    execFile("docker", ["ps", "-aq", "--filter", `label=${RUN_LABEL}`], (error, stdout) => {
      const ids = error ? [] : stdout.split("\n").filter(Boolean);
      if (error) console.error("[runner] could not list leftover containers:", error.message);
      if (!ids.length) return resolve();
      console.warn(`[runner] removing ${ids.length} leftover sandbox container(s)`);
      execFile("docker", ["rm", "-f", ...ids], () => resolve());
    });
  });
}

// On docker compose down / Ctrl-C: stop taking runs and remove running containers.
function shutdown(signal: string): void {
  console.log(`[runner] ${signal}: shutting down`);
  server.close();
  const names = [...activeRuns];
  if (!names.length) process.exit(0);
  execFile("docker", ["rm", "-f", ...names], () => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

removeLeftovers().then(() => {
  server.listen(PORT, () => {
    console.log(`[runner] listening on ${PORT}, image ${SANDBOX_IMAGE}, max ${MAX_CONCURRENT} at once`);
  });
});
