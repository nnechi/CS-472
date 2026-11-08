import { CodeRunJob, JobHooks, JobOutcome } from "./job";
import { Runner, RunOptions } from "./runner";
import { defaultRunner } from "./remote";

// How many programs run at once. Each is a sandbox container on this machine
// (see runner/), so keep it small. Set with MAX_CONCURRENT_RUNS, which
// docker-compose.yml gives the runner too, so the two limits always match.
export const MAX_CONCURRENT_RUNS = runLimitFromEnv(process.env.MAX_CONCURRENT_RUNS, 2);
// How many jobs can wait. Past this, new jobs are turned away instead of
// letting the line (and memory) grow without end.
export const MAX_QUEUED_RUNS = 50;

// Runs one request (see runner.ts). The real one is defaultRunner (see
// remote.ts): the sandboxed runner service when RUNNER_URL is set.
export type { Runner } from "./runner";

export interface ExecutionQueueOptions {
  maxConcurrent?: number;
  maxQueued?: number;
  run?: Runner;
}

// What enqueue did with a job.
//   queued:          waiting at this place in line (1 = next to start)
//   queue-full:      turned away, the line is at MAX_QUEUED_RUNS
//   already-running: turned away, this owner's previous job is still running
export type EnqueueResult =
  | { status: "queued"; position: number }
  | { status: "queue-full" }
  | { status: "already-running" };

// Runs code jobs first in, first out, at most maxConcurrent at a time.
//
// Jobs start in the order they were queued. With more than one running at
// once they can finish in a different order, but each owner has at most one
// job, so an owner's own results always arrive in order.
//
// One job per owner: queuing again while the old job is still waiting puts
// the new code in the old job's place in line, and the old job ends as
// "replaced". Queuing again while the old job is running is refused.
//
// Every job's onDone is called exactly once, however it ends.
export class ExecutionQueue {
  private readonly maxConcurrent: number;
  private readonly maxQueued: number;
  private readonly run: Runner;

  private readonly waiting: CodeRunJob[] = [];
  private readonly running = new Map<string, CodeRunJob>();
  // The last position each waiting job was told, so it's only told on a change.
  private readonly toldPositions = new Map<string, number>();

