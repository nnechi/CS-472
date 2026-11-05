import { Server, Socket } from "socket.io";
import type { IncomingMessage } from "http";
import type { Session, SessionData } from "express-session";
import { Message } from "./models/Message";
import { Activity } from "./models/Activity";
import { ParsonsOptions, DEFAULT_PARSONS_OPTIONS } from "./parsons/options";
import { parseInitial, studentPool } from "./parsons/parse";
import { gradeLineBased } from "./parsons/grade";
import {
  ActivityType,
  AnswerProgress,
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  ACTIVITY_MAX_LENGTH,
  ACTIVITY_MAX_QUESTIONS,
  PARSONS_MAX_LINES,
  GROUP_CHAT_ID,
  InterServerEvents,
  ParsonsDisplayOptions,
  ParsonsLine,
  Participant, 
  PrivateChat,
  RaisedHand,
  RosterStudent,
  RoomActivity,
  RoomQuestion,
  Role,
  SocketData,
  STUDENT_CODE_MAX_LENGTH,
  StudentEnvironment,
  TimerState,
  emptyStudentEnvironment,
} from "./types";
import { randomUUID } from "node:crypto";
import { CodeRunJob, InvalidRunJobError, JobHooks, executionQueue, runnableLanguage } from "./compile";
import { InvalidCompileRequestError } from "./compile/plan";

import { Room } from "./models/Room"; 

// The socket's first HTTP request, with the login session attached
// (see io.engine.use(sessionMiddleware) in index.ts).
type SessionRequest = IncomingMessage & { session?: Session & Partial<SessionData> };

// A pup avatar id is a short lowercase word like "corgi". The client keeps the
// list of breeds; anything else is ignored so nobody can send odd values.
function cleanPup(value: unknown): string | null {
  return typeof value === "string" && /^[a-z]{2,20}$/.test(value) ? value : null;
}

export type AppServer = Server< 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData
>; 

  //separate room, a "channel" for teachers of a room to get the raise hand broadcasts.
  //students don't see other students waiting
export function teacherChannel(room: string) {
return `${room}:teachers`; 
}

// students wait until teacher opens a room. 
export function lobbyChannel(room : string){ 
  return `${room}:lobby`; 
}



// need helper function to disconnect all of the things from the room. 
export function closeRoom(io : AppServer, room : string): void {
  io.to([room, lobbyChannel(room)]).emit("room closed");
  handQueues.delete(room);
  rosters.delete(room);
  privateChats.delete(room);
  clearEnvironments(room);
  roomActivities.delete(room);
  currentQuestions.delete(room);
  clearTimer(room);
  io.in([room, lobbyChannel(room)]).disconnectSockets();
}

export async function broadcastParticipants(io : AppServer, room : string){ 
  const sockets = await io.in([room, lobbyChannel(room)]).fetchSockets(); 
  const list : Participant[] = sockets.filter((s) => s.data.role === "student").map((s) => ({id : s.id, username : s.data.username})); 
  io.to(teacherChannel(room)).emit("participants",list); 
} 

//raise hands are not stored in database,
const handQueues = new Map<string, RaisedHand[]>();

// Students currently connected to the room, teachers only. Not stored in the
// database, like raised hands -- it only ever reflects who's connected right now.
const rosters = new Map<string, RosterStudent[]>();

// The question the teacher picked, by room. Rooms start on the first question.
// Not stored in database, like raised hands.
const currentQuestions = new Map<string, number>();

// Private chats are not stored in database, like raised hands. Each room maps
// a student's socket id to that chat's details and its recent messages.
interface PrivateChatState {
  chat: PrivateChat;
  messages: ChatMessage[];
  // The student's work on the activity, as last sent by them.
  progress: AnswerProgress;
}
const privateChats = new Map<string, Map<string, PrivateChatState>>();
// Same cap as the group chat's history on join.
const PRIVATE_HISTORY_LIMIT = 50;

// The room's private chats, created on first use.
const roomPrivateChats = (room: string): Map<string, PrivateChatState> => {
  let chats = privateChats.get(room);
  if (!chats) {
    chats = new Map();
    privateChats.set(room, chats);
  }
  return chats;
};

// Each student's workspace, by room and then by studentKey. Not stored in the
// database, like raised hands. A student who disconnects keeps theirs for a
// while, so a refresh or a dropped connection doesn't lose their work.
interface StoredEnvironment {
  env: StudentEnvironment;
  // The socket using it right now, or null while the student is away.
  socketId: string | null;
  // Set while the student is away: removes the environment when it fires.
  expiry?: ReturnType<typeof setTimeout>;
}
const environments = new Map<string, Map<string, StoredEnvironment>>();

