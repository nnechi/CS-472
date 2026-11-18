import assert from "node:assert/strict";
import { test } from "node:test";
import { createExecutionPlan, MAX_CODE_BYTES } from "./plan";
import { allowCodeRun, MAX_RUNS_PER_MINUTE, RUN_WINDOW_MS } from "./submission";

test("rejects empty, unsupported, and oversized submissions", () => {
  assert.throws(() => createExecutionPlan({ language: "javascript", code: " " }), /non-empty/);
  assert.throws(() => createExecutionPlan({ language: "unknown", code: "print(1)" }), /Unsupported language/);
  assert.throws(
    () => createExecutionPlan({ language: "typescript", code: "✓".repeat(MAX_CODE_BYTES) }),
    /size limit/
  );
});

test("rejects NUL characters and preserves valid source", () => {
  assert.throws(
    () => createExecutionPlan({ language: "javascript", code: "a\0b" }),
    /NUL/
  );
  const code = "\n  1 + 1\n";
  assert.equal(createExecutionPlan({ language: "javascript", code }).request.code, code);
});

test("limits runs per socket to five in a rolling minute", () => {
  const history: number[] = [];
  for (let count = 0; count < MAX_RUNS_PER_MINUTE; count++) {
    assert.equal(allowCodeRun(history, 1000 + count), true);
  }
  assert.equal(allowCodeRun(history, 2000), false);
  assert.equal(allowCodeRun(history, 1000 + RUN_WINDOW_MS), true);
});
