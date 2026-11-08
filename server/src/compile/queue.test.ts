import assert from "node:assert/strict";
import { test } from "node:test";
import { CodeRunJob, InvalidRunJobError, JobOutcome, runnableLanguage } from "./job";
import { InvalidCompileRequestError } from "./plan";
import { ExecutionQueue, Runner } from "./queue";
import { RunOptions } from "./runner";
import { CompileRequest, CompileResult } from "./types";
import { RUN_OUTPUT_MAX_LENGTH, emptyStudentEnvironment } from "../types";

// A runner that only finishes when the test says so, so the tests control
// exactly when each job ends.
function fakeRunner() {
  const calls: { request: CompileRequest; options: RunOptions; finish: (stdout?: string) => void; fail: (e: Error) => void }[] = [];
  const run: Runner = (request, options) =>
    new Promise<CompileResult>((resolve, reject) => {
      const result = (stdout = "", cancelled = false): CompileResult => ({
        executionId: "x", stdout, stderr: "", exitCode: cancelled ? null : 0, signal: null,
        timedOut: false, cancelled, outputLimitExceeded: false,
      });
      // Like the real runner: an abort ends the run as cancelled.
      options.signal?.addEventListener("abort", () => resolve(result("", true)), { once: true });
      calls.push({ request, options, finish: (stdout) => resolve(result(stdout)), fail: reject });
    });
  return { run, calls };
}

// A job that records everything the queue tells it.
function recordedJob(owner: string, code = `print("${owner}")`) {
  const events: string[] = [];
  const outcomes: JobOutcome[] = [];
  const job = new CodeRunJob(owner, 0, { language: "python", code }, {
    onQueued: (p) => events.push(`queued ${p}`),
    onStart: () => events.push("start"),
    onOutput: (stream, chunk) => events.push(`${stream} ${chunk}`),
    onDone: (o) => { events.push(`done ${o.type}`); outcomes.push(o); },
  });
  return { job, events, outcomes };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("starts jobs in the order they were queued, at most maxConcurrent at once", async () => {
  const { run, calls } = fakeRunner();
  const queue = new ExecutionQueue({ maxConcurrent: 2, run });
  const jobs = ["a", "b", "c", "d"].map((o) => recordedJob(o));
  const results = jobs.map(({ job }) => queue.enqueue(job));

  await tick();
  assert.deepEqual(results.map((r) => r.status), ["queued", "queued", "queued", "queued"]);
  assert.equal(queue.runningCount, 2);
  assert.equal(queue.waitingCount, 2);
  assert.deepEqual(calls.map((c) => c.request.code), ['print("a")', 'print("b")']);

  // b finishing first frees a runner for c, the next in line.
  calls[1].finish();
  await tick(); await tick();
  assert.deepEqual(calls.map((c) => c.request.code), ['print("a")', 'print("b")', 'print("c")']);
  // a and b started as soon as they were queued, so d joined the line 2nd,
  // then moved up to 1st when c started, and was told both times.
  assert.deepEqual(jobs[3].events, ["queued 2", "queued 1"]);

  calls[0].finish(); calls[2].finish();
  await tick(); await tick();
  calls[3].finish();
  await tick(); await tick();
  assert.equal(queue.runningCount + queue.waitingCount, 0);
  for (const { outcomes } of jobs) assert.deepEqual(outcomes.map((o) => o.type), ["finished"]);
});

test("a job that can start right away is queued at 1 and then started", async () => {
  const { run, calls } = fakeRunner();
  const queue = new ExecutionQueue({ run });
  const a = recordedJob("a");
  assert.deepEqual(queue.enqueue(a.job), { status: "queued", position: 1 });
  await tick(); // the runner is called on the next tick
  calls[0].finish("hi\n");
  await tick(); await tick();
  assert.deepEqual(a.events, ["queued 1", "start", "done finished"]);
  const outcome = a.outcomes[0];
  assert.ok(outcome.type === "finished" && outcome.result.stdout === "hi\n");
});

test("streams output to the job while it runs", async () => {
  const { run, calls } = fakeRunner();
  const queue = new ExecutionQueue({ run });
  const a = recordedJob("a");
  queue.enqueue(a.job);
  await tick();
  calls[0].options.onUpdate?.({ executionId: "x", type: "output", stream: "stdout", chunk: "part" });
  calls[0].options.onUpdate?.({ executionId: "x", type: "status", phase: "running" });
  assert.deepEqual(a.events, ["queued 1", "start", "stdout part"]);
});

test("queuing again while waiting replaces the old job in its place in line", async () => {
  const { run, calls } = fakeRunner();
  const queue = new ExecutionQueue({ maxConcurrent: 1, run });
  queue.enqueue(recordedJob("a").job); // running
  const b1 = recordedJob("b", "old");
  const c = recordedJob("c");
  queue.enqueue(b1.job); // 1st in line
  queue.enqueue(c.job); // 2nd in line
  const b2 = recordedJob("b", "new");
  assert.deepEqual(queue.enqueue(b2.job), { status: "queued", position: 1 });
  assert.deepEqual(b1.outcomes, [{ type: "replaced" }]);
  assert.equal(queue.waitingCount, 2);

  await tick();
  calls[0].finish();
  await tick(); await tick();
  assert.equal(calls[1].request.code, "new"); // b's new code, ahead of c
});

test("refuses a new job while the owner's job is running", async () => {
  const { run } = fakeRunner();
  const queue = new ExecutionQueue({ run });
  queue.enqueue(recordedJob("a").job);
  assert.deepEqual(queue.enqueue(recordedJob("a").job), { status: "already-running" });
});

test("turns jobs away when the line is full", async () => {
  const { run } = fakeRunner();
  const queue = new ExecutionQueue({ maxConcurrent: 1, maxQueued: 1, run });
  queue.enqueue(recordedJob("a").job); // running
  queue.enqueue(recordedJob("b").job); // waiting, line full
  const c = recordedJob("c");
  assert.deepEqual(queue.enqueue(c.job), { status: "queue-full" });
  assert.deepEqual(c.events, []); // never queued, so never told anything
  // Replacing a waiting job doesn't grow the line, so it's still allowed.
  assert.equal(queue.enqueue(recordedJob("b").job).status, "queued");
});

test("cancelling a waiting job removes it and moves the rest up", async () => {
  const { run, calls } = fakeRunner();
  const queue = new ExecutionQueue({ maxConcurrent: 1, run });
  queue.enqueue(recordedJob("a").job);
  const b = recordedJob("b");
  const c = recordedJob("c");
  queue.enqueue(b.job);
  queue.enqueue(c.job);
  assert.equal(queue.cancel(b.job.id), true);
  assert.deepEqual(b.outcomes, [{ type: "cancelled" }]);
  assert.deepEqual(c.events, ["queued 2", "queued 1"]);
  await tick();
  calls[0].finish();
  await tick(); await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].request.code, 'print("c")'); // b never ran
});

