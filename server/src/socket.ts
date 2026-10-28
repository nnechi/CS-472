import { Server, Socket } from "socket.io";
import { Message } from "./models/Message";
import { Activity } from "./models/Activity";
import { allowCodeRun, receiveCode } from "./compile/submission";
import { InvalidCompileRequestError } from "./compile/plan";
import { runJavaScript, runTypeScript } from "./compile";
import {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  ACTIVITY_MAX_LENGTH,
  GROUP_CHAT_ID,
  InterServerEvents,
  PrivateChat,
  RaisedHand,
  Role,
  SocketData,
  TimerState,
} from "./types";


import { Room } from "./models/Room"; 



export type AppServer = Server< 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData
>; 



// need helper function to disconnect all of the things from the room. 
export function closeRoom(io : AppServer, room : string): void {
  io.to(room).emit("room closed");
  handQueues.delete(room);
  privateChats.delete(room);
  clearTimer(room);
  io.in(room).disconnectSockets();
}

//raise hands are not stored in database,
const handQueues = new Map<string, RaisedHand[]>();

// Private chats are not stored in database, like raised hands. Each room maps
// a student's socket id to that chat's details and its recent messages.
interface PrivateChatState {
  chat: PrivateChat;
  messages: ChatMessage[];
  // The student's activity text, as last sent by them.
  activity: string;
}
const privateChats = new Map<string, Map<string, PrivateChatState>>();
// Same cap as the group chat's history on join.
const PRIVATE_HISTORY_LIMIT = 50;
const MAX_ACTIVE_CODE_RUNS = 2;
let activeCodeRuns = 0;

// The room's private chats, created on first use.
const roomPrivateChats = (room: string): Map<string, PrivateChatState> => {
  let chats = privateChats.get(room);
  if (!chats) {
    chats = new Map();
    privateChats.set(room, chats);
  }
  return chats;
};

// The questions of the activity a room uses, as the text students see. Outputs
// are left out. Empty if none is picked. If it can't be loaded, students still
// join, just without the activity text.
async function loadActivityText(activityId: unknown): Promise<string> {
  if (!activityId) return "";
  try {
    const activity = await Activity.findById(activityId).select("questions").lean();
    return (activity?.questions ?? []).map((q) => q.question).join("\n\n");
  } catch (err) {
    console.error("[socket] failed to load activity:", err);
    return "";
  }
}

// Every room starts with a 15 minute countdown that is not running.
const DEFAULT_TIMER_MS = 15 * 60 * 1000;
// Teachers can set a length from 1 minute up to 1 hour.
const MAX_TIMER_MINUTES = 60;

// durationMs is the length the teacher chose (Restart goes back to it).
// endsAt is set while the timer runs and null while it is paused.
// expiry fires when a running timer reaches zero.
interface RoomTimer {
  durationMs: number;
  remainingMs: number;
  endsAt: number | null;
  expiry?: ReturnType<typeof setTimeout>;
}

// Timers are not stored in database, like raised hands.
const timers = new Map<string, RoomTimer>();

const getTimer = (room: string): RoomTimer => {
  let timer = timers.get(room);
  if (!timer) {
    timer = { durationMs: DEFAULT_TIMER_MS, remainingMs: DEFAULT_TIMER_MS, endsAt: null };
    timers.set(room, timer);
  }
  return timer;
};

// Stops the room's timer and forgets it (used when the room closes).
function clearTimer(room: string): void {
  const timer = timers.get(room);
  if (timer?.expiry) clearTimeout(timer.expiry);
  timers.delete(room);
}

