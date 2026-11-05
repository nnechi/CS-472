import assert from "node:assert/strict";
import { test } from "node:test";
import { runC, CompileUpdate } from "./index";

const main = (body: string) => `#include <stdio.h>\nint main(void) { ${body} }`;

test("compiles C and streams stdout, stderr, and stdin", async () => {
  const updates: CompileUpdate[] = [];
  const result = await runC(
    {
      language: "c",
      code: main('char text[100]; if (!fgets(text, sizeof(text), stdin)) return 1; fputs(text, stdout); fputs("warning\\n", stderr); return 0;'),
      stdin: "héllo\n",
    },
    { onUpdate: update => updates.push(update) }
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "héllo\n");
  assert.equal(result.stderr, "warning\n");
  assert.deepEqual(updates.filter(u => u.type === "status").map(u => u.phase), ["compiling", "running"]);
  for (const stream of ["stdout", "stderr"]) {
    assert.ok(updates.some(u => u.type === "output" && u.stream === stream));
  }
  assert.equal(updates.at(-1)?.type, "complete");
  assert.ok(updates.every(u => u.executionId === result.executionId));
});

test("reports C compile errors without running the program", async () => {
  const updates: CompileUpdate[] = [];
  const result = await runC(
    { language: "c", code: main('puts("should not run"); return missing_value;') },
    { onUpdate: u => updates.push(u) }
  );
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /error:/);
  assert.equal(result.stdout, "");
  assert.deepEqual(updates.filter(u => u.type === "status").map(u => u.phase), ["compiling"]);
  assert.equal(updates.at(-1)?.type, "complete");
});

test("reports C linker errors without running the program", async () => {
  const result = await runC({ language: "c", code: "int missing(void); int main(void) { return missing(); }" });
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /undefined|Undefined/);
  assert.equal(result.stdout, "");
});

test("preserves a C program's nonzero exit code", async () => {
  const result = await runC({ language: "c", code: main('fputs("failed\\n", stderr); return 7;') });
  assert.equal(result.exitCode, 7);
  assert.equal(result.stderr, "failed\n");
});

test("enforces C run and compile timeouts", async () => {
  const result = await runC({ language: "c", code: main("for (;;) {}") }, { timeoutMs: 200 });
  assert.equal(result.timedOut, true);
  const updates: CompileUpdate[] = [];
  const compiling = await runC(
    { language: "c", code: main("return 0;") },
    { compileTimeoutMs: 1, onUpdate: u => updates.push(u) }
  );
  assert.equal(compiling.timedOut, true);
  assert.deepEqual(updates.filter(u => u.type === "status").map(u => u.phase), ["compiling"]);
});

test("enforces C output limits", async () => {
  const result = await runC(
    { language: "c", code: main("for (int i = 0; i < 10000; i++) putchar('x'); return 0;") },
    { maxOutputBytes: 128 }
  );
  assert.equal(result.outputLimitExceeded, true);
  assert.ok(Buffer.byteLength(result.stdout) <= 128);
});

test("cancels a running C submission after streamed output", async () => {
  const controller = new AbortController();
  const result = await runC(
    { language: "c", code: main('puts("ready"); fflush(stdout); for (;;) {}') },
    { signal: controller.signal, onUpdate: u => {
      if (u.type === "output" && u.stream === "stdout") controller.abort();
    } }
  );
  assert.equal(result.cancelled, true);
});

test("rejects invalid C requests and other languages", async () => {
  await assert.rejects(runC({ language: "c", code: "" }), /non-empty/);
  await assert.rejects(runC({ language: "python", code: "print('hello')" }), /only supports C/);
});