test("cancelling a running job aborts it and starts the next", async () => {
  const { run, calls } = fakeRunner();
  const queue = new ExecutionQueue({ maxConcurrent: 1, run });
  const a = recordedJob("a");
  queue.enqueue(a.job);
  queue.enqueue(recordedJob("b").job);
  await tick();
  assert.equal(queue.cancel(a.job.id), true);
  await tick(); await tick();
  assert.equal(calls[0].options.signal?.aborted, true);
  assert.deepEqual(a.outcomes, [{ type: "cancelled" }]);
  assert.equal(calls.length, 2);
  assert.equal(queue.cancel(a.job.id), false); // already gone
});

test("cancelOwner cancels whatever the owner has, for disconnects", async () => {
  const { run } = fakeRunner();
  const queue = new ExecutionQueue({ maxConcurrent: 1, run });
  queue.enqueue(recordedJob("a").job);
  const b = recordedJob("b");
  queue.enqueue(b.job);
  assert.equal(queue.positionOf("a"), 0);
  assert.equal(queue.positionOf("b"), 1);
  assert.equal(queue.cancelOwner("b"), true);
  assert.equal(queue.positionOf("b"), null);
  assert.equal(queue.cancelOwner("nobody"), false);
});

test("a runner failure ends the job as an error and the queue keeps going", async () => {
  const { run, calls } = fakeRunner();
  const queue = new ExecutionQueue({ maxConcurrent: 1, run });
  const a = recordedJob("a");
  const b = recordedJob("b");
  queue.enqueue(a.job);
  queue.enqueue(b.job);
  await tick();
  calls[0].fail(new Error("spawn failed"));
  await tick(); await tick();
  assert.deepEqual(a.outcomes, [{ type: "error", message: "spawn failed" }]);
  assert.equal(calls.length, 2);
});

test("a hook that throws doesn't stall the queue", async () => {
  const { run, calls } = fakeRunner();
  const queue = new ExecutionQueue({ maxConcurrent: 1, run });
  const original = console.error;
  console.error = () => {};
  try {
    queue.enqueue(new CodeRunJob("a", 0, { language: "python", code: "x" }, {
      onStart: () => { throw new Error("socket gone"); },
      onDone: () => { throw new Error("socket gone"); },
    }));
    queue.enqueue(recordedJob("b").job);
    await tick();
    calls[0].finish();
    await tick(); await tick();
    assert.equal(calls.length, 2);
  } finally {
    console.error = original;
  }
});

test("fromEnvironment copies the question's code and takes the language from the activity", () => {
  const env = emptyStudentEnvironment("key-1234", "alice", "coding", 2);
  env.questions[1].code = "print(1)";
  const job = CodeRunJob.fromEnvironment(env, 1, "python");
  env.questions[1].code = "print(2)"; // the student keeps typing
  assert.equal(job.owner, "key-1234");
  assert.equal(job.questionIndex, 1);
  assert.deepEqual(job.request, { language: "python", code: "print(1)" });
  assert.equal(CodeRunJob.fromEnvironment({ ...env, questions: [{ ...env.questions[1] }] }, 0, "c++").request.language, "cpp");
});

test("fromEnvironment refuses jobs that can't run", () => {
  const env = emptyStudentEnvironment("key-1234", "alice", "coding", 1);
  assert.throws(() => CodeRunJob.fromEnvironment(env, 0, "python"), InvalidRunJobError); // no code
  env.questions[0].code = "print(1)";
  assert.throws(() => CodeRunJob.fromEnvironment(env, 5, "python"), InvalidRunJobError);
  assert.throws(() => CodeRunJob.fromEnvironment(env, 0, "other"), InvalidRunJobError);
  assert.throws(() => CodeRunJob.fromEnvironment(env, 0, null), InvalidRunJobError);
  env.questions[0].code = "x".repeat(70 * 1024);
  assert.throws(() => CodeRunJob.fromEnvironment(env, 0, "python"), InvalidCompileRequestError);
  assert.equal(runnableLanguage("other"), null);
});

test("toRunResult trims output to what an environment keeps", () => {
  const job = new CodeRunJob("a", 0, { language: "python", code: "x" });
  const run = job.toRunResult({
    executionId: "x", stdout: "y".repeat(RUN_OUTPUT_MAX_LENGTH + 10), stderr: "", exitCode: 0,
    signal: null, timedOut: false, cancelled: false, outputLimitExceeded: false,
  });
  assert.equal(run.stdout.length, RUN_OUTPUT_MAX_LENGTH);
  assert.ok(!Number.isNaN(Date.parse(run.finishedAt)));
});
