import type { Engine } from "@wasm-oj/browser";
import type { RunResult } from "../types";
import { RUN_OUTPUT_MAX_LENGTH, STUDENT_CODE_MAX_LENGTH } from "../types";
import { browserLanguage } from "./languages";
import JS_PRELUDE from "./jsPrelude.js?raw";

const PRELUDE_CALL = `globalThis.eval(${JSON.stringify(JS_PRELUDE)});\n`;
const PRELUDE_ENTRIES = {
  javascript: { file: "__lp.js", source: `${PRELUDE_CALL}await import("./main.js");\n` },
  typescript: { file: "__lp.ts", source: `${PRELUDE_CALL}import "./main";\ndeclare global { interface NodeProcess { exit(code?: number): never; exitCode?: number } }\n` },
} as const;

function cleanScriptErrors(stderr: string, exitCode: number | null) {
  const exit = stderr.match(/(?:^|\n)[^\n]*__LP_EXIT__:(-?\d+)[^\n]*\n*/);
  const code = exit ? ((Number(exit[1]) % 256) + 256) % 256 : exitCode;
  const lines = stderr
    .replace(/Possibly unhandled promise rejection: /g, "")
    .split("\n")
    .filter(line => !/__wasm_oj_|\/project\/bundle\.js|\(native\)|__lp|__LP_EXIT__|at __load\b/.test(line));
  if (exit) while (lines.length > 0 && /^\s+at |^\s*$/.test(lines[lines.length - 1])) lines.pop();
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return { stderr: exit && text !== "" ? `${text}\n` : text, exitCode: code };
}

export interface BrowserRun {
  result: Promise<RunResult>;
  cancel(): void;
}

// The engine owns compiler and runtime Web Workers. Disposing it terminates
// even an infinite loop without blocking the editor or other students.
export function startBrowserRun(activityLanguage: string | null, code: string,
  onOutput: (chunk: string) => void, onPhase: (phase: string) => void): BrowserRun {
  let engine: Engine | undefined;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectStop: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => { rejectStop = reject; });
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    engine?.dispose();
    rejectStop(new Error("Stopped."));
  };
  const execute = async (): Promise<RunResult> => {
    const selected = browserLanguage(activityLanguage);
    if (!selected) throw new Error("This activity's language cannot run in the browser.");
    if (!code.trim()) throw new Error("Write some code before running it.");
    if (code.length > STUDENT_CODE_MAX_LENGTH) throw new Error("Your code is too long to run.");
    // Browsers only grant cross-origin isolation to secure contexts (https or
    // localhost), even when the COOP/COEP headers are present.
    if (!globalThis.isSecureContext) throw new Error("The code runner only works over https or on localhost. Open this page from a secure address or contact your teacher.");
    if (!globalThis.crossOriginIsolated) throw new Error("The code runner needs cross-origin isolation. Reload the page or contact your teacher.");
    timer = setTimeout(() => {
      cancelled = true;
      engine?.dispose();
      rejectStop(new Error("Loading or compiling took too long. Try again."));
    }, 180_000);
    onPhase("Loading language tools…");
    const [{ createBrowserEngine }, clang, python, javascript, java] = await Promise.all([
      import("@wasm-oj/browser"), import("@wasm-oj/toolchain-clang"),
      import("@wasm-oj/toolchain-python"), import("@wasm-oj/toolchain-javascript"),
      import("@wasm-oj/toolchain-java"),
    ]);
    if (cancelled) throw new Error("Stopped.");
    const source = selected.language === "c" || selected.language === "cpp" ? clang
      : selected.language === "python" ? python : selected.language === "java" ? java : javascript;
    const created = await createBrowserEngine({ toolchains: [source.browserSource(`${import.meta.env.BASE_URL}toolchains/${import.meta.env.VITE_WASM_ASSETS_VERSION}/`)], artifactCache: true });
    engine = created;
    if (cancelled) { created.dispose(); throw new Error("Stopped."); }
    let streamed = 0;
    created.onStream((_stream, chunk) => {
      if (cancelled) return;
      const visible = chunk.slice(0, Math.max(0, RUN_OUTPUT_MAX_LENGTH - streamed));
      streamed += visible.length;
      if (visible) onOutput(visible);
    });
    onPhase("Compiling…");
    // Java source filenames must match the declared public class.
    const entry = selected.language === "java"
      ? `${code.match(/\bpublic\s+(?:(?:final|abstract)\s+)*class\s+([A-Za-z_$][\w$]*)/)?.[1] ?? "Main"}.java`
      : selected.entry;
    const prelude = selected.language === "javascript" || selected.language === "typescript" ? PRELUDE_ENTRIES[selected.language] : null;
    const files = prelude ? { [entry]: code, [prelude.file]: prelude.source } : { [entry]: code };
    const build = await created.compile({ language: selected.language, entry: prelude ? prelude.file : entry, files, target: "wasip1", optimization: selected.language === "c" || selected.language === "cpp" ? "release" : "debug" });
    if (!build.success || !build.artifact) {
      const diagnostics = build.diagnostics.map(d => `${d.file}:${d.line}:${d.column}: ${d.message}`).join("\n");
      return { stdout: build.stdout.slice(0, RUN_OUTPUT_MAX_LENGTH), stderr: (build.stderr || diagnostics || "Compilation failed.").slice(0, RUN_OUTPUT_MAX_LENGTH), exitCode: 1, timedOut: false, outputLimitExceeded: false, finishedAt: new Date().toISOString() };
    }
    onPhase("Running…");
    const run = await created.run(build.artifact, { stdin: "", resources: {
      wallTimeLimitMs: 5_000, outputLimitBytes: RUN_OUTPUT_MAX_LENGTH,
      memoryLimitBytes: 512 * 1024 * 1024,
    } });
    const rawStderr = run.stderr || run.trapMessage || (run.termination !== "exited" ? `Execution stopped: ${run.termination}` : "");
    const cleaned = prelude ? cleanScriptErrors(rawStderr, run.code) : { stderr: rawStderr, exitCode: run.code };
    return {
      stdout: run.stdout.slice(0, RUN_OUTPUT_MAX_LENGTH),
      stderr: cleaned.stderr.slice(0, RUN_OUTPUT_MAX_LENGTH),
      exitCode: cleaned.exitCode,
      timedOut: ["wall-time-limit", "logical-time-limit", "instruction-limit"].includes(run.termination),
      outputLimitExceeded: run.termination === "output-limit", finishedAt: new Date().toISOString(),
    };
  };
  return { cancel, result: Promise.race([execute(), stopped]).finally(() => {
    if (timer) clearTimeout(timer);
    engine?.dispose();
  }) };
}
