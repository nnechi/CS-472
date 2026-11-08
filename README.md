1. Install Docker
2. Open docker Desktop
3. open terminal/cmd
4. Navigate to project folder
5. First time only: make the `.env` file the code runner needs
```
cp .env.example .env
```
(On Windows cmd: `copy .env.example .env`)

Then open `.env` and set `RUNNER_TOKEN` to a random value. Generate one with:
```
openssl rand -hex 32
```
or, if you don't have openssl (e.g. on Windows):
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Never commit `.env`. Without it, `docker compose up` stops with "Set RUNNER_TOKEN in .env".

6. run command
docker compose up --build
7. Navigate to:
http://localhost:5173/

Running the server outside Docker (`cd server && npm run dev`): there is no code
runner, so Run is refused with "Running code isn't set up on this server." For local
development only, set `ALLOW_UNSANDBOXED_RUNS=1` in `server/.env` to run code
directly on your machine without a sandbox. Never use it in production.
