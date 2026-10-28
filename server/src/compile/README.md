# Compile module

`createExecutionPlan(rawRequest)` validates an incoming request and returns the
fixed source filename and command specs for JavaScript, TypeScript, C, C++, Java,
or Python. It throws `InvalidCompileRequestError` for rejected input. Import the
public API from `./compile` in whichever transport handles compile requests.

Example request:

```ts
{ language: "python", code: "print('hello')", stdin: "" }
```

`runJavaScript(request, options)` runs JavaScript in a temporary working
directory. `runTypeScript(request, options)` type-checks and compiles a
TypeScript file there, then runs the emitted JavaScript if compilation succeeds.
Both return collected `stdout` and `stderr` and call `onUpdate` as text arrives,
which can later forward each update to the requesting WebSocket client:

```ts
import { runJavaScript, runTypeScript } from "./compile";

const result = await runJavaScript(
  { language: "javascript", code: "console.log('hello')" },
  { onUpdate: (update) => console.log(update) }
);
console.log(result.stdout); // "hello\n"

const tsResult = await runTypeScript(
  { language: "typescript", code: "const n: number = 42; console.log(n)" },
  { onUpdate: (update) => console.log(update) }
);
console.log(tsResult.stdout); // "42\n"
```

`CompileUpdate` includes status, stdout/stderr chunks, completion, and errors.
Use `executionId` to associate updates with their request. To cancel a running
job, pass an `AbortController` signal and call `abort()` on disconnect or on a
client cancellation request. The default run timeout is 5 seconds, the
TypeScript compile timeout is 10 seconds, and the combined output limit is
256 KiB. These can be adjusted in the run options. TypeScript diagnostics are
streamed as output; a failed compile never starts the program. The TypeScript
runner currently accepts a single source file named `main.ts`.

The student room sends `{ language, code }` over the existing Socket.IO
connection with `code:submit`. The server checks that the socket joined as a
student, validates the code, then runs JavaScript or TypeScript. Its
acknowledgement contains the language, UTF-8 byte count, exit code, and stop
reason flags. It does not send stdout, stderr, compiler diagnostics, or other
program output to the browser. The room shows only the completion status.
Only one run per socket and two runs across the server can be active at once;
a disconnect cancels that socket's run.

Basic submission guards: only `language` and `code` fields are accepted, source
must be nonempty and at most 64 KiB in UTF-8, NUL characters are rejected,
and Socket.IO messages are capped at 128 KiB. A socket can start up to five
runs in a rolling minute. User programs also get a 128 MiB V8 heap limit.
Source code is not rewritten or stripped, since that would change what the
student wrote. The per-socket rate limit resets on reconnect, and the V8 heap
limit is not a total process memory limit.

Install server dependencies once from the `server` directory:

```sh
cd server
npm install
npm run test:compile
```

After installation, from the repository root you can run
`npm --prefix server run test:compile`.

`tsx` is a server development dependency. Running `node --import tsx` from the
repository root looks for `tsx` at the root and fails with
`ERR_MODULE_NOT_FOUND`; use the npm script above instead.

The other four languages still have command definitions only. Their runners
have not been implemented. Future work should:

1. Add runners for C, C++, Java, and Python.
2. Add isolated execution with operating-system memory and process limits.
3. Wire the output callback to the WebSocket layer when output streaming is ready.

The current server image has Node but does not install Python, Java, GCC, or
G++. `tsc` is supplied by the server's TypeScript dependency. These runners are
suitable for local development; the temporary directory,
timeout, and output cap do not isolate untrusted code from the server's files
or network.
