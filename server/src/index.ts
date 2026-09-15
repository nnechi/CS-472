import express from "express";
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

async function main() {
  await connectToDatabase();

  const app = express();
  app.use(cors({ origin: CLIENT_ORIGIN }));

  // A tiny health-check route so you can confirm the server is up in a browser.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

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

main();
