import assert from "node:assert/strict";
import { test } from "node:test";
import { runCpp, CompileUpdate } from "./index";

const main = (body: string) => `#include <iostream>\n#include <string>\n#include <vector>\nint main() { ${body} }`;

test("C++17 compiles, reads input, and streams output", async () => {
  const updates: CompileUpdate[] = [];
  const result = await runCpp({ language: "cpp", stdin: "hello\n",
    code: main('std::string s; std::getline(std::cin,s); std::vector<int> v{1,2}; for (auto n : v) std::cout << n; if constexpr (true) std::cout << s << std::endl; std::cerr << "warning";') },
    { onUpdate: u => updates.push(u) });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "12hello\n");
  assert.equal(result.stderr, "warning");
  assert.deepEqual(updates.filter(u => u.type === "status").map(u => u.phase), ["compiling", "running"]);
  assert.ok(updates.some(u => u.type === "output"));
  assert.equal(updates.at(-1)?.type, "complete");
});

test("C++ compilation and linker failures never execute", async () => {
  for (const code of [main('std::cout << "no"; return missing;'), 'int missing(); int main(){return missing();}']) {
    const updates: CompileUpdate[] = [];
    const r = await runCpp({ language: "cpp", code }, { onUpdate: u => updates.push(u) });
    assert.notEqual(r.exitCode, 0);
    assert.ok(r.stderr.length > 0);
    assert.equal(r.stdout, "");
    assert.deepEqual(updates.filter(u => u.type === "status").map(u => u.phase), ["compiling"]);
  }
});

test("C++ preserves exit codes and limits output", async () => {
  const r = await runCpp({ language: "cpp", code: main('std::cerr << "failed"; return 7;') });
  assert.equal(r.exitCode, 7);
  assert.equal(r.stderr, "failed");
  const limited = await runCpp({ language: "cpp", code: main('for(;;) std::cout << "xxxxxxxx";') }, { maxOutputBytes: 128 });
  assert.equal(limited.outputLimitExceeded, true);
  assert.ok(Buffer.byteLength(limited.stdout) <= 128);
});

test("C++ supports run timeout, compile timeout, and cancellation", async () => {
  const request = { language: "cpp", code: main('std::cout << "ready" << std::endl; for(;;){}') };
  assert.equal((await runCpp(request, { timeoutMs: 100 })).timedOut, true);
  assert.equal((await runCpp(request, { compileTimeoutMs: 1 })).timedOut, true);
  const controller = new AbortController();
  const r = await runCpp(request, { signal: controller.signal, onUpdate: u => {
    if (u.type === "output" && u.stream === "stdout") controller.abort();
  } });
  assert.equal(r.cancelled, true);
});

test("C++ rejects invalid requests and other languages", async () => {
  await assert.rejects(runCpp({ language: "cpp", code: "" }), /non-empty/);
  await assert.rejects(runCpp({ language: "c", code: "int main(){}" }), /only supports C\+\+/);
});