// What a run needs to know about the room's activity, saved when someone
// joins so a run doesn't need a database lookup. Deleted when the room closes.
const roomActivities = new Map<string, { language: string | null; questionCount: number }>();

// Whose job a run is in the execution queue. Students use their studentKey.
// Teachers have no environment, so each teacher connection gets its own key.
function runOwner(data: { role: Role; studentKey: string | null }, socketId: string): string | null {
  if (data.role === "teacher") return `teacher:${socketId}`;
  return data.studentKey ?? null;
}
// How long a disconnected student's environment is kept.
const ENVIRONMENT_GRACE_MS = 5 * 60 * 1000;

// The room's environments, created on first use.
const roomEnvironments = (room: string): Map<string, StoredEnvironment> => {
  let envs = environments.get(room);
  if (!envs) {
    envs = new Map();
    environments.set(room, envs);
  }
  return envs;
};

// Forget every environment in a room (used when the room closes).
function clearEnvironments(room: string): void {
  for (const stored of environments.get(room)?.values() ?? []) {
    if (stored.expiry) clearTimeout(stored.expiry);
  }
  environments.delete(room);
}

// A studentKey is what the server handed out: a UUID. Anything else is ignored.
function cleanStudentKey(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;
}

// Give a joining student their environment and return its key: the one under
// the key they sent if it's free, or a new one. A key another connected
// socket is using is never shared -- that happens when a browser duplicates a
// tab, storage and all -- so the second tab gets a fresh environment.
function claimEnvironment(
  room: string,
  socketId: string,
  username: string,
  requestedKey: string | null,
  activity: RoomActivity | null
): string {
  const envs = roomEnvironments(room);
  const existing = requestedKey ? envs.get(requestedKey) : undefined;

  if (existing && (existing.socketId === null || existing.socketId === socketId)) {
    if (existing.expiry) clearTimeout(existing.expiry);
    existing.expiry = undefined;
    existing.socketId = socketId;
    existing.env.username = username;
    return existing.env.studentKey;
  }

  // A key nobody holds (e.g. the server restarted) is kept, so the client's
  // saved key stays valid. A key in use gets a new one.
  const key = requestedKey && !existing ? requestedKey : randomUUID();
  envs.set(key, {
    env: emptyStudentEnvironment(key, username, activity?.type ?? null, activity?.questions.length ?? 0),
    socketId,
  });
  return key;
}

// A student's socket left. Their environment stays for ENVIRONMENT_GRACE_MS
// in case they come back, then it's removed. Does nothing if a newer
// connection has already claimed it (a refresh can rejoin before the old
// socket's disconnect arrives).
function releaseEnvironment(room: string, key: string, socketId: string): void {
  const stored = environments.get(room)?.get(key);
  if (!stored || stored.socketId !== socketId) return;
  stored.socketId = null;
  stored.expiry = setTimeout(() => {
    const envs = environments.get(room);
    if (envs?.get(key) !== stored) return;
    envs.delete(key);
    if (envs.size === 0) environments.delete(room);
  }, ENVIRONMENT_GRACE_MS);
}

// The display settings a student's widget needs, from a question's options.
function displaySettings(options: Partial<ParsonsOptions> | undefined): ParsonsDisplayOptions {
  const settings = { ...DEFAULT_PARSONS_OPTIONS, ...options };
  return {
    requireDragging: settings.requireDragging,
    canIndent: settings.canIndent,
    xIndent: settings.xIndent,
    showFeedback: settings.showFeedback,
  };
}

// The activity a room uses, shaped for the person receiving it. Students get
// the question text and correct output, and for Parsons the lines to arrange plus the display
// settings. Teachers also get the answers. Null if none is picked. If it can't
// be loaded, students still join, just without an activity.
async function loadRoomActivity(activityId: unknown, role: Role): Promise<RoomActivity | null> {
  if (!activityId) return null;
  try {
    const activity = await Activity.findById(activityId).lean();
    if (!activity) return null;
    const type = activity.type as ActivityType;

    const questions: RoomQuestion[] = activity.questions.map((q) => {
      if (type === "coding") {
        return { question: q.question, output: q.output };

      }
      const problem = parseInitial(q.initial);
      const options = displaySettings(q.options as Partial<ParsonsOptions>);
      if (role === "teacher") {
        return { question: q.question, solution: problem.solution, distractors: problem.distractors, options };
      }
      const { maxWrongLines } = { ...DEFAULT_PARSONS_OPTIONS, ...(q.options as Partial<ParsonsOptions>) };
      return {
        question: q.question,
        lines: studentPool(problem.solution, problem.distractors, maxWrongLines),
        options,
      };
    });
    return { type, language: activity.language ?? null, questions };
  } catch (err) {
    console.error("[socket] failed to load activity:", err);
    return null;
  }
}

