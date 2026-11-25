import assert from "node:assert/strict";
import test from "node:test";
import { MAX_RUN_REPORTS_PER_MINUTE, RUN_REPORT_WINDOW_MS, allowRunReport, parseBrowserRun } from "./browserRun";
import { RUN_OUTPUT_MAX_LENGTH } from "./types";

const result = { stdout: "hello\n", stderr: "", exitCode: 0, timedOut: false, outputLimitExceeded: false, finishedAt: "client-controlled" };
const payload = { questionIndex: 0, code: "print('hello')", result };

test("keeps bounded output only for the current question's exact source", () => {
  const parsed = parseBrowserRun(payload, [payload.code]);
  assert.equal(parsed?.result.stdout, "hello\n");
  assert.notEqual(parsed?.result.finishedAt, result.finishedAt);
  assert.equal(parseBrowserRun(payload, ["changed source"]), null);
  assert.equal(parseBrowserRun({ ...payload, questionIndex: -1 }, [payload.code]), null);
  assert.equal(parseBrowserRun({ ...payload, questionIndex: 0.5 }, [payload.code]), null);
  assert.equal(parseBrowserRun({ ...payload, questionIndex: 1 }, [payload.code]), null);
});

test("rejects malformed, oversized, or forged result shapes", () => {
  for (const invalid of [null, [], "hello", { ...result, stdout: "x".repeat(RUN_OUTPUT_MAX_LENGTH + 1) },
    { ...result, stderr: {} }, { ...result, exitCode: "0" }, { ...result, timedOut: 1 }]) {
    assert.equal(parseBrowserRun({ ...payload, result: invalid }, [payload.code]), null);
  }
  assert.equal(parseBrowserRun(null, []), null);
  const parsed = parseBrowserRun({ ...payload, result: { ...result, grade: 100, trusted: true } }, [payload.code]);
  assert.equal(Object.hasOwn(parsed!.result, "grade"), false);
});

test("limits run reports per window and frees slots as they age out", () => {
  const history: number[] = [];
  for (let i = 0; i < MAX_RUN_REPORTS_PER_MINUTE; i++) assert.equal(allowRunReport(history, 1_000 + i), true);
  assert.equal(allowRunReport(history, 2_000), false);
  assert.equal(history.length, MAX_RUN_REPORTS_PER_MINUTE);
  assert.equal(allowRunReport(history, 1_000 + RUN_REPORT_WINDOW_MS), true);
  assert.equal(allowRunReport(history, 1_000 + RUN_REPORT_WINDOW_MS), false);
});
