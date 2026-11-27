import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkOutput, outputLines } from "./outputCheck";

const run = (stdout: string, extra: Partial<{ exitCode: number | null; timedOut: boolean; outputLimitExceeded: boolean }> = {}) =>
  ({ stdout, exitCode: 0, timedOut: false, outputLimitExceeded: false, ...extra });

test("ignores line endings, trailing spaces, and trailing blank lines", () => {
  assert.deepEqual(outputLines("a  \r\nb\r\n\n\n"), ["a", "b"]);
  assert.equal(checkOutput(run("hi\n"), "hi").correct, true);
  assert.equal(checkOutput(run("1\r\n2 \n\n"), "1\n2").correct, true);
});

test("is strict about case, leading spaces, and blank lines in the middle", () => {
  assert.equal(checkOutput(run("Hi\n"), "hi").correct, false);
  assert.equal(checkOutput(run(" hi\n"), "hi").correct, false);
  assert.equal(checkOutput(run("a\n\nb\n"), "a\nb").correct, false);
});

test("reports the first line that differs", () => {
  assert.deepEqual(checkOutput(run("1\n2\n6\n"), "1\n2\n5"), { correct: false, line: 3, expected: "5", actual: "6" });
  assert.deepEqual(checkOutput(run("1\n"), "1\n2"), { correct: false, line: 2, expected: "2", actual: null });
  assert.deepEqual(checkOutput(run("1\n2\n3\n"), "1\n2"), { correct: false, line: 3, expected: null, actual: "3" });
  assert.deepEqual(checkOutput(run(""), "x"), { correct: false, line: 1, expected: "x", actual: null });
});

test("matching output from a failed run is not correct", () => {
  for (const extra of [{ exitCode: 1 }, { exitCode: null }, { timedOut: true }, { outputLimitExceeded: true }]) {
    assert.deepEqual(checkOutput(run("hi\n", extra), "hi"), { correct: false, line: null, expected: null, actual: null });
  }
});

test("shortens very long lines in the report", () => {
  const long = "x".repeat(500);
  const check = checkOutput(run(long), "y");
  assert.equal(check.actual?.length, 120);
});

test("the client's copy matches this file", () => {
  const server = readFileSync(join(__dirname, "outputCheck.ts"), "utf8");
  const client = readFileSync(join(__dirname, "../../client/src/utils/outputCheck.ts"), "utf8");
  assert.equal(client, server);
});