// One Parsons question of a room's activity: its solution and options, or null
// if the room has no Parsons question at that index.
async function loadParsonsQuestion(
  room: string,
  questionIndex: number
): Promise<{ solution: ParsonsLine[]; options: ParsonsOptions } | null> {
  const found = await Room.findOne({ code: room }).select("activityId").lean();
  if (!found?.activityId) return null;
  const activity = await Activity.findById(found.activityId).select("type questions").lean();
  if (!activity || activity.type !== "parsons") return null;
  const question = activity.questions[questionIndex];
  if (!question) return null;
  return {
    solution: parseInitial(question.initial).solution,
    options: { ...DEFAULT_PARSONS_OPTIONS, ...(question.options as Partial<ParsonsOptions>) },
  };
}

// One student's arrangement of lines, kept within the teacher editor's limits.
// Returns null if the message isn't a list of lines.
function cleanLines(value: unknown): ParsonsLine[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .slice(0, PARSONS_MAX_LINES)
    .map((line) => ({
      code: typeof line?.code === "string" ? line.code.slice(0, ACTIVITY_MAX_LENGTH) : "",
      indent: Number.isInteger(line?.indent) ? Math.min(Math.max(line.indent, 0), MAX_INDENT_LEVEL) : 0,
    }))
    .filter((line) => line.code !== "");
}

// The arrangements for every question. Returns null if the message isn't a list.
function cleanAnswers(value: unknown): ParsonsLine[][] | null {
  if (!Array.isArray(value)) return null;
  return value.slice(0, ACTIVITY_MAX_QUESTIONS).map((lines) => cleanLines(lines) ?? []);
}

// A copy of list with value set at index. Any gap before it is filled with fill,
// so the list never has holes.
function withValue<T>(list: T[], index: number, value: T, fill: T): T[] {
  const copy = [...list];
  while (copy.length < index) copy.push(fill);
  copy[index] = value;
  return copy;
}

