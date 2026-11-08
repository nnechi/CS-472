import { createRemoteRunner } from "./remote";
import { runSubmission, Runner } from "./runner";

// Which runner the server's queue uses. The server itself never runs student
// code unless ALLOW_UNSANDBOXED_RUNS=1 is set for local development.

let warnedUnsandboxed = false;

// Chosen by environment when a run starts:
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
