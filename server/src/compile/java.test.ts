import assert from "node:assert/strict";
import { test } from "node:test";
import { runJava, CompileUpdate } from "./index";

const main = (body: string) =>
  `public class Main { public static void main(String[] args) throws Exception { ${body} } }`;

test("compiles Java and streams stdout, stderr, and stdin", async () => {
  const updates: CompileUpdate[] = [];
  const result = await runJava(
    {
      language: "java",
      code: main('System.out.println(new java.util.Scanner(System.in, "UTF-8").nextLine()); System.err.println("warning"); System.out.println("héllo");'),
      stdin: "input text\n",
    },
    { onUpdate: update => updates.push(update) }
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "input text\nhéllo\n");
  assert.equal(result.stderr, "warning\n");
  assert.deepEqual(updates.filter(u => u.type === "status").map(u => u.phase), ["compiling", "running"]);
  assert.ok(updates.some(u => u.type === "output" && u.stream === "stdout"));
  assert.equal(updates.at(-1)?.type, "complete");
  assert.ok(updates.every(u => u.executionId === result.executionId));
});

test("reports Java compile errors without running the program", async () => {
  const updates: CompileUpdate[] = [];
  const result = await runJava(
    { language: "java", code: main('int n = "wrong"; System.out.println("should not run");') },
    { onUpdate: update => updates.push(update) }
  );
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /error:/);
  assert.equal(result.stdout, "");
  assert.deepEqual(updates.filter(u => u.type === "status").map(u => u.phase), ["compiling"]);
  assert.equal(updates.at(-1)?.type, "complete");
});

test("reports Java runtime exceptions", async () => {
  const result = await runJava({ language: "java", code: main('throw new IllegalStateException("oops");') });
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /IllegalStateException: oops/);
});

test("enforces Java run and compile timeouts", async () => {
  const running = await runJava({ language: "java", code: main("while (true) {}") }, { timeoutMs: 200 });
  assert.equal(running.timedOut, true);
  const updates: CompileUpdate[] = [];
  const compiling = await runJava(
    { language: "java", code: main('System.out.println("hello");') },
    { compileTimeoutMs: 1, onUpdate: u => updates.push(u) }
  );
  assert.equal(compiling.timedOut, true);
  assert.deepEqual(updates.filter(u => u.type === "status").map(u => u.phase), ["compiling"]);
});

test("enforces Java output limits", async () => {
  const result = await runJava(
    { language: "java", code: main('System.out.print("x".repeat(10000));') },
    { maxOutputBytes: 128 }
  );
  assert.equal(result.outputLimitExceeded, true);
  assert.ok(Buffer.byteLength(result.stdout) <= 128);
});

test("cancels a running Java submission", async () => {
  const controller = new AbortController();
  const result = await runJava(
    { language: "java", code: main('System.out.println("ready"); Thread.sleep(30000);') },
    { signal: controller.signal, onUpdate: u => {
      if (u.type === "output" && u.stream === "stdout") controller.abort();
    } }
  );
  assert.equal(result.cancelled, true);
});

test("rejects invalid Java requests and other languages", async () => {
  await assert.rejects(runJava({ language: "java", code: "" }), /non-empty/);
  await assert.rejects(runJava({ language: "python", code: "print('hello')" }), /only supports Java/);
});