// Every room starts with a 15 minute countdown that is not running.
const DEFAULT_TIMER_MS = 15 * 60 * 1000;
// Teachers can set a length from 1 minute up to 1 hour.
// The deepest indent a student can give a line in a Parsons problem.
const MAX_INDENT_LEVEL = 20;
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

  


  // Tell the room's teachers how many students are in it right now.
  const sendStudentCount = async (room: string) => {
    const sockets = await io.in(room).fetchSockets();
    const count = sockets.filter((s) => s.data.role === "student").length;
    io.to(teacherChannel(room)).emit("student count", count);
  };

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

  const getRoster = (room: string) => rosters.get(room) ?? [];

  // Store a room's connected-student list and send it to that room's teachers.
  const setRoster = (room: string, roster: RosterStudent[]) => {
    if (roster.length) rosters.set(room, roster);
    else rosters.delete(room);
    io.to(teacherChannel(room)).emit("room roster", roster);
  };

  // A student joined the room.
  const addToRoster = (room: string, student: RosterStudent) => {
    const roster = getRoster(room);
    // Already there (e.g. "join" fired twice for the same connection, which
    // React's StrictMode does once in development) -- nothing to add.
    if (roster.some((s) => s.id === student.id)) return;
    setRoster(room, [...roster, student]);
  };

  // A student left the room (disconnected).
  const removeFromRoster = (room: string, id: string) => {
    const roster = getRoster(room);
    const next = roster.filter((s) => s.id !== id);
    if (next.length === roster.length) return; // wasn't in the roster
    setRoster(room, next);
  };

  // Send the room's timer to everyone in the room. Teachers get the controls
  // for it; students only ever see the read-only display.
  const broadcastTimer = (room: string) => {
    io.to(room).emit("timer state", timerSnapshot(room));
  };

  // Tell both the student and the room's teachers that a private chat exists.
  // The student's socket is in a room named after its own id.
  const sendPrivateChat = (room: string, state: PrivateChatState) => {
    io.to([state.chat.id, teacherChannel(room)]).emit("private chat opened", {
      chat: state.chat,
      messages: state.messages,
      progress: state.progress,
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

      // Teachers create a room
      // Students join one.
      socket.on("join", async ({ username, role, room, pup, studentKey }) => {
        const cleanUser = String(username || "").trim().slice(0, 32);
        const roomCode = String(room || "").trim().toUpperCase();

        if (!cleanUser || !roomCode) return;

        let activityId: unknown = null;
        let verifiedRole : Role  = "student"; 
        let waiting = false; 

        const sessionUser = (socket.request as SessionRequest).session?.user;
        try{
        const success = await Room.findOne( {code : roomCode });
        
          if (success === null || success.expiresAt === null || success.expiresAt.getTime() <= Date.now()){
            socket.emit("join error");
            socket.disconnect();
            return;
        }


        if (role === "teacher" && sessionUser?.id === success.hostID){ 
          verifiedRole = "teacher"; 
        }

        if (!success.isOpen && verifiedRole !== "teacher"){ 
          waiting = true;  
        }
          activityId = success.activityId;

        } catch (e){
          console.error(e); 
          socket.emit("join error"); 
          socket.disconnect(); 
          return; 
        }
        
      
        // A socket that already has an environment in this room (it joined
        // twice, e.g. a waiting student let in) keeps it, whatever it sends.
        const previousKey = socket.data.room === roomCode ? socket.data.studentKey ?? null : null;

        // Remember who this socket is so later events don't resend it.
        socket.data.username = cleanUser;
        // A teacher's picture comes from their login session, not from what the
        // browser sends, so nobody can show someone else's picture. Students
        // have no account, so they get none (the chat shows their initials).

      
        socket.data.avatarUrl = verifiedRole === "teacher" ? sessionUser?.picture ?? null : null;
        socket.data.role = verifiedRole;
        // Students pick a pup avatar. Teachers show their picture instead.
        socket.data.pup = role === "student" ? cleanPup(pup) : null;
        socket.data.room = roomCode;
        socket.data.waiting = waiting; 
        socket.data.studentKey = verifiedRole === "student" ? previousKey : null;

        if (waiting){ 
          socket.join(lobbyChannel(roomCode)); 
          socket.emit("room waiting"); 
          broadcastParticipants(io,roomCode).catch(console.error); 
          return; 
        }

        //  subscribe this socket to a channel (room).
        socket.join(roomCode);

        socket.leave(lobbyChannel(roomCode)); 

         void sendStudentCount(roomCode);
        // Only teachers get the list of who needs help.
        if (verifiedRole === "teacher") {
        // A student arrived, or a teacher needs the current number.
       

          socket.join(teacherChannel(roomCode));
          socket.emit("hand queue", getQueue(roomCode));
          socket.emit("room roster", getRoster(roomCode));
          // Put back any private chats still open in this room.
          for (const state of roomPrivateChats(roomCode).values()) {
            socket.emit("private chat opened", {
              chat: state.chat,
              messages: state.messages,
              progress: state.progress,
            });
          }
        } else {
          // A student joined -- add them to the roster teachers see.
          addToRoster(roomCode, { id: socket.id, username: cleanUser });
        }

        broadcastParticipants(io, roomCode).catch(console.error); 

        // Everyone gets the room's activity, shaped for their role.
        const roomActivity = await loadRoomActivity(activityId, verifiedRole);
        roomActivities.set(roomCode, {
          language: roomActivity?.language ?? null,
          questionCount: roomActivity?.questions.length ?? 0,
        });

        // A student gets their environment back, or a new one, plus the key to
        // ask for it next time. Skipped if they left while the activity loaded,
        // since their disconnect has already run and nothing would release it.
        if (verifiedRole === "student" && socket.connected) {
          const key = claimEnvironment(
            roomCode,
            socket.id,
            cleanUser,
            previousKey ?? cleanStudentKey(studentKey),
            roomActivity
          );
          socket.data.studentKey = key;
          socket.emit("student key", key);
        }

        socket.emit("room activity", roomActivity);
        // Late joiners land on the question the teacher has picked.
        socket.emit("current question", currentQuestions.get(roomCode) ?? 0);

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
            avatarUrl: m.avatarUrl ?? null,
            pup: m.pup ?? null,
          }));

          socket.emit("chat history", history);
        } catch (err) {
          console.error("[socket] failed to load history:", err);
        }

        // Late joiners (either role) see the timer as it is right now.
        socket.emit("timer state", timerSnapshot(roomCode));
      });

      // A student changes their pup avatar. Their later messages use it.
      socket.on("set pup", ({ pup }) => {
        if (socket.data.role !== "student") return;
        socket.data.pup = cleanPup(pup);
      });

      // Mesages limited by room
      socket.on("chat message", async ({ text }) => {
        const { username, role, room } = socket.data; 
        if (!username || !room || socket.data.waiting) return; // hasn't joined yet

        const cleanText = String(text || "").trim().slice(0, 1000);
        if (!cleanText) return;

        try {
          const saved = await Message.create({
            username,
            role,
            text: cleanText,
            room,
            avatarUrl: socket.data.avatarUrl ?? null,
            pup: socket.data.pup ?? null,
          });

          const message: ChatMessage = {
            username: saved.username,
            role: saved.role as Role,
            text: saved.text,
            room: saved.room,
            createdAt: (saved.createdAt as Date).toISOString(),
            chatId: GROUP_CHAT_ID,
            avatarUrl: saved.avatarUrl ?? null,
            pup: saved.pup ?? null,
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
        
        if (socket.data.waiting) return; 
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

      // Only the teacher can change the question, and everyone in the room follows.
      socket.on("set question", ({ questionIndex }) => {
        const { role, room } = socket.data;
        if (!room || role !== "teacher") return;

        if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= ACTIVITY_MAX_QUESTIONS) return;

        currentQuestions.set(room, questionIndex);
        io.to(room).emit("current question", questionIndex);
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
            progress: { answers: [], results: [], marks: [] },
          });
        }
        sendPrivateChat(room, chats.get(id)!);
      });

      // Students can only write in their own private chat. Teachers can write
      // in any private chat in their room.

      socket.on("private message", ({ chatId, text }) => {
        
        if (socket.data.waiting) return; 
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
          avatarUrl: socket.data.avatarUrl ?? null,
          pup: socket.data.pup ?? null,
        };
        state.messages = [...state.messages, message].slice(-PRIVATE_HISTORY_LIMIT);

        // Only the student in this chat and the room's teachers get it.
        io.to([state.chat.id, teacherChannel(room)]).emit("private message", message);
      });

      // A student's work only reaches the teacher while their private chat is
      // open. Changing an answer clears its result, since the old result no
      // longer applies.

     

      socket.on("activity update", ({ answers }) => {
        if (socket.data.waiting) return; 
        const { role, room } = socket.data;
        if (!room || role !== "student") return;

        const state = privateChats.get(room)?.get(socket.id);
        const cleaned = cleanAnswers(answers);
        if (!state || !cleaned) return;

        const previous = state.progress;
        const unchanged = (lines: ParsonsLine[], i: number) =>
          JSON.stringify(lines) === JSON.stringify(previous.answers[i]);
        state.progress = {
          answers: cleaned,
          results: cleaned.map((lines, i) => (unchanged(lines, i) ? previous.results[i] ?? null : null)),
          marks: cleaned.map((lines, i) => (unchanged(lines, i) ? previous.marks[i] ?? null : null)),
        };
        io.to(teacherChannel(room)).emit("student activity", {
          chatId: socket.id,
          progress: state.progress,
        });
      });

      // A student checks one Parsons question. The grading runs here, so the
      // solution never leaves the server. The feedback is sent only when the
      // teacher turned it on; otherwise the student learns right or wrong.

 
      
      socket.on("check answer", async ({ questionIndex, lines }) => {
        if (socket.data.waiting) return; 
        const { role, room } = socket.data;
        if (!room || role !== "student") return;

        const index = Number(questionIndex);
        const answer = cleanLines(lines);
        if (!Number.isInteger(index) || index < 0 || !answer) return;

        try {
          const question = await loadParsonsQuestion(room, index);
          if (!question) return;

          const graded = gradeLineBased(question.solution, answer, question.options.canIndent);
          const showFeedback = question.options.showFeedback;
          socket.emit("answer result", {
            questionIndex: index,
            correct: graded.success,
            errors: showFeedback ? graded.errors : [],
            marks: showFeedback ? graded.marks : [],
          });

          const state = privateChats.get(room)?.get(socket.id);
          if (state) {
            state.progress = {
              answers: withValue(state.progress.answers, index, answer, []),
              results: withValue(state.progress.results, index, graded.success, null),
              marks: withValue(state.progress.marks, index, graded.marks, null),
            };
            io.to(teacherChannel(room)).emit("student activity", {
              chatId: socket.id,
              progress: state.progress,
            });
          }
        } catch (err) {
          console.error("[socket] failed to check answer:", err);
        }
      });

      // Someone runs one question's code; the run waits its turn in the shared
      // queue. A student's code is saved to their environment and the job is
      // built from it. A teacher has no environment, so their code runs as sent.
      socket.on("run code", ({ questionIndex, code }) => {
        if (socket.data.waiting) return;
        const { role, room, studentKey } = socket.data;
        if (!room || !role) return;
        const owner = runOwner(socket.data, socket.id);
        if (!owner) return;

        const index = Number(questionIndex);
        const reject = (reason: string) => socket.emit("run rejected", { questionIndex: index, reason });
        if (typeof code !== "string") return reject("There's no code to run.");
        if (code.length > STUDENT_CODE_MAX_LENGTH) return reject("Your code is too long to run.");

        const activity = roomActivities.get(room);
        const language = activity?.language ?? null;

        // A student's environment, or undefined for a teacher.
        const stored = role === "student" && studentKey ? environments.get(room)?.get(studentKey) : undefined;
        if (role === "student" && (!stored || stored.socketId !== socket.id)) return;

        let started = false;
        let job: CodeRunJob;
        const hooks: JobHooks = {
          onQueued: (position) => socket.emit("run queued", { jobId: job.id, questionIndex: index, position }),
          onStart: () => {
            started = true;
            if (stored) stored.env.running = true;
            socket.emit("run started", { jobId: job.id, questionIndex: index });
          },
          onOutput: (stream, chunk) => socket.emit("run output", { jobId: job.id, stream, chunk }),
          onDone: (outcome) => {
            if (stored && started) stored.env.running = false;
            if (stored && outcome.type === "finished") stored.env.questions[index].lastRun = outcome.result;
            socket.emit("run finished", { jobId: job.id, questionIndex: index, outcome });
          },
        };

        try {
          if (stored) {
            const question = Number.isInteger(index) ? stored.env.questions[index] : undefined;
            if (!question) return reject("That question doesn't exist.");
            question.code = code;
            job = CodeRunJob.fromEnvironment(stored.env, index, language, hooks);
          } else {
            if (!Number.isInteger(index) || index < 0 || index >= (activity?.questionCount ?? 0)) {
              return reject("That question doesn't exist.");
            }
            const compileLanguage = runnableLanguage(language);
            if (!compileLanguage) return reject("This activity's language can't be run.");
            if (!code.trim()) return reject("Write some code before running it.");
            job = new CodeRunJob(owner, index, { language: compileLanguage, code }, hooks);
          }
        } catch (error) {
          if (error instanceof InvalidRunJobError || error instanceof InvalidCompileRequestError) {
            return reject(error.message);
          }
          throw error;
        }

        const result = executionQueue.enqueue(job);
        if (result.status === "queue-full") reject("Lots of people are running code. Try again in a moment.");
        if (result.status === "already-running") reject("Your code is already running.");
      });

      // Someone stops their own queued or running code.
      socket.on("cancel run", () => {
        if (!socket.data.role) return;
        const owner = runOwner(socket.data, socket.id);
        if (owner) executionQueue.cancelOwner(owner);
      });

      socket.on("disconnect", () => {
        console.log("[socket] user disconnected:", socket.id);
        // Their output has nowhere to go, so free the runner for someone else.
        if (socket.data.role) {
          const owner = runOwner(socket.data, socket.id);
          if (owner) executionQueue.cancelOwner(owner);
        }
        // This socket has already left its rooms, so the count no longer includes it.
        if (socket.data.room && socket.data.role === "student") void sendStudentCount(socket.data.room);
        // A student who leaves shouldn't stay in the teacher's list.
        if (socket.data.room) removeHand(socket.data.room, socket.id);
        if (socket.data.room && socket.data.role === "student") {
          closePrivateChat(socket.data.room, socket.id);
          removeFromRoster(socket.data.room, socket.id);
          // Their work is kept for a while in case they come back.
          if (socket.data.studentKey) releaseEnvironment(socket.data.room, socket.data.studentKey, socket.id);
          broadcastParticipants(io, socket.data.room).catch(console.error);
        }
      });
    }
  );
}
