import express, { ErrorRequestHandler, RequestHandler } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { connectToDatabase } from "./db";
import { registerSocketHandlers } from "./socket";
import { ClientToServerEvents, ServerToClientEvents } from "./types";

const PORT = Number(process.env.PORT) || 3000;
// The browser (running on your host machine) will connect from the Vite dev
// server's origin. We allow it explicitly so CORS doesn't block the connection.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Route scaffolding for the Server methods in the design diagram.
// Replace these handlers when Room, Participant, and authentication are ready.
function notImplemented(operation: string): RequestHandler {
  return (_req, res) => {
    res.status(501).json({ error: "Not implemented", operation });
  };
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: CLIENT_ORIGIN }));
  app.use(express.json());

  // A tiny health-check route so you can confirm the server is up in a browser.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/", (_req, res) => {
    res.json({ name: "CSHELP API", health: "/health" });
  });

  // createRoom(host: RoomHost): string -- body: { host }
  // TODO: Verify the authenticated participant is a RoomHost, generate a unique
  // room code, and store the Room before returning its code.
  app.post("/api/rooms", notImplemented("createRoom"));

  // getRoom(roomCode: string): Room
  app.get("/api/rooms/:roomCode", notImplemented("getRoom"));

  // deleteRoom(roomCode: string): boolean
  // TODO: Restrict deletion to the room host and disconnect its participants.
  app.delete("/api/rooms/:roomCode", notImplemented("deleteRoom"));

  // joinRoom(ID: string, user: Participant): boolean -- body: { user }
  // TODO: Check the room code and capacity before adding the participant.
  app.post("/api/rooms/:roomCode/join", notImplemented("joinRoom"));

  // authenticate(user: string, password: string): boolean
  // Body: { user, password }. TODO: Validate credentials using the auth service.
  app.post("/api/auth/login", notImplemented("authenticate"));

  // onConnect/onDisconnect are registered in socket.ts. generateRoomCode and
  // logEvent are internal helpers, not public HTTP endpoints.
  app.use(express.static("client"));

  app.use((_req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    if (err.type === "entity.too.large") {
      res.status(413).json({ error: "Request body too large" });
      return;
    }
    console.error("[server] request failed:", err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(handleError);

  return app;
}

async function main() {
  await connectToDatabase();
  const app = createApp();

  // Express only handles the HTTP handler; Socket.IO needs the raw http server.
  const server = createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
  });

  registerSocketHandlers(io);

  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[server] startup failed:", err);
    process.exitCode = 1;
  });
}
