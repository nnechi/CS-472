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
directory. It returns a result with collected `stdout` and `stderr`. It also
calls `onUpdate` as text arrives, which can later forward each update to the
requesting WebSocket client:

```ts
import { runJavaScript } from "./compile";

const result = await runJavaScript(
  { language: "javascript", code: "console.log('hello')" },
  { onUpdate: (update) => console.log(update) }
);
console.log(result.stdout); // "hello\n"
```

`CompileUpdate` includes status, stdout/stderr chunks, completion, and errors.
Use `executionId` to associate updates with their request. To cancel a running
job, pass an `AbortController` signal and call `abort()` on disconnect or on a
client cancellation request. The default timeout is 5 seconds and the combined
output limit is 256 KiB; both can be adjusted in `JavaScriptRunOptions`.

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

The other five languages still have command definitions only. Their runners
have not been implemented. Future work should:

1. Run `compile` when present, then `run`, with `spawn` and `shell: false`.
2. Add a global concurrency limit and isolated execution with memory limits.
3. Wire the callback and cancellation signal to the WebSocket layer.

The current server image has Node but does not install Python, Java, GCC, or
G++. `tsc` is supplied by the server's TypeScript development dependency. The
JavaScript runner is suitable for local development; the temporary directory,
timeout, and output cap do not isolate untrusted code from the server's files
or network.
