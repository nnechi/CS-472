import { randomUUID } from "node:crypto";
import { createExecutionPlan } from "./plan";
import { CompileLanguage, CompileRequest, CompileResult, OutputStream } from "./types";
import { RUN_OUTPUT_MAX_LENGTH, RunOutcome, RunResult, StudentEnvironment } from "../types";

// Activity languages (what a teacher picks) to the runner's languages. "other"
// and a missing language have no runner, so their code can't be run.
const RUNNABLE_LANGUAGES: Record<string, CompileLanguage> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  c: "c",
  "c++": "cpp",
};

// The runner language for an activity's language, or null if it can't run.
export function runnableLanguage(activityLanguage: string | null): CompileLanguage | null {
  return activityLanguage ? RUNNABLE_LANGUAGES[activityLanguage] ?? null : null;
}

// How a job ended. Every job ends exactly once. The same type the client
// gets in "run finished" (see RunOutcome in ../types).
export type JobOutcome = RunOutcome;

// What the queue tells the job's owner as it moves along. All optional, and a
// hook that throws can't break the queue.
export interface JobHooks {
  // Its place in line, 1 = next to start. Sent when queued and whenever it moves.
  onQueued?: (position: number) => void;
  onStart?: () => void;
  // Output as the program produces it, before the job finishes.
  onOutput?: (stream: OutputStream, chunk: string) => void;
  onDone?: (outcome: JobOutcome) => void;
}

// Why a job couldn't be made from an environment.
export class InvalidRunJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRunJobError";
  }
}

// One run of one student's code, ready for the ExecutionQueue.
//
// The code is copied when the job is made, so it runs exactly what the student
// submitted even if they keep typing while it waits. The language comes from
// the room's activity, never from the student.
export class CodeRunJob {
  readonly id = randomUUID();
  // Whose job this is. The queue keeps one job per owner.
  readonly owner: string;
  readonly questionIndex: number;
  readonly request: CompileRequest;
  readonly hooks: JobHooks;
  // Aborted to cancel a running job. The queue does this; callers use queue.cancel.
  readonly controller = new AbortController();
  readonly createdAt = new Date();

  constructor(owner: string, questionIndex: number, request: CompileRequest, hooks: JobHooks = {}) {
    // Same checks the runner does, done now so a bad job is never queued.
    this.request = createExecutionPlan(request).request;
    this.owner = owner;
    this.questionIndex = questionIndex;
    this.hooks = hooks;
  }

  // A job running the code in one question of a student's environment.
  // Throws InvalidRunJobError if the question doesn't exist, the activity's
  // language can't run, or there's no code; InvalidCompileRequestError if the
  // code is over the runner's size limit.
  static fromEnvironment(
    env: StudentEnvironment,
    questionIndex: number,
    activityLanguage: string | null,
    hooks: JobHooks = {}
  ): CodeRunJob {
    const question = Number.isInteger(questionIndex) ? env.questions[questionIndex] : undefined;
    if (!question) throw new InvalidRunJobError("That question doesn't exist.");

    const language = runnableLanguage(activityLanguage);
    if (!language) throw new InvalidRunJobError("This activity's language can't be run.");

    if (!question.code.trim()) throw new InvalidRunJobError("Write some code before running it.");

    return new CodeRunJob(env.studentKey, questionIndex, { language, code: question.code }, hooks);
  }

  // The runner's result in the shape environments store, with output trimmed
  // to what an environment keeps.
  toRunResult(result: CompileResult): RunResult {
    return {
      stdout: result.stdout.slice(0, RUN_OUTPUT_MAX_LENGTH),
      stderr: result.stderr.slice(0, RUN_OUTPUT_MAX_LENGTH),
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      outputLimitExceeded: result.outputLimitExceeded,
      finishedAt: new Date().toISOString(),
    };
  }
}