  constructor({
    maxConcurrent = MAX_CONCURRENT_RUNS,
    maxQueued = MAX_QUEUED_RUNS,
    run = defaultRunner,
  }: ExecutionQueueOptions = {}) {
    if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new RangeError("maxConcurrent must be a positive integer");
    }
    if (!Number.isSafeInteger(maxQueued) || maxQueued < 0) {
      throw new RangeError("maxQueued must be a non-negative integer");
    }
    this.maxConcurrent = maxConcurrent;
    this.maxQueued = maxQueued;
    this.run = run;
  }

  // Add a job to the end of the line, or in place of the owner's waiting job.
  // A job that can start right away still reports "queued" at position 1 and
  // then gets onStart.
  enqueue(job: CodeRunJob): EnqueueResult {
    if (this.findRunning(job.owner)) return { status: "already-running" };

    const previous = this.waiting.findIndex((j) => j.owner === job.owner);
    if (previous !== -1) {
      const replaced = this.waiting[previous];
      this.waiting[previous] = job;
      this.toldPositions.delete(replaced.id);
      this.finish(replaced, { type: "replaced" });
    } else {
      if (this.waiting.length >= this.maxQueued && this.running.size >= this.maxConcurrent) {
        return { status: "queue-full" };
      }
      this.waiting.push(job);
    }

    const position = this.waiting.indexOf(job) + 1;
    this.tellPositions();
    this.startNext();
    return { status: "queued", position };
  }

  // Cancel a job: removed from the line if waiting, stopped if running.
  // Returns false if the job isn't in the queue (already done, or never queued).
  cancel(jobId: string): boolean {
    const index = this.waiting.findIndex((j) => j.id === jobId);
    if (index !== -1) {
      const [job] = this.waiting.splice(index, 1);
      this.toldPositions.delete(job.id);
      this.finish(job, { type: "cancelled" });
      this.tellPositions();
      return true;
    }
    const job = this.running.get(jobId);
    if (job) {
      // The runner sees the abort, stops the program, and the job ends as
      // "cancelled" when the runner returns (see start).
      job.controller.abort();
      return true;
    }
    return false;
  }

  // Cancel whatever this owner has queued or running, e.g. when they disconnect.
  cancelOwner(owner: string): boolean {
    const job = this.waiting.find((j) => j.owner === owner) ?? this.findRunning(owner);
    return job ? this.cancel(job.id) : false;
  }

  // The owner's place in line (1 = next), 0 if their job is running, or null
  // if they have nothing queued.
  positionOf(owner: string): number | null {
    if (this.findRunning(owner)) return 0;
    const index = this.waiting.findIndex((j) => j.owner === owner);
    return index === -1 ? null : index + 1;
  }

  get waitingCount(): number {
    return this.waiting.length;
  }

  get runningCount(): number {
    return this.running.size;
  }

  private findRunning(owner: string): CodeRunJob | undefined {
    for (const job of this.running.values()) if (job.owner === owner) return job;
    return undefined;
  }

  // Start jobs from the front of the line while there's a free runner.
  private startNext(): void {
    let started = false;
    while (this.running.size < this.maxConcurrent && this.waiting.length > 0) {
      this.start(this.waiting.shift()!);
      started = true;
    }
    if (started) this.tellPositions();
  }

  private start(job: CodeRunJob): void {
    this.toldPositions.delete(job.id);
    this.running.set(job.id, job);
    callHook(job.hooks, "onStart");

    const options: RunOptions = {
      signal: job.controller.signal,
      onUpdate: (update) => {
        if (update.type === "output") callHook(job.hooks, "onOutput", update.stream, update.chunk);
      },
    };

    // Promise.resolve().then so a runner that throws right away (instead of
    // returning a rejected promise) is handled the same way.
    Promise.resolve()
      .then(() => this.run(job.request, options))
      .then(
        (result): JobOutcome =>
          job.controller.signal.aborted || result.cancelled
            ? { type: "cancelled" }
            : { type: "finished", result: job.toRunResult(result) },
        (error: unknown): JobOutcome =>
          job.controller.signal.aborted
            ? { type: "cancelled" }
            : { type: "error", message: error instanceof Error ? error.message : "Could not execute code." }
      )
      .then((outcome) => {
        this.running.delete(job.id);
        this.finish(job, outcome);
        this.startNext();
      });
  }

  // Tell each waiting job its place in line, if it changed since last time.
  private tellPositions(): void {
    this.waiting.forEach((job, index) => {
      const position = index + 1;
      if (this.toldPositions.get(job.id) === position) return;
      this.toldPositions.set(job.id, position);
      callHook(job.hooks, "onQueued", position);
    });
  }

  private finish(job: CodeRunJob, outcome: JobOutcome): void {
    callHook(job.hooks, "onDone", outcome);
  }
}

// Call one of a job's hooks. A hook that throws (say, a socket that's gone)
// is logged and ignored, so it can't stall the queue for everyone else.
function callHook<K extends keyof JobHooks>(
  hooks: JobHooks,
  name: K,
  ...args: Parameters<NonNullable<JobHooks[K]>>
): void {
  try {
    (hooks[name] as ((...a: typeof args) => void) | undefined)?.(...args);
  } catch (error) {
    console.error(`[queue] ${name} hook failed:`, error);
  }
}

// The server's one queue. Every room shares it, since they share the machine.
export const executionQueue = new ExecutionQueue();

// A positive whole number from the environment, or the fallback if unset.
function runLimitFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new RangeError(`MAX_CONCURRENT_RUNS must be a positive whole number, got "${value}"`);
  }
  return n;
}
