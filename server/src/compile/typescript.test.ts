import assert from "node:assert/strict";
import { test } from "node:test";
import { runTypeScript } from "./typescript";
import { CompileUpdate } from "./types";

test("compiles TypeScript and streams program output", async () => {
  const updates: CompileUpdate[] = [];
  const result = await runTypeScript(
    {
      language: "typescript",
      code: "const answer: number = 42; console.log(answer);",
    },
    { onUpdate: (update) => updates.push(update) }
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "42\n");
  assert.equal(result.stderr, "");
  assert.deepEqual(
    updates.filter((update) => update.type === "status").map((update) => update.phase),
    ["compiling", "running"]
  );
  assert.ok(updates.some((update) => update.type === "output" && update.chunk.includes("42")));
  assert.equal(updates.at(-1)?.type, "complete");
  assert.ok(updates.every((update) => update.executionId === result.executionId));
});

test("streams TypeScript diagnostics and does not run invalid code", async () => {
  const updates: CompileUpdate[] = [];
  const result = await runTypeScript(
    {
      language: "typescript",
      code: "const answer: number = 'wrong'; console.log('should not run');",
    },
    { onUpdate: (update) => updates.push(update) }
  );

  assert.notEqual(result.exitCode, 0);
  assert.match(result.stdout + result.stderr, /TS2322/);
  assert.doesNotMatch(result.stdout + result.stderr, /should not run/);
  assert.deepEqual(
    updates.filter((update) => update.type === "status").map((update) => update.phase),
    ["compiling"]
  );
  assert.equal(updates.at(-1)?.type, "complete");
});
