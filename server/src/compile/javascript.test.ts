import assert from "node:assert/strict";
import { test } from "node:test";
import { runJavaScript } from "./javascript";
import { CompileUpdate } from "./types";

test("runs JavaScript and sends text updates", async () => {
  const updates: CompileUpdate[] = [];
  const result = await runJavaScript(
    {
      language: "javascript",
      code: "console.log('hello'); console.error('warning');",
    },
    { onUpdate: (update) => updates.push(update) }
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "hello\n");
  assert.equal(result.stderr, "warning\n");
  assert.equal(updates[0].type, "status");
  assert.equal(updates.at(-1)?.type, "complete");
  assert.ok(updates.some((update) => update.type === "output" && update.chunk.includes("hello")));
  assert.ok(updates.every((update) => update.executionId === result.executionId));
});

test("passes stdin to a JavaScript program", async () => {
  const result = await runJavaScript({
    language: "javascript",
    code: "process.stdin.pipe(process.stdout)",
    stdin: "input text",
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "input text");
});

test("stops a program that exceeds its timeout", async () => {
  const result = await runJavaScript(
    { language: "javascript", code: "setInterval(() => {}, 1000)" },
    { timeoutMs: 200 }
  );
  assert.equal(result.timedOut, true);
  assert.equal(result.exitCode, null);
});

test("stops a program that exceeds its output limit", async () => {
  const result = await runJavaScript(
    { language: "javascript", code: "console.log('x'.repeat(10000))" },
    { maxOutputBytes: 128 }
  );
  assert.equal(result.outputLimitExceeded, true);
  assert.ok(Buffer.byteLength(result.stdout) <= 128);
});

test("rejects a language without a runner", async () => {
  await assert.rejects(
    runJavaScript({ language: "python", code: "print('hello')" }),
    /only supports JavaScript/
  );
});
