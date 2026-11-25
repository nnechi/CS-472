import { expect, test, type Page } from "@playwright/test";

// Exercise real Wasm workers and compiler assets; no mocked execution service.
async function run(page: Page, language: string, code: string) {
  return page.evaluate(async ({ language, code }) => {
    const { startBrowserRun } = window as unknown as { startBrowserRun: typeof import("../src/runner/browserRunner").startBrowserRun };
    return startBrowserRun(language, code, () => {}, () => {}).result;
  }, { language, code });
}

test.beforeEach(async ({ page }) => { await page.goto("/tests/runner.html"); await page.waitForFunction(() => "startBrowserRun" in window); });

const samples: Record<string, string> = {
  python: 'print("hello")',
  javascript: 'console.log("hello");',
  typescript: 'const message: string = "hello"; console.log(message);',
  java: 'public class Greeting { public static void main(String[] args) { System.out.println("hello"); } }',
  c: '#include <stdio.h>\nint main(void) { puts("hello"); return 0; }',
  "c++": '#include <iostream>\nint main() { std::cout << "hello" << std::endl; }',
};

for (const [language, code] of Object.entries(samples)) {
  test(`${language} compiles and runs locally`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", req => requests.push(`${req.method()} ${req.url()}`));
    const result = await run(page, language, code);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello\n");
    expect(result.stderr).toBe("");
    expect(requests.every(req => req.startsWith("GET "))).toBe(true);
    const assets = requests.filter(req => req.includes("/toolchains/"));
    expect(assets.length).toBeGreaterThan(0);
    const expected = language === "c" || language === "c++" ? "clang-"
      : language === "java" ? "java-teavm-" : language === "python" ? "python-" : "(quickjs-|typescript-)";
    expect(assets.every(req => new RegExp(`/toolchains/[0-9a-f]+/${expected}`).test(req))).toBe(true);
  });
}

test("compiler errors are returned to the output panel", async ({ page }) => {
  const result = await run(page, "c", "int main( { broken }");
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toMatch(/error/i);
});

test("infinite loops terminate and the next run succeeds", async ({ page }) => {
  const result = await run(page, "javascript", "while (true) {}");
  expect(result.timedOut).toBe(true);
  expect((await run(page, "javascript", samples.javascript)).stdout).toBe("hello\n");
});

test("output is bounded", async ({ page }) => {
  const result = await run(page, "python", 'while True: print("x" * 1000)');
  expect(result.outputLimitExceeded).toBe(true);
  expect(result.stdout.length).toBeLessThanOrEqual(20_000);
});

test("Stop cancels loading or execution and allows another run", async ({ page }) => {
  const message = await page.evaluate(async () => {
    const { startBrowserRun } = window as unknown as { startBrowserRun: typeof import("../src/runner/browserRunner").startBrowserRun };
    const task = startBrowserRun("javascript", "while(true) {}", () => {}, () => {});
    task.cancel();
    try { await task.result; return "not cancelled"; } catch (error) { return String(error); }
  });
  expect(message).toContain("Stopped.");
  expect((await run(page, "javascript", samples.javascript)).stdout).toBe("hello\n");
});

test("unsupported activity languages fail without a fallback", async ({ page }) => {
  await expect(run(page, "other", "hello")).rejects.toThrow(/cannot run in the browser/);
});

test("Stop terminates an executing worker", async ({ page }) => {
  const message = await page.evaluate(async () => {
    const { startBrowserRun } = window as unknown as { startBrowserRun: typeof import("../src/runner/browserRunner").startBrowserRun };
    let stop: () => void = () => {};
    const task = startBrowserRun("javascript", "while(true) {}", () => {}, phase => {
      if (phase === "Running…") setTimeout(() => stop(), 25);
    });
    stop = task.cancel;
    try { await task.result; return "not cancelled"; } catch (error) { return String(error); }
  });
  expect(message).toContain("Stopped.");
  expect((await run(page, "javascript", samples.javascript)).stdout).toBe("hello\n");
});