// What clients see: time left right now, and whether it is counting down.
function timerSnapshot(room: string): TimerState {
  const timer = getTimer(room);
  if (timer.endsAt === null) {
    return { durationMs: timer.durationMs, remainingMs: timer.remainingMs, running: false };
  }
  return {
    durationMs: timer.durationMs,
    remainingMs: Math.max(0, timer.endsAt - Date.now()),
    running: true,
  };
}

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

  // Send the room's timer to that room's teachers only.
  const broadcastTimer = (room: string) => {
    io.to(teacherChannel(room)).emit("timer state", timerSnapshot(room));
  };

  // Tell both the student and the room's teachers that a private chat exists.
  // The student's socket is in a room named after its own id.
  const sendPrivateChat = (room: string, state: PrivateChatState) => {
    io.to([state.chat.id, teacherChannel(room)]).emit("private chat opened", {
      chat: state.chat,
      messages: state.messages,
      activity: state.activity,
    });
  };

  // Remove a student's private chat, e.g. when they leave. Teachers see it close.
  const closePrivateChat = (room: string, studentId: string) => {
    if (!privateChats.get(room)?.delete(studentId)) return;
    io.to(teacherChannel(room)).emit("private chat closed", studentId);
  };

  // Start counting down. When time runs out, the timer stops at zero.
  const playTimer = (room: string) => {
    const timer = getTimer(room);
    if (timer.endsAt !== null) return; // already running
    // A finished timer starts over at the full time.
    if (timer.remainingMs <= 0) timer.remainingMs = timer.durationMs;

    timer.endsAt = Date.now() + timer.remainingMs;
    timer.expiry = setTimeout(() => {
      timer.remainingMs = 0;
      timer.endsAt = null;
      timer.expiry = undefined;
      broadcastTimer(room);
    }, timer.remainingMs);
    broadcastTimer(room);
  };

  // Stop counting down and keep the time that is left.
  const pauseTimer = (room: string) => {
    const timer = getTimer(room);
    if (timer.endsAt === null) return; // already paused
    timer.remainingMs = Math.max(0, timer.endsAt - Date.now());
    timer.endsAt = null;
    if (timer.expiry) clearTimeout(timer.expiry);
    timer.expiry = undefined;
    broadcastTimer(room);
  };

  // Put the timer back to its full length and stop it. Teacher presses Play to start again.
  const restartTimer = (room: string) => {
    const timer = getTimer(room);
    if (timer.expiry) clearTimeout(timer.expiry);
    timer.remainingMs = timer.durationMs;
    timer.endsAt = null;
    timer.expiry = undefined;
    broadcastTimer(room);
  };

  // Change the length (whole minutes, 1 to 60). Only while paused, so a
  // running countdown is never changed by accident.
  const setTimerLength = (room: string, minutes: number) => {
    const timer = getTimer(room);
    if (timer.endsAt !== null) return; // running, so ignore
    const wholeMinutes = Math.round(Number(minutes));
    if (!Number.isFinite(wholeMinutes) || wholeMinutes < 1 || wholeMinutes > MAX_TIMER_MINUTES) return;

    timer.durationMs = wholeMinutes * 60 * 1000;
    timer.remainingMs = timer.durationMs;
    broadcastTimer(room);
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
      let activeCodeRun: AbortController | null = null;
      const codeRunHistory: number[] = [];

      // Teachers create a room
      // Students join one.
      socket.on("join", async ({ username, role, room }) => {
        const cleanUser = String(username || "").trim().slice(0, 32);
        const roomCode = String(room || "").trim().toUpperCase();

        if (!cleanUser || !roomCode) return;

        let roomActivity = "";
        try{
        const success = await Room.findOne( {code : roomCode });
          if (success === null || success.expiresAt === null || success.expiresAt.getTime() <= Date.now()){
            socket.emit("join error");
            socket.disconnect();
            return;
        }
          roomActivity = await loadActivityText(success.activityId);

        } catch (e){
          console.error(e); 
          socket.emit("join error"); 
          socket.disconnect(); 
          return; 
          
        }
        
      
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
          // Put back any private chats still open in this room.
          for (const state of roomPrivateChats(roomCode).values()) {
            socket.emit("private chat opened", {
              chat: state.chat,
              messages: state.messages,
              activity: state.activity,
            });
          }
        }

        // Everyone starts from the teacher's saved activity.
        socket.emit("room activity", roomActivity);

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
            chatId: GROUP_CHAT_ID,
          }));

          socket.emit("chat history", history);
        } catch (err) {
          console.error("[socket] failed to load history:", err);
        }

        // Late joining teachers see the timer as it is right now.
        if (role === "teacher") socket.emit("timer state", timerSnapshot(roomCode));
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
            chatId: GROUP_CHAT_ID,
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

      // Only the teacher can start or pause the countdown.
      socket.on("timer play", () => {
        const { role, room } = socket.data;
        if (!room || role !== "teacher") return;
        playTimer(room);
      });

      socket.on("timer pause", () => {
        const { role, room } = socket.data;
        if (!room || role !== "teacher") return;
        pauseTimer(room);
      });

      socket.on("timer restart", () => {
        const { role, room } = socket.data;
        if (!room || role !== "teacher") return;
        restartTimer(room);
      });

      socket.on("timer set", ({ minutes }) => {
        const { role, room } = socket.data;
        if (!room || role !== "teacher") return;
        setTimerLength(room, minutes);
      });

      // Teachers open a private chat from the hand queue. Only students in
      // this room can be chatted with, and reopening one just resends it.
      socket.on("open private chat", ({ studentId }) => {
        const { username, role, room } = socket.data;
        if (!room || role !== "teacher") return;

        const id = String(studentId || "");
        const student = io.sockets.sockets.get(id);
        if (!student || student.data.room !== room || student.data.role !== "student") return;

        const chats = roomPrivateChats(room);
        if (!chats.has(id)) {
          chats.set(id, {
            chat: { id, studentName: student.data.username, teacherName: username },
            messages: [],
            // Filled in when the student's copy syncs, right after they're opened.
            activity: "",
          });
        }
        sendPrivateChat(room, chats.get(id)!);
      });

      // Students can only write in their own private chat. Teachers can write
      // in any private chat in their room.
      socket.on("private message", ({ chatId, text }) => {
        const { username, role, room } = socket.data;
        if (!username || !room) return;

        const state = privateChats.get(room)?.get(String(chatId || ""));
        if (!state) return;
        if (role === "student" && state.chat.id !== socket.id) return;

        const cleanText = String(text || "").trim().slice(0, 1000);
        if (!cleanText) return;

        const message: ChatMessage = {
          username,
          role,
          text: cleanText,
          room,
          createdAt: new Date().toISOString(),
          chatId: state.chat.id,
        };
        state.messages = [...state.messages, message].slice(-PRIVATE_HISTORY_LIMIT);

        // Only the student in this chat and the room's teachers get it.
        io.to([state.chat.id, teacherChannel(room)]).emit("private message", message);
      });

      // A student's activity only reaches the teacher while their private chat
      // is open. Otherwise the text stays on the student's screen.
      socket.on("activity update", ({ text }) => {
        const { role, room } = socket.data;
        if (!room || role !== "student") return;

        const state = privateChats.get(room)?.get(socket.id);
        if (!state) return;

        state.activity = String(text ?? "").slice(0, ACTIVITY_MAX_LENGTH);
        io.to(teacherChannel(room)).emit("student activity", {
          chatId: socket.id,
          text: state.activity,
        });
      });

      // Run one submission per student socket. Output stays on the server for
      // now; the acknowledgement only reports completion status.
      socket.on("code:submit", async (payload, acknowledge) => {
        if (typeof acknowledge !== "function") return;
        if (socket.data.role !== "student" || !socket.data.room) {
          acknowledge({ accepted: false, message: "Join a room as a student first." });
          return;
        }
        if (activeCodeRun) {
          acknowledge({ accepted: false, message: "A code run is already in progress." });
          return;
        }
        if (activeCodeRuns >= MAX_ACTIVE_CODE_RUNS) {
          acknowledge({ accepted: false, message: "The code runner is busy. Try again shortly." });
          return;
        }

        let receipt: ReturnType<typeof receiveCode>;
        try {
          receipt = receiveCode(payload);
        } catch (error) {
          if (error instanceof InvalidCompileRequestError) {
            acknowledge({ accepted: false, message: error.message });
          } else {
            console.error("[socket] invalid code submission:", error);
            acknowledge({ accepted: false, message: "Could not receive code." });
          }
          return;
        }
        if (!allowCodeRun(codeRunHistory)) {
          acknowledge({ accepted: false, message: "Too many runs. Try again in a minute." });
          return;
        }

        const controller = new AbortController();
        activeCodeRun = controller;
        activeCodeRuns += 1;
        try {
          const runner = receipt.language === "typescript" ? runTypeScript : runJavaScript;
          const result = await runner(payload, { signal: controller.signal });
          acknowledge({
            accepted: true,
            ...receipt,
            exitCode: result.exitCode,
            timedOut: result.timedOut,
            cancelled: result.cancelled,
            outputLimitExceeded: result.outputLimitExceeded,
          });
        } catch (error) {
          console.error("[socket] code run failed:", error);
          acknowledge({ accepted: false, message: "Could not run code." });
        } finally {
          activeCodeRun = null;
          activeCodeRuns -= 1;
        }
      });

      socket.on("disconnect", () => {
        activeCodeRun?.abort();
        console.log("[socket] user disconnected:", socket.id);
        // A student who leaves shouldn't stay in the teacher's list.
        if (socket.data.room) removeHand(socket.data.room, socket.id);
        if (socket.data.room && socket.data.role === "student") {
          closePrivateChat(socket.data.room, socket.id);
        }
      });
    }
  );
}
