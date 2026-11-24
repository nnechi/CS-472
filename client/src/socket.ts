import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "./types";
import { SERVER_URL } from "./api";

// One shared socket for the whole app. autoConnect:false lets us connect only
// after the user has chosen a username.
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SERVER_URL,
  // withCredentials sends the login cookie, so the server knows a teacher's picture.
  { autoConnect: false, withCredentials: true }
);
