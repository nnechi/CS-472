# LittlePointers

Start the app with Docker Desktop running:

```sh
docker compose up --build
```

Open http://localhost:5173/. Docker runs the web app, API, and MongoDB. It does
not compile or execute student code. No runner token or Docker socket is needed.

## Browser code runner

The language the teacher selects during activity setup determines the toolchain
used in the room. Students cannot change it. Python, JavaScript, TypeScript, Java,
C, and C++ compile/run entirely in the browser using pinned `@wasm-oj` WebAssembly
toolchains and isolated Web Workers. Python and JavaScript/TypeScript use Wasm
language runtimes; C/C++ and Java compile to Wasm. Java uses TeaVM and supports
its Java/class-library subset, rather than a full desktop JVM. Node.js APIs,
native extensions, OS processes, and network access are unavailable to programs.

The first run downloads static language tools from this app (about 5–54 MB,
depending on language), and compilation artifacts can be cached in IndexedDB.
Run output streams into the editor. Stop terminates the workers; execution is
limited to 5 seconds, 512 MB guest memory, and 20,000 output bytes. Toolchain
loading/compilation has a separate 3-minute limit. Browser toolchains themselves
may need additional memory, especially for C++.

The API only synchronizes code and completed student-reported output for teacher
views and saved rooms. Results are checked against the current seat and exact
source, bounded, and timestamped by the server. They are not authoritative grades.
There is no backend execution endpoint or fallback.

### Development and deployment

The client requires Node 24.18+ (24.x). Run `npm ci` and `npm run dev` in `client/`.
The API can run separately with `npm ci` and `npm run dev` in `server/`.

`npm run build` copies the installed toolchain assets into `dist/toolchains/`
and the engine's workers/Wasm into `dist/runner-assets/`. Deploy the **whole**
`dist` directory at the origin root, using HTTPS (localhost works for development).
The static host must send these headers, including on worker responses:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

Serve `.wasm` as `application/wasm` and `.js`/`.mjs` as JavaScript. If a Content
Security Policy is used, allow same-origin workers, `blob:` workers, and Wasm
compilation (`script-src 'self' 'wasm-unsafe-eval'`). Vite dev and preview already
set the isolation headers. Check OAuth popup flows against the chosen production
headers, since cross-origin isolation severs cross-origin opener relationships.
Toolchain assets retain upstream licenses; see the installed packages'
`THIRD_PARTY_NOTICES.md` and `licenses/` directories, also copied to
`dist/toolchain-licenses/`.

### Verification

```sh
cd client
npm run build
npx playwright install chromium
npm run test:runner
```

Browser tests cover all six languages, compiler diagnostics, timeout, cancellation,
output limits, and recovery. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an
installed Chrome executable. Run `npm run typecheck` and `npm run test:parsons`
and `npm run test:browser-run` in `server/` to verify the API, reported output
validation, and existing Parsons grader.
