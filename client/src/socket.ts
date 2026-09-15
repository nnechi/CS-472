import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "./types";

// The browser runs on your host machine, so it reaches the server via
// localhost:3000 (the port docker-compose publishes). You can override this
// with a VITE_SERVER_URL env var without touching code.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

// One shared socket for the whole app. autoConnect:false lets us connect only
// after the user has chosen a username.
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SERVER_URL,
  { autoConnect: false }
);
