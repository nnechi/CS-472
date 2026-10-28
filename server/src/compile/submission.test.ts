import assert from "node:assert/strict";
import { test } from "node:test";
import { allowCodeRun, MAX_RUNS_PER_MINUTE, receiveCode, RUN_WINDOW_MS } from "./submission";

test("acknowledges the language and UTF-8 size of received code", () => {
  assert.deepEqual(
    receiveCode({ language: "javascript", code: "console.log('✓')" }),
    { language: "javascript", bytes: Buffer.byteLength("console.log('✓')") }
  );
});

test("rejects empty, unsupported, and oversized submissions", () => {
  assert.throws(() => receiveCode({ language: "javascript", code: " " }), /non-empty/);
  assert.throws(() => receiveCode({ language: "python", code: "print(1)" }), /Only JavaScript/);
  assert.throws(
    () => receiveCode({ language: "typescript", code: "x".repeat(64 * 1024 + 1) }),
    /size limit/
  );
});

test("rejects unexpected fields and NUL characters without changing valid source", () => {
  assert.throws(
    () => receiveCode({ language: "javascript", code: "1 + 1", executable: "sh" }),
    /only language and code/
  );
  assert.throws(() => receiveCode({ language: "javascript", code: "a\0b" }), /NUL/);
  assert.deepEqual(receiveCode({ language: "javascript", code: "\n  1 + 1\n" }), {
    language: "javascript",
    bytes: Buffer.byteLength("\n  1 + 1\n"),
  });
});

test("limits runs per socket to five in a rolling minute", () => {
  const history: number[] = [];
  for (let count = 0; count < MAX_RUNS_PER_MINUTE; count++) {
    assert.equal(allowCodeRun(history, 1000 + count), true);
  }
  assert.equal(allowCodeRun(history, 2000), false);
  assert.equal(allowCodeRun(history, 1000 + RUN_WINDOW_MS), true);
});
