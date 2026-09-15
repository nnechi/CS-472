import { Server, Socket } from "socket.io";
import { Message } from "./models/Message";
import {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
} from "./types";

// This is the heart of the app. It mirrors the socket.io "get started" tutorial
// (connection -> "chat message" -> broadcast), but adds two things:
//   1. every message carries a username
//   2. every message is saved to MongoDB, and history is replayed on join
export function registerSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>
): void {
  io.on(
    "connection",
    async (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
      console.log("[socket] a user connected:", socket.id);

      // Send the last 50 messages to the user who just joined, oldest first.
      try {
        const recent = await Message.find()
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();

        const history: ChatMessage[] = recent.reverse().map((m) => ({
          username: m.username,
          text: m.text,
          createdAt: (m.createdAt as Date).toISOString(),
        }));

        socket.emit("chat history", history);
      } catch (err) {
        console.error("[socket] failed to load history:", err);
      }

      // When a client sends a "chat message", validate it, store it,
      // then broadcast it to EVERYONE (including the sender), just like the tutorial.
      socket.on("chat message", async ({ username, text }) => {
        const cleanUser = String(username || "").trim().slice(0, 32);
        const cleanText = String(text || "").trim().slice(0, 1000);
        if (!cleanUser || !cleanText) return;

        try {
          const saved = await Message.create({
            username: cleanUser,
            text: cleanText,
          });

          const message: ChatMessage = {
            username: saved.username,
            text: saved.text,
            createdAt: (saved.createdAt as Date).toISOString(),
          };

          io.emit("chat message", message);
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
