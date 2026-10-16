# Compile module scaffold

`createExecutionPlan(rawRequest)` validates an incoming request and returns the
fixed source filename and command specs for JavaScript, TypeScript, C, C++, Java,
or Python. It throws `InvalidCompileRequestError` for rejected input. Import the
public API from `./compile` in whichever transport handles compile requests.

Example request:

```ts
{ language: "python", code: "print('hello')", stdin: "" }
```

The `CompileUpdate` union describes status, stdout/stderr chunks, completion,
and errors. The transport should send updates only to the client that started
the execution, using `executionId` to associate them with the request.

This scaffold does not execute code yet. The next implementation should:

1. Create one temporary working directory per execution and write `sourceFile`.
2. Run `compile` when present, then `run`, with `spawn` and `shell: false`.
3. Forward stdout and stderr chunks through an `OnCompileUpdate` callback.
4. Enforce time, output, memory, and concurrency limits; support cancellation.
5. Stop active work on disconnect and remove temporary files in `finally`.
6. Execute submissions in an isolated environment with the listed toolchains.

The current server image has Node but does not install Python, Java, GCC, or
G++. `tsc` is supplied by the server's TypeScript development dependency.
