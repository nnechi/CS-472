import { Server, Socket } from "socket.io";
import { Message } from "./models/Message";
import {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  Role,
  SocketData,
} from "./types";

export function registerSocketHandlers(
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >
): void {
  // console log for debugging
  io.of("/").adapter.on("create-room", (room) => {
    console.log(`[room] ${room} was created`);
  });
  io.of("/").adapter.on("join-room", (room, id) => {
    console.log(`[room] socket ${id} joined room ${room}`);
  });

  io.on(
    "connection",
    (
      socket: Socket<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
      >
    ) => {
      console.log("[socket] a user connected:", socket.id);

      // Teachers create a room
      // Students join one.
      socket.on("join", async ({ username, role, room }) => {
        const cleanUser = String(username || "").trim().slice(0, 32);
        const roomCode = String(room || "").trim().toUpperCase();

        if (!cleanUser || !roomCode) return;

        // Remember who this socket is so later events don't resend it.
        socket.data.username = cleanUser;
        socket.data.role = role;
        socket.data.room = roomCode;

        //  subscribe this socket to a channel (room).
        socket.join(roomCode);

        //display room code
        // previous room data (messages)
        try {
          const recent = await Message.find({ room: roomCode })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

          const history: ChatMessage[] = recent.reverse().map((m) => ({
            username: m.username,
            role: m.role as Role,
            text: m.text,
            room: m.room,
            createdAt: (m.createdAt as Date).toISOString(),
          }));

          socket.emit("chat history", history);
        } catch (err) {
          console.error("[socket] failed to load history:", err);
        }
      });

      // Mesages limited by room
      socket.on("chat message", async ({ text }) => {
        const { username, role, room } = socket.data;
        if (!username || !room) return; // hasn't joined yet

        const cleanText = String(text || "").trim().slice(0, 1000);
        if (!cleanText) return;

        try {
          const saved = await Message.create({
            username,
            role,
            text: cleanText,
            room,
          });

          const message: ChatMessage = {
            username: saved.username,
            role: saved.role as Role,
            text: saved.text,
            room: saved.room,
            createdAt: (saved.createdAt as Date).toISOString(),
          };

          // broadcast to everyone in this room only.
          io.to(room).emit("chat message", message);
        } catch (err) {
          console.error("[socket] failed to save message:", err);
        }
      });

      socket.on("disconnect", () => {
        console.log("[socket] user disconnected:", socket.id);
      });
    }
  );
}
