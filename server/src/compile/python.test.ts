import assert from "node:assert/strict";
import { test } from "node:test";
import { runPython, CompileUpdate } from "./index";

test("runs Python with stdin and streams Unicode stdout and stderr", async () => {
  const updates: CompileUpdate[] = [];
  const result = await runPython(
    { language: "python", code: "import sys\nprint(input())\nprint('warning', file=sys.stderr)", stdin: "héllo 🐍\n" },
    { onUpdate: update => updates.push(update) }
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "héllo 🐍\n");
  assert.equal(result.stderr, "warning\n");
  assert.ok(updates.some(update => update.type === "output"));
  assert.equal(updates.at(-1)?.type, "complete");
  assert.ok(updates.every(update => update.executionId === result.executionId));
});

test("returns Python syntax and runtime errors", async () => {
  for (const [code, diagnostic] of [["print(", /SyntaxError/], ["raise ValueError('oops')", /ValueError: oops/]] as const) {
    const result = await runPython({ language: "python", code });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, diagnostic);
  }
});

test("stops Python when its timeout or output limit is exceeded", async () => {
  const timed = await runPython({ language: "python", code: "while True: pass" }, { timeoutMs: 200 });
  assert.equal(timed.timedOut, true);
  const limited = await runPython({ language: "python", code: "print('x' * 10000)" }, { maxOutputBytes: 128 });
  assert.equal(limited.outputLimitExceeded, true);
  assert.ok(Buffer.byteLength(limited.stdout) <= 128);
});

test("cancels a running Python submission", async () => {
  const controller = new AbortController();
  const result = await runPython(
    { language: "python", code: "import time\nprint('ready')\ntime.sleep(30)" },
    { signal: controller.signal, onUpdate: update => {
      if (update.type === "output") controller.abort();
    } }
  );
  assert.equal(result.cancelled, true);
});

test("rejects invalid requests and other languages", async () => {
  await assert.rejects(runPython({ language: "python", code: "" }), /non-empty/);
  await assert.rejects(runPython({ language: "javascript", code: "print('hello')" }), /only supports Python/);
});
