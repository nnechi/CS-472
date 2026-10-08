import { Server, Socket } from "socket.io";
import { Message } from "./models/Message";
import {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  RaisedHand,
  Role,
  SocketData,
} from "./types";

//raise hands are not stored in database, 
const handQueues = new Map<string, RaisedHand[]>();

export function registerSocketHandlers(
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >
): void {
  const getQueue = (room: string) => handQueues.get(room) ?? [];

  //separate room, a "channel" for teachers of a room to get the raise hand broadcasts.
  //students don't see other students waiting
  const teacherChannel = (room: string) => `${room}:teachers`;

  // Store a room's queue and send it to that room's teachers.
  const setQueue = (room: string, queue: RaisedHand[]) => {
    if (queue.length) handQueues.set(room, queue);
    else handQueues.delete(room);
    io.to(teacherChannel(room)).emit("hand queue", queue);
  };

  //Remove a student from queue and notify after help is recieved.
  const removeHand = (room: string, id: string) => {
    const queue = getQueue(room);
    const next = queue.filter((h) => h.id !== id);
    if (next.length === queue.length) return; // wasn't raised
    setQueue(room, next);
    io.to(id).emit("hand status", false);
  };

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

        // Only teachers get the list of who needs help.
        if (role === "teacher") {
          socket.join(teacherChannel(roomCode));
          socket.emit("hand queue", getQueue(roomCode));
        }

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

      //Raise hand feature
      // Students can ask for help or signal they no longer need it.
      socket.on("raise hand", () => {
        const { username, role, room } = socket.data;
        if (!username || !room || role !== "student") return;

        const queue = getQueue(room);
        if (queue.some((h) => h.id === socket.id)) {
          removeHand(room, socket.id);
          return;
        }

        setQueue(room, [
          ...queue,
          { id: socket.id, username, raisedAt: new Date().toISOString() },
        ]);
        socket.emit("hand status", true);
      });

      // Teacher signals the student is helped.
      socket.on("lower hand", ({ id }) => {
        const { role, room } = socket.data;
        if (!room || role !== "teacher") return;
        removeHand(room, String(id || ""));
      });

      socket.on("disconnect", () => {
        console.log("[socket] user disconnected:", socket.id);
        // A student who leaves shouldn't stay in the teacher's list.
        if (socket.data.room) removeHand(socket.data.room, socket.id);
      });
    }
  );
}
