import { Server, Socket } from "socket.io";
import type { IncomingMessage } from "http";
import type { Session, SessionData } from "express-session";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { Message } from "./models/Message";
import { Activity } from "./models/Activity";
import { ParsonsOptions, DEFAULT_PARSONS_OPTIONS } from "./parsons/options";
import { parseInitial, seededRandom, studentPool } from "./parsons/parse";
import { gradeLineBased } from "./parsons/grade";
import {
  ActiveRoomSummary,
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
  Participant as LobbyParticipant,
  PrivateChat,
  RaisedHand,
  RosterStudent,
  RoomActivity,
  RoomClosedReason,
  Role,
  RunResult,
  SavedParsonsWork,
  SocketData,
  STUDENT_CODE_MAX_LENGTH,
  StudentEnvironment,
  StudentProgress,
  TimerState,
  emptyStudentEnvironment,
} from "./types";
import { mergeCodeEdit } from "./codeEdit";
import { CodeRunJob, InvalidRunJobError, JobHooks, executionQueue, runnableLanguage } from "./compile";
import { InvalidCompileRequestError } from "./compile/plan";
import { allowCodeRun } from "./compile/submission";

import { Room } from "./models/Room";
import { PastRoom } from "./models/PastRoom";

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

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

  //separate room, a "channel" for teachers of a room to get the raise hand broadcasts.
  //students don't see other students waiting
export function teacherChannel(room: string) {
return `${room}:teachers`;
}

// students wait until teacher opens a room.
export function lobbyChannel(room : string){
  return `${room}:lobby`;
}

// The channel for one student's seat. Their socket joins it, so messages for
// them reach whichever socket they're using now, even after a reconnect.
function studentChannel(seatId: string): string {
  return `student:${seatId}`;
}

// Ends a room: forgets everything kept in memory for it, tells everyone it closed
// (and why), disconnects them, and (if a teacher opened it) saves it for
// Previous activities. Safe to call more than once; only the first call does anything.
export function closeRoom(io : AppServer, room : string, reason: RoomClosedReason = "ended"): void {
  const live = liveRooms.get(room);

  // Take what the archive needs before anything is cleared. Only the fields
  // the saved room keeps are copied (never a seat's key), so nothing that
  // happens after this changes the saved room. Everyone in the room now is
  // saved, and anyone gone who did some work or had a chat; a student who is
  // gone and did nothing isn't, even if their seat was still being kept in
  // case they came back.
  const snapshot: RoomSnapshot | null = live
    ? {
        code: room,
        hostID: live.hostID,
        activityId: live.activityId,
        opened: live.opened,
        startedAt: live.startedAt,
        students: [...live.participants.values()]
          .filter((p) => p.socketId !== null || !isEmptySeat(p))
          .map((p) => ({
            id: p.id,
            username: p.username,
            pup: p.pup,
            joinedAt: p.joinedAt,
            chatOpened: p.chatOpened,
            progress: p.progress,
            privateMessages: [...p.privateMessages],
          })),
      }
    : null;

  if (live) {
    // Students' runs have nowhere to report once the room is gone, so the
    // runner is freed for other rooms.
    for (const seat of live.participants.values()) executionQueue.cancelOwner(seat.key);
    liveRooms.delete(room);
    clearLiveTimers(live);
  }
  markClosed(room);
  handQueues.delete(room);
  roomActivities.delete(room);
  currentQuestions.delete(room);
  clearTimer(room);

  // Students still waiting in the lobby are told too, even if the room never
  // went live (the teacher discarded it before opening it).
  io.to([room, lobbyChannel(room)]).emit("room closed", reason);
  io.in([room, lobbyChannel(room)]).disconnectSockets();

  // Rooms that were only created and discarded (never opened by a teacher) aren't
  // saved, so their group chat is deleted instead of being kept forever.
  // (snapshot is only set on the first call, so a repeat call deletes nothing.)
  if (snapshot?.opened) void archiveRoom(snapshot);
  else if (snapshot) void deleteRoomMessages(room);
}

// Deletes a room's group chat. Used for rooms that end without being saved.
async function deleteRoomMessages(room: string): Promise<void> {
  try {
    await Message.deleteMany({ room });
  } catch (err) {
    console.error("[socket] failed to delete chat of unsaved room:", err);
  }
}

// The teacher left an opened room and hasn't come back for TEACHER_GONE_CLOSE_MS:
// the room ends just as if they had pressed End room. Everyone's work is saved
// for Previous activities, students are told why, and the Room doc goes, so
// nobody can join it again.
async function closeAbandonedRoom(io: AppServer, room: string): Promise<void> {
  const away = TEACHER_GONE_CLOSE_MS >= 60000
    ? `${Math.round(TEACHER_GONE_CLOSE_MS / 60000)} minutes`
    : `${Math.round(TEACHER_GONE_CLOSE_MS / 1000)} seconds`;
  console.log(`[room] ${room} closed: the teacher was away for ${away}`);
  closeRoom(io, room, "teacher-away");
  try {
    await Room.deleteOne({ code: room });
  } catch (err) {
    console.error("[socket] failed to delete closed room:", err);
  }
}

// When a room will close on its own unless someone comes back (see
// ActiveRoomSummary.closesAt): the earlier of the teacher-away and empty-room deadlines.
function closesAtOf(live: LiveRoom): number | null {
  const deadlines = [live.teacherGoneAt, live.emptyCloseAt].filter((at): at is number => at !== null);
  return deadlines.length ? Math.min(...deadlines) : null;
}

// Stops every timer a live room has, its seats' included.
function clearLiveTimers(live: LiveRoom): void {
  if (live.expiryTimer) clearTimeout(live.expiryTimer);
  if (live.emptyCloseTimer) clearTimeout(live.emptyCloseTimer);
  if (live.teacherAwayTimer) clearTimeout(live.teacherAwayTimer);
  if (live.teacherGoneTimer) clearTimeout(live.teacherGoneTimer);
  live.expiryTimer = live.emptyCloseTimer = live.teacherAwayTimer = live.teacherGoneTimer = undefined;
  for (const seat of live.participants.values()) {
    if (seat.awayTimer) clearTimeout(seat.awayTimer);
    seat.awayTimer = undefined;
  }
}

// True if the room is still live in memory and was opened by this host. Used by
// DELETE /api/rooms/:code for a room whose Room doc already expired.
export function isLiveRoomHost(code : string, hostID : string): boolean {
  const live = liveRooms.get(code);
  return !!live && live.hostID !== null && live.hostID === hostID;
}

// True if the code belongs to a room still live in memory (its Room doc may
// already be gone after expiry), so a new room must not reuse it.
export function isLiveRoomCode(code : string): boolean {
  return liveRooms.has(code);
}

// The teacher clicked Open room (PUT /api/rooms/:code/open). From now on the
// room counts as running: it's on the dashboard and saved when it ends.
export function markLiveRoomOpened(code: string): void {
  const live = liveRooms.get(code);
  if (live) markOpened(live, null);
}

function markOpened(live: LiveRoom, at: Date | null): void {
  if (live.opened) return;
  live.opened = true;
  live.startedAt ??= at ?? new Date();
}

// The rooms this teacher opened that are still running, newest first, for the
// dashboard. The Room docs list the open ones; rooms past their 60 minutes have
// no Room doc any more, so they come from the live rooms.
export async function activeRoomsForHost(io: AppServer, hostID: string): Promise<ActiveRoomSummary[]> {
  const docs = await Room.find({ hostID, isOpen: true, expiresAt: { $gt: new Date() } })
    .select("code activityId expiresAt updatedAt")
    .lean();

  type Row = { code: string; activityId: unknown; expiresAt: number; startedAt: Date | null };
  const rows = new Map<string, Row>();
  for (const doc of docs) {
    const live = liveRooms.get(doc.code);
    // Without live state (e.g. the server restarted), Open room was the last change to the doc.
    const updatedAt = (doc as { updatedAt?: Date }).updatedAt ?? null;
    rows.set(doc.code, {
      code: doc.code,
      activityId: doc.activityId,
      expiresAt: doc.expiresAt.getTime(),
      startedAt: live?.startedAt ?? updatedAt,
    });
  }
  for (const [code, live] of liveRooms) {
    if (rows.has(code) || live.hostID !== hostID || !live.opened) continue;
    rows.set(code, { code, activityId: live.activityId, expiresAt: live.expiresAt, startedAt: live.startedAt });
  }

  const activityIds = [...new Set([...rows.values()].map((r) => r.activityId).filter(Boolean).map(String))];
  const activities = activityIds.length
    ? await Activity.find({ _id: { $in: activityIds } }).select("name type").lean()
    : [];
  const activityById = new Map(activities.map((a) => [String(a._id), a]));

  const now = Date.now();
  return [...rows.values()]
    // Rooms that ended while this was loading.
    .filter((row) => !closedRooms.has(row.code))
    .map((row): ActiveRoomSummary => {
      const live = liveRooms.get(row.code);
      const info = row.activityId ? activityById.get(String(row.activityId)) : undefined;
      const seats = live ? [...live.participants.values()].filter((p) => !p.left) : [];
      return {
        code: row.code,
        activityName: info?.name ?? null,
        activityType: (info?.type as ActivityType | undefined) ?? null,
        startedAt: row.startedAt ? row.startedAt.toISOString() : null,
        expiresAt: new Date(row.expiresAt).toISOString(),
        expired: row.expiresAt <= now,
        studentCount: seats.filter((p) => p.socketId !== null).length,
        awayCount: seats.filter((p) => p.socketId === null).length,
        teacherConnected: teacherSocketCount(io, row.code) > 0,
        closesAt: live && closesAtOf(live) !== null ? new Date(closesAtOf(live)!).toISOString() : null,
      };
    })
    .sort((a, b) => (Date.parse(b.startedAt ?? "") || 0) - (Date.parse(a.startedAt ?? "") || 0));
}

// A room's 60 minutes passed. New joins are refused from now on, but nobody is
// kicked, and people already in it can come back: the room ends once everyone
// has been gone for EMPTY_EXPIRED_GRACE_MS.
async function onRoomExpired(io : AppServer, room : string): Promise<void> {
  const live = liveRooms.get(room);
  if (!live) return;
  live.expired = true;
  live.expiryTimer = undefined;

  try {
    await Room.deleteOne({ code: room });
  } catch (err) {
    console.error("[socket] failed to delete expired room:", err);
  }

  // The room may have ended while the doc was being deleted.
  if (liveRooms.get(room) !== live) return;
  if (socketCount(io, room) === 0) scheduleEmptyClose(io, room, live);
}

// How long an expired room with nobody in it waits for someone to come back
// (a teacher's refresh, a classroom Wi-Fi drop) before it ends.
const EMPTY_EXPIRED_GRACE_MS = 5 * 60 * 1000;

// An expired room nobody is in ends after EMPTY_EXPIRED_GRACE_MS, unless
// someone gets back in first (see cancelEmptyClose). Armed at most once.
function scheduleEmptyClose(io: AppServer, room: string, live: LiveRoom): void {
  if (live.emptyCloseTimer) return;
  live.emptyCloseAt = Date.now() + EMPTY_EXPIRED_GRACE_MS;
  live.emptyCloseTimer = setTimeout(() => {
    live.emptyCloseTimer = undefined;
    live.emptyCloseAt = null;
    if (liveRooms.get(room) === live && live.expired && socketCount(io, room) === 0) closeRoom(io, room, "expired");
  }, EMPTY_EXPIRED_GRACE_MS);
}

// Someone got back into the room. Only called once a join has been accepted,
// so a refused join can't keep an empty room alive.
function cancelEmptyClose(live: LiveRoom): void {
  if (live.emptyCloseTimer) clearTimeout(live.emptyCloseTimer);
  live.emptyCloseTimer = undefined;
  live.emptyCloseAt = null;
}

// How many sockets are in the room right now. In "disconnect" the leaving
// socket has already left, so it isn't counted.
function socketCount(io : AppServer, room : string): number {
  return io.sockets.adapter.rooms.get(room)?.size ?? 0;
}

// How many of the room's teacher sockets are connected right now.
function teacherSocketCount(io: AppServer, room: string): number {
  return io.sockets.adapter.rooms.get(teacherChannel(room))?.size ?? 0;
}

// Group chat messages saved in the database, as clients see them.
function toChatMessage(m: {
  username: string;
  role: string;
  text: string;
  room: string;
  createdAt?: unknown;
  avatarUrl?: string | null;
  pup?: string | null;
}): ChatMessage {
  return {
    username: m.username,
    role: m.role as Role,
    text: m.text,
    room: m.room,
    createdAt: (m.createdAt as Date).toISOString(),
    chatId: GROUP_CHAT_ID,
    avatarUrl: m.avatarUrl ?? null,
    pup: m.pup ?? null,
  };
}

const jsonBytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");

// Keeps a saved room under ARCHIVE_SIZE_LIMIT so it fits in one MongoDB
// document. Normal rooms are untouched. Otherwise the oldest group messages go
// first, then the oldest private messages of the largest chats. Changes doc.
function fitArchive(doc: {
  code: string;
  students: { privateMessages: ChatMessage[] }[];
  messages: ChatMessage[];
}): void {
  let size = jsonBytes(doc);
  if (size <= ARCHIVE_SIZE_LIMIT) return;

  let dropped = 0;
  // Each pass drops by estimate (the message's JSON plus a comma), then measures again.
  while (size > ARCHIVE_SIZE_LIMIT && doc.messages.length > 0) {
    let estimate = size;
    while (estimate > ARCHIVE_SIZE_LIMIT && doc.messages.length > 0) {
      estimate -= jsonBytes(doc.messages.shift()) + 1;
      dropped++;
    }
    size = jsonBytes(doc);
  }

  while (size > ARCHIVE_SIZE_LIMIT) {
    const chatBytes = doc.students.map((s) => jsonBytes(s.privateMessages));
    let estimate = size;
    while (estimate > ARCHIVE_SIZE_LIMIT) {
      // The largest chat that still has messages.
      let largest = -1;
      for (let i = 0; i < doc.students.length; i++) {
        if (doc.students[i].privateMessages.length === 0) continue;
        if (largest === -1 || chatBytes[i] > chatBytes[largest]) largest = i;
      }
      if (largest === -1) break;
      const removed = jsonBytes(doc.students[largest].privateMessages.shift()) + 1;
      chatBytes[largest] -= removed;
      estimate -= removed;
      dropped++;
    }
    const before = size;
    size = jsonBytes(doc);
    if (size >= before) break; // no messages left to drop
  }

  console.warn(
    `[room] ${doc.code} was too large to save in full; dropped the ${dropped} oldest message(s)` +
      (size > ARCHIVE_SIZE_LIMIT ? " and it is still over the limit" : "")
  );
}

// Saves an ended room for Previous activities. Runs after the room is already
// closed, so it only logs errors and never throws.
async function archiveRoom(snapshot: RoomSnapshot): Promise<void> {
  try {
    if (!snapshot.hostID) {
      console.error("[socket] not saving room without a host:", snapshot.code);
      return;
    }

    const loaded = await loadActivity(snapshot.activityId);

    let messages: ChatMessage[] = [];
    // The ids of the group messages copied into the saved room, deleted once it's saved.
    let archivedIds: unknown[] = [];
    try {
      const saved = await Message.find({ room: snapshot.code }).sort({ createdAt: 1 }).lean();
      messages = saved.map(toChatMessage);
      archivedIds = saved.map((m) => m._id);
    } catch (err) {
      console.error("[socket] failed to load group chat for archive:", err);
    }

    const endedAt = new Date();
    const doc = {
      code: snapshot.code,
      hostID: snapshot.hostID,
      activityName: loaded?.name ?? null,
      activityType: loaded?.type ?? null,
      activity: teacherView(loaded),
      startedAt: snapshot.startedAt ?? endedAt,
      endedAt,
      students: snapshot.students.map((p) => ({
        id: p.id,
        username: p.username,
        pup: p.pup,
        joinedAt: p.joinedAt,
        hasPrivateChat: p.chatOpened,
        progress: p.progress,
        privateMessages: p.privateMessages,
      })),
      messages,
    };
    fitArchive(doc);
    await PastRoom.create(doc);
    console.log(`[room] ${snapshot.code} saved to previous activities`);

    // The chat now lives in the saved room, so delete the originals: exactly the
    // ones copied above. If the save had failed, we'd never get here, so nothing is lost.
    if (archivedIds.length > 0) {
      try {
        await Message.deleteMany({ _id: { $in: archivedIds } });
      } catch (err) {
        console.error("[socket] failed to delete archived chat messages:", err);
      }
    }
  } catch (err) {
    console.error("[socket] failed to save ended room:", err);
  }
}

export async function broadcastParticipants(io : AppServer, room : string){
  const sockets = await io.in([room, lobbyChannel(room)]).fetchSockets();
  const list : LobbyParticipant[] = sockets.filter((s) => s.data.role === "student").map((s) => ({id : s.id, username : s.data.username}));
  io.to(teacherChannel(room)).emit("participants",list);
}

//raise hands are not stored in database,
const handQueues = new Map<string, RaisedHand[]>();

// The question the teacher picked, by room. Rooms start on the first question.
// Not stored in database, like raised hands.
const currentQuestions = new Map<string, number>();

// A student's place in a live room: their "seat". It keeps their work, private
// chat and raised hand until the room ends, even while they're away, so a
// student whose connection drops, who refreshes, or who closes the tab and
// joins again with the same name gets it all back. Not stored in the database,
// like raised hands, until the room is saved (see closeRoom).
interface Participant {
  // The student's id in the room. Unlike the socket id it stays the same when
  // they reconnect. Teachers, private chats, raised hands and the saved room use it.
  id: string;
  // The secret their browser sends back to get this seat again. Never sent to
  // teachers or saved with the room. It also picks their Parsons lines.
  key: string;
  username: string;
  // The name a returning student must give, compared as nameKey makes it.
  nameKey: string;
  pup: string | null;
  joinedAt: Date;
  // The socket using the seat right now, or null while the student is away.
  socketId: string | null;
  // The tab (see the join payload) that used the seat last.
  tabId: string | null;
  // Which join took the seat last (see joinCounter). An older join that
  // finishes later can't take it back.
  claimSeq: number;
  // The student went elsewhere on purpose: hidden from teachers until they're back.
  left: boolean;
  // Removes the seat if the student stays away with nothing in it.
  awayTimer?: ReturnType<typeof setTimeout>;
  // The teacher has opened a private chat with them.
  chatOpened: boolean;
  // The teacher who opened the chat, shown in the chat header.
  chatTeacherName: string;
  privateMessages: ChatMessage[];
  // The student's work on the activity, as last sent by them. Null until they send any.
  progress: StudentProgress | null;
  // JSON length of progress, counted against the room's PROGRESS_BUDGET.
  progressSize: number;
  // Coding: the student's workspace, made once the room's activity is known.
  env: StudentEnvironment | null;
  // When their recent runs started, for allowCodeRun. On the seat, so
  // reconnecting doesn't reset the limit.
  runHistory: number[];
  // Coding: for each question, the latest text of the student's own that the
  // server took in. A student rejoining after a dropped connection sends the
  // rest of their typing from there (see the join), even if their teacher
  // changed the code meanwhile.
  studentTexts: (string | null)[];
}

// Everything kept in memory about a live room. Not stored in database, like
// raised hands, until the room ends (see closeRoom).
interface LiveRoom {
  hostID: string | null; // from the Room doc, set on the first teacher join
  activityId: unknown; // from the Room doc, refreshed on each join
  // The teacher clicked Open room. Only opened rooms are listed as running,
  // tell students when the teacher is away, and are saved when they end.
  // (The Create a room page joins as the teacher before that.)
  opened: boolean;
  startedAt: Date | null; // when the room was opened
  expiresAt: number; // ms, from the Room doc
  expired: boolean;
  expiryTimer?: ReturnType<typeof setTimeout>;
  // Ends an expired room nobody is in (see scheduleEmptyClose), and when.
  emptyCloseTimer?: ReturnType<typeof setTimeout>;
  emptyCloseAt: number | null;
  // Students' seats by id, in the order they first joined, and by key.
  participants: Map<string, Participant>;
  byKey: Map<string, Participant>;
  // Sum of every participant's progressSize, kept at or below PROGRESS_BUDGET.
  progressBytes: number;
  // The budget was hit and logged once already.
  budgetWarned: boolean;
  // An oversized single update was refused and logged once already.
  studentLimitWarned: boolean;
  // Students are told the teacher is away only after a delay (see checkTeacherAway).
  teacherAwayTimer?: ReturnType<typeof setTimeout>;
  teacherAwaySent: boolean;
  // Closes the room if the teacher stays away (see TEACHER_GONE_CLOSE_MS), and when.
  teacherGoneTimer?: ReturnType<typeof setTimeout>;
  teacherGoneAt: number | null;
}

// What a saved room keeps of one student.
interface ArchivedStudent {
  id: string;
  username: string;
  pup: string | null;
  joinedAt: Date;
  chatOpened: boolean;
  progress: StudentProgress | null;
  privateMessages: ChatMessage[];
}

// What closeRoom keeps of a room to save it.
interface RoomSnapshot {
  code: string;
  hostID: string | null;
  activityId: unknown;
  opened: boolean;
  startedAt: Date | null;
  students: ArchivedStudent[];
}

const liveRooms = new Map<string, LiveRoom>();
// Most messages kept per private chat, so saved rooms keep all of a normal class's.
const PRIVATE_HISTORY_LIMIT = 500;
// Most students kept per live room, so one client can't flood it.
const MAX_PARTICIPANTS = 200;
// Most progress (JSON bytes, all students together) kept per room, so the
// saved room stays well under MongoDB's 16 MB document limit.
const PROGRESS_BUDGET = 8_000_000;
// Most progress (JSON bytes) one student's single update may be.
const MAX_STUDENT_PROGRESS = 250_000;
// Largest saved room (JSON bytes). Above it, the oldest messages are dropped.
const ARCHIVE_SIZE_LIMIT = 12_000_000;
// How long a seat with nothing in it is kept while its student is away.
const AWAY_EMPTY_GRACE_MS = 5 * 60 * 1000;
// How long students wait before being told their teacher is away. A teacher
// refreshing, or going from Create a room into the room, is back well before.
const TEACHER_AWAY_DELAY_MS = 15 * 1000;
// How long an opened room stays open with its teacher away (tab closed,
// connection lost) before it saves everyone's work and closes, as if the
// teacher had pressed End room. TEACHER_GONE_CLOSE_MS in the environment
// overrides it (in milliseconds, more than 0), e.g. for tests.
const configuredGoneMs = Number(process.env.TEACHER_GONE_CLOSE_MS);
const TEACHER_GONE_CLOSE_MS = configuredGoneMs > 0 ? configuredGoneMs : 15 * 60 * 1000;

// Rooms that ended recently, with when they ended. A join that was still
// looking up the Room doc when its room ended must not bring the room back.
const closedRooms = new Map<string, number>();
const CLOSED_ROOM_MEMORY_MS = 60 * 60 * 1000;

function markClosed(room: string): void {
  const now = Date.now();
  for (const [code, at] of closedRooms) {
    if (now - at > CLOSED_ROOM_MEMORY_MS) closedRooms.delete(code);
  }
  closedRooms.set(room, now);
}

// True if the room ended at or after `since` (when a join started).
function closedSince(room: string, since: number): boolean {
  const at = closedRooms.get(room);
  return at !== undefined && at >= since;
}

// The room's live state, created on the first successful join. That also starts
// the countdown to its expiry, once.
function ensureLiveRoom(io : AppServer, room : string, expiresAt : Date, hostID : string | null): LiveRoom {
  let live = liveRooms.get(room);
  if (!live) {
    const expiresMs = expiresAt.getTime();
    const created: LiveRoom = {
      // Known from the Room doc, so the host can get back in after expiry.
      hostID,
      activityId: null,
      opened: false,
      startedAt: null,
      expiresAt: expiresMs,
      expired: false,
      emptyCloseAt: null,
      participants: new Map(),
      byKey: new Map(),
      progressBytes: 0,
      budgetWarned: false,
      studentLimitWarned: false,
      teacherAwaySent: false,
      teacherGoneAt: null,
    };
    created.expiryTimer = setTimeout(() => {
      void onRoomExpired(io, room);
    }, Math.max(0, expiresMs - Date.now()));
    liveRooms.set(room, created);
    live = created;
  }
  return live;
}

// A student's empty Parsons work, for a first check before any update.
const emptyParsons = (): { type: "parsons" } & AnswerProgress => ({
  type: "parsons",
  answers: [],
  results: [],
  marks: [],
});

// What a run needs to know about the room's activity, saved when someone
// joins so a run doesn't need a database lookup. Deleted when the room closes.
const roomActivities = new Map<string, { language: string | null; questionCount: number }>();

// A studentKey or tabId is what a client generated or the server handed out:
// a UUID-like string. Anything else is ignored.
function cleanStudentKey(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;
}

// A name as it's compared when a student comes back: case and extra spaces don't matter.
function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// A seat with nothing worth keeping: no work and no private chat. (A raised
// hand alone doesn't count; it's lowered when the seat goes.)
function isEmptySeat(seat: Participant): boolean {
  return seat.progress === null && !seat.chatOpened && seat.privateMessages.length === 0;
}

// The seat this socket is using, if it still is: another tab may have taken it.
function seatOf(socket: AppSocket): Participant | undefined {
  const { room, participantId } = socket.data;
  const seat = room && participantId ? liveRooms.get(room)?.participants.get(participantId) : undefined;
  return seat && seat.socketId === socket.id ? seat : undefined;
}

// Whose job a run is in the execution queue: a student's seat key (their
// environment's, see CodeRunJob.fromEnvironment). Teachers have no
// environment, so each teacher connection gets its own key.
function runOwner(socket: AppSocket): string | null {
  if (socket.data.role === "teacher") return `teacher:${socket.id}`;
  return seatOf(socket)?.key ?? null;
}

// Parsons lines are picked per student from a random source seeded by their
// key, so a student gets the same lines every time they join -- after a
// reconnect, a refresh, even a server restart -- and their saved answer still
// fits them. The secret stops anyone working out a student's lines from a key.
const POOL_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
function poolRandom(key: string, activityId: string, questionIndex: number) {
  const seed = createHmac("sha256", POOL_SECRET).update(`parsons-pool\n${key}\n${activityId}\n${questionIndex}`).digest();
  return seededRandom(seed);
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

// One Parsons question as the server checks it.
interface ParsonsCheck {
  solution: ParsonsLine[];
  distractors: string[];
  options: ParsonsOptions;
}

// A room's activity as loaded from the database, before it's shaped for anyone.
interface LoadedActivity {
  id: string;
  name: string;
  type: ActivityType;
  language: string | null;
  questions: { question: string; output?: string; parsons: ParsonsCheck | null }[];
}

// The activity a room uses, or null if none is picked. If it can't be loaded,
// people still join, just without an activity.
async function loadActivity(activityId: unknown): Promise<LoadedActivity | null> {
  if (!activityId) return null;
  try {
    const activity = await Activity.findById(activityId).lean();
    if (!activity) return null;
    const type = activity.type as ActivityType;
    return {
      id: String(activity._id),
      name: activity.name,
      type,
      language: activity.language ?? null,
      questions: activity.questions.map((q) => {
        if (type === "coding") return { question: q.question, output: q.output, parsons: null };
        const problem = parseInitial(q.initial);
        return {
          question: q.question,
          parsons: {
            solution: problem.solution,
            distractors: problem.distractors,
            options: { ...DEFAULT_PARSONS_OPTIONS, ...(q.options as Partial<ParsonsOptions>) },
          },
        };
      }),
    };
  } catch (err) {
    console.error("[socket] failed to load activity:", err);
    return null;
  }
}

// The activity as teachers get it: the question text, and the answers too
// (the correct output for coding, the solution and extra lines for Parsons).
function teacherView(activity: LoadedActivity | null): RoomActivity | null {
  if (!activity) return null;
  return {
    name: activity.name,
    type: activity.type,
    language: activity.language,
    questions: activity.questions.map((q) =>
      q.parsons
        ? {
            question: q.question,
            solution: q.parsons.solution,
            distractors: q.parsons.distractors,
            options: displaySettings(q.parsons.options),
          }
        : { question: q.question, output: q.output }
    ),
  };
}

// The activity as one student gets it: the question text and correct output,
// and for Parsons the lines picked for them (the same every time they join)
// plus the display settings. Never the answer.
function studentView(activity: LoadedActivity | null, key: string): RoomActivity | null {
  if (!activity) return null;
  return {
    name: activity.name,
    type: activity.type,
    language: activity.language,
    questions: activity.questions.map((q, i) =>
      q.parsons
        ? {
            question: q.question,
            lines: studentPool(
              q.parsons.solution,
              q.parsons.distractors,
              q.parsons.options.maxWrongLines,
              poolRandom(key, activity.id, i)
            ),
            options: displaySettings(q.parsons.options),
          }
        : { question: q.question, output: q.output }
    ),
  };
}

// A returning student's Parsons work as they saw it: their answers, results,
// and the feedback for each checked answer, worked out again here so it isn't
// stored. The marks teachers see are left out when the student's feedback is off.
function savedParsonsWork(progress: AnswerProgress, activity: LoadedActivity): SavedParsonsWork {
  return {
    answers: progress.answers,
    results: progress.results,
    feedback: progress.answers.map((answer, i) => {
      const parsons = activity.questions[i]?.parsons;
      if (progress.results[i] == null || !parsons) return null;
      if (!parsons.options.showFeedback) return { errors: [], marks: [] };
      const graded = gradeLineBased(parsons.solution, answer, parsons.options.canIndent);
      return { errors: graded.errors, marks: graded.marks };
    }),
  };
}

// One Parsons question of a room's activity: its solution and options, or null
// if the room has no Parsons question at that index.
async function loadParsonsQuestion(
  room: string,
  questionIndex: number
): Promise<{ solution: ParsonsLine[]; options: ParsonsOptions } | null> {
  const found = await Room.findOne({ code: room }).select("activityId").lean();
  // After expiry the Room doc is gone but the room stays live, so use the live copy.
  const activityId = found ? found.activityId : liveRooms.get(room)?.activityId;
  if (!activityId) return null;
  const activity = await Activity.findById(activityId).select("type questions").lean();
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

// A coding student's work as teachers (and the student) see it: their code, and
// each question's last output, stdout then stderr under a label.
function codingProgressOf(env: StudentEnvironment): StudentProgress {
  return {
    type: "coding",
    codes: env.questions.map((question) => question.code),
    outputs: env.questions.map(({ lastRun }) => lastRun
      ? `${lastRun.stdout}${lastRun.stderr ? "\n[stderr]\n" + lastRun.stderr : ""}`.slice(0, ACTIVITY_MAX_LENGTH)
      : null),
  };
}

// What a seat keeps of a finished run: no more output than teachers are shown,
// so what the seat holds stays within the room's progress budget.
function keptRun(result: RunResult): RunResult {
  return {
    ...result,
    stdout: result.stdout.slice(0, ACTIVITY_MAX_LENGTH),
    stderr: result.stderr.slice(0, ACTIVITY_MAX_LENGTH),
  };
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
// visibleToStudents is the teacher's toggle. Students get no time at all while it is off.
interface RoomTimer {
  durationMs: number;
  remainingMs: number;
  endsAt: number | null;
  visibleToStudents: boolean;
  expiry?: ReturnType<typeof setTimeout>;
}

// Timers are not stored in database, like raised hands.
const timers = new Map<string, RoomTimer>();

const getTimer = (room: string): RoomTimer => {
  let timer = timers.get(room);
  if (!timer) {
    timer = { durationMs: DEFAULT_TIMER_MS, remainingMs: DEFAULT_TIMER_MS, endsAt: null, visibleToStudents: true };
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
// Only reads: a room without a timer entry (new, or already closed) shows the
// default, and no entry is stored for it.
function timerSnapshot(room: string): TimerState {
  const timer = timers.get(room) ?? { durationMs: DEFAULT_TIMER_MS, remainingMs: DEFAULT_TIMER_MS, endsAt: null, visibleToStudents: true };
  if (timer.endsAt === null) {
    return { durationMs: timer.durationMs, remainingMs: timer.remainingMs, running: false, visibleToStudents: timer.visibleToStudents };
  }
  return {
    durationMs: timer.durationMs,
    remainingMs: Math.max(0, timer.endsAt - Date.now()),
    running: true,
    visibleToStudents: timer.visibleToStudents,
  };
}

// What students get. While the teacher has the timer hidden, the time is left
// out entirely, so a student cannot read it from the socket either.
function studentTimerSnapshot(room: string): TimerState {
  const snapshot = timerSnapshot(room);
  if (snapshot.visibleToStudents) return snapshot;
  return { durationMs: 0, remainingMs: 0, running: false, visibleToStudents: false };
}

// Counts joins as they start. A join that started later is newer, even if an
// older one finishes after it (database lookups can finish in any order).
let joinCounter = 0;

// The client events that carry an object payload (see ClientToServerEvents).
const PAYLOAD_EVENTS = new Set<string>([
  "join",
  "set pup",
  "chat message",
  "lower hand",
  "timer set",
  "timer visibility",
  "set question",
  "open private chat",
  "private message",
  "activity update",
  "check answer",
  "edit student code",
  "run code",
]);

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

  // Remove a student from the queue (they were helped, left, or their seat
  // went) and tell them.
  const removeHand = (room: string, id: string) => {
    const queue = getQueue(room);
    const next = queue.filter((h) => h.id !== id);
    if (next.length === queue.length) return; // wasn't raised
    setQueue(room, next);
    io.to(studentChannel(id)).emit("hand status", false);
  };

  // The students teachers see: every seat except those who left, in the order
  // they first joined, each marked connected or away.
  const rosterOf = (live: LiveRoom | undefined): RosterStudent[] =>
    live
      ? [...live.participants.values()]
          .filter((p) => !p.left)
          .map((p) => ({ id: p.id, username: p.username, connected: p.socketId !== null }))
      : [];

  const broadcastRoster = (room: string) => {
    io.to(teacherChannel(room)).emit("room roster", rosterOf(liveRooms.get(room)));
  };

  // Send the room's timer to everyone in the room. Teachers get the controls
  // for it; students only ever see the read-only display (or nothing, when hidden).
  const broadcastTimer = (room: string) => {
    io.to(teacherChannel(room)).emit("timer state", timerSnapshot(room));
    io.to(room).except(teacherChannel(room)).emit("timer state", studentTimerSnapshot(room));
  };

  // A student's seat in a live room, by the student's id.
  const getParticipant = (room: string, id: string) => liveRooms.get(room)?.participants.get(id);

  // A student's private chat, as clients see it.
  const privateChatOf = (p: Participant): PrivateChat => ({
    id: p.id,
    studentName: p.username,
    teacherName: p.chatTeacherName,
  });

  // Tell both the student and the room's teachers that a private chat exists.
  const sendPrivateChat = (room: string, p: Participant) => {
    io.to([studentChannel(p.id), teacherChannel(room)]).emit("private chat opened", {
      chat: privateChatOf(p),
      messages: p.privateMessages,
    });
  };

  // Store a student's new work and send it to the room's teachers only.
  // Ignored if it would take the room past its progress budget.
  const setProgress = (room: string, p: Participant, progress: StudentProgress) => {
    const live = liveRooms.get(room);
    if (!live) return;
    const size = Buffer.byteLength(JSON.stringify(progress), "utf8");
    // One student can't use up the room's budget: an oversized update is
    // ignored and their previous work is kept.
    if (size > MAX_STUDENT_PROGRESS) {
      if (!live.studentLimitWarned) {
        live.studentLimitWarned = true;
        console.warn(`[room] ${room} got a progress update over ${MAX_STUDENT_PROGRESS} bytes; ignored`);
      }
      return;
    }
    const total = live.progressBytes - p.progressSize + size;
    if (total > PROGRESS_BUDGET) {
      if (!live.budgetWarned) {
        live.budgetWarned = true;
        console.warn(`[room] ${room} reached its progress limit; further updates that grow it are ignored`);
      }
      return;
    }
    live.progressBytes = total;
    p.progressSize = size;
    p.progress = progress;
    io.to(teacherChannel(room)).emit("student activity", { studentId: p.id, progress });
    if (progress.type === "coding") io.to(studentChannel(p.id)).emit("student activity", { studentId: p.id, progress });
    return true;
  };

  const publishCode = (room: string, student: Participant, env: StudentEnvironment) =>
    setProgress(room, student, codingProgressOf(env));

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

  // Show or hide the timer for students. Pausing or changing the time is not affected.
  const setTimerVisibility = (room: string, visible: boolean) => {
    const timer = getTimer(room);
    timer.visibleToStudents = visible;
    broadcastTimer(room);
  };

  // When the room will close itself if the teacher doesn't come back, as students get it.
  const teacherGoneAtIso = (live: LiveRoom) =>
    live.teacherGoneAt !== null ? new Date(live.teacherGoneAt).toISOString() : null;

  // No teacher is in an opened room (they closed their tab, lost their
  // connection, or went to another page). Two clocks start, once:
  // - students are told their teacher is away only after TEACHER_AWAY_DELAY_MS,
  //   so a teacher's refresh, or going from Create a room into the room,
  //   doesn't flash it for the class;
  // - after TEACHER_GONE_CLOSE_MS the room saves everyone's work and closes,
  //   as if the teacher had pressed End room.
  // A teacher coming back stops both (see teacherBack).
  const checkTeacherAway = (room: string, live: LiveRoom) => {
    if (!live.opened || teacherSocketCount(io, room) > 0) return;
    if (!live.teacherAwaySent && !live.teacherAwayTimer) {
      live.teacherAwayTimer = setTimeout(() => {
        live.teacherAwayTimer = undefined;
        if (liveRooms.get(room) !== live || teacherSocketCount(io, room) > 0) return;
        live.teacherAwaySent = true;
        io.to(room).emit("teacher away", true, teacherGoneAtIso(live));
      }, TEACHER_AWAY_DELAY_MS);
    }
    if (!live.teacherGoneTimer) {
      live.teacherGoneAt = Date.now() + TEACHER_GONE_CLOSE_MS;
      live.teacherGoneTimer = setTimeout(() => {
        live.teacherGoneTimer = undefined;
        live.teacherGoneAt = null;
        // Checked again: the room may have ended, or a teacher come back, meanwhile.
        if (liveRooms.get(room) !== live || teacherSocketCount(io, room) > 0) return;
        void closeAbandonedRoom(io, room);
      }, TEACHER_GONE_CLOSE_MS);
    }
  };

  // A teacher is in the room again: the room no longer closes for them being away.
  const teacherBack = (room: string, live: LiveRoom) => {
    if (live.teacherAwayTimer) clearTimeout(live.teacherAwayTimer);
    if (live.teacherGoneTimer) clearTimeout(live.teacherGoneTimer);
    live.teacherAwayTimer = live.teacherGoneTimer = undefined;
    live.teacherGoneAt = null;
    if (!live.teacherAwaySent) return;
    live.teacherAwaySent = false;
    io.to(room).emit("teacher away", false, null);
  };

  // A seat that can be given up for a new student when the room is full: one
  // nobody is using, with nothing in it and no raised hand. Oldest first.
  const freeableSeat = (room: string, live: LiveRoom): Participant | undefined => {
    const raised = new Set(getQueue(room).map((h) => h.id));
    for (const seat of live.participants.values()) {
      if (seat.socketId === null && isEmptySeat(seat) && !raised.has(seat.id)) return seat;
    }
    return undefined;
  };

  // Deletes a seat for good: its hand is lowered and it no longer counts
  // against the room. The caller sends the roster.
  const deleteSeat = (room: string, live: LiveRoom, seat: Participant) => {
    if (seat.awayTimer) clearTimeout(seat.awayTimer);
    seat.awayTimer = undefined;
    live.participants.delete(seat.id);
    if (live.byKey.get(seat.key) === seat) live.byKey.delete(seat.key);
    live.progressBytes -= seat.progressSize;
    removeHand(room, seat.id);
  };

  // The student is away: they lost their connection, closed the tab, or are
  // refreshing. Their hand and private chat stay, and teachers see them as
  // away. A seat with nothing in it goes after AWAY_EMPTY_GRACE_MS.
  const seatAway = (room: string, live: LiveRoom, seat: Participant) => {
    if (seat.awayTimer) clearTimeout(seat.awayTimer);
    seat.awayTimer = undefined;
    if (!isEmptySeat(seat)) return;
    seat.awayTimer = setTimeout(() => {
      seat.awayTimer = undefined;
      // Checked again: the room, the seat, and what's in it may all have changed.
      if (liveRooms.get(room) !== live || live.participants.get(seat.id) !== seat) return;
      if (seat.socketId !== null || !isEmptySeat(seat)) return;
      deleteSeat(room, live, seat);
      broadcastRoster(room);
    }, AWAY_EMPTY_GRACE_MS);
  };

  // The student left on purpose (Leave, or another page of the site): hidden
  // from teachers, hand lowered, private chat closed. A seat with nothing in
  // it is deleted. The caller sends the roster.
  const seatLeft = (room: string, live: LiveRoom, seat: Participant) => {
    seat.left = true;
    removeHand(room, seat.id);
    if (seat.chatOpened) io.to(teacherChannel(room)).emit("private chat closed", seat.id);
    if (isEmptySeat(seat)) deleteSeat(room, live, seat);
  };

  // A new seat for a student who has none in this room.
  const createSeat = (live: LiveRoom, requestedKey: string | null, username: string, pup: string | null): Participant => {
    // A key nobody holds (e.g. after a server restart) is kept, so the
    // student's saved key, and with it their Parsons lines, stay the same.
    const key = requestedKey && !live.byKey.has(requestedKey) ? requestedKey : randomUUID();
    const seat: Participant = {
      id: randomUUID(),
      key,
      username,
      nameKey: nameKey(username),
      pup,
      joinedAt: new Date(),
      socketId: null,
      tabId: null,
      claimSeq: 0,
      left: false,
      chatOpened: false,
      chatTeacherName: "",
      privateMessages: [],
      progress: null,
      progressSize: 0,
      env: null,
      runHistory: [],
      studentTexts: [],
    };
    live.participants.set(seat.id, seat);
    live.byKey.set(key, seat);
    return seat;
  };

  // The seat a joining student gets back, if any: the one this socket already
  // holds (it joined from the lobby), or the one their key opens if they give
  // the same name. A key alone isn't enough, so a key left on a shared
  // computer doesn't hand a classmate's seat to someone using another name.
  const findSeat = (live: LiveRoom | undefined, socket: AppSocket, key: string | null, username: string) => {
    if (!live) return undefined;
    const own = socket.data.participantId ? live.participants.get(socket.data.participantId) : undefined;
    if (own && own.socketId === socket.id) return own;
    const keyed = key ? live.byKey.get(key) : undefined;
    return keyed && keyed.nameKey === nameKey(username) ? keyed : undefined;
  };

  // Puts a student's socket in their seat. If another socket still holds it
  // (see the join), the seat moves here: that socket's run is stopped, then it
  // is told and disconnected. Everything changes at once, before any await,
  // and after this socket is already in the room, so the old socket's
  // disconnect can't find the room empty.
  const takeSeat = (live: LiveRoom, seat: Participant, socket: AppSocket, seq: number) => {
    const previous = seat.socketId !== null && seat.socketId !== socket.id ? seat.socketId : null;
    if (previous) executionQueue.cancelOwner(seat.key);
    seat.socketId = socket.id;
    seat.tabId = socket.data.tabId ?? null;
    seat.claimSeq = seq;
    seat.left = false;
    if (seat.awayTimer) clearTimeout(seat.awayTimer);
    seat.awayTimer = undefined;
    if (socket.data.pup) seat.pup = socket.data.pup;
    socket.data.participantId = seat.id;
    socket.data.studentKey = seat.key;
    socket.join(studentChannel(seat.id));

    const old = previous ? io.sockets.sockets.get(previous) : undefined;
    if (old) {
      // Its disconnect (which runs right away) must leave the seat and room alone.
      old.data.replaced = true;
      old.emit("session replaced");
      old.disconnect(true);
    }
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

      // Events whose handlers read fields from their payload. A missing or odd
      // payload (from a buggy or hostile client) is dropped here: reading a
      // field of undefined in a handler would throw and stop the server for
      // every room.
      socket.use(([event, payload], next) => {
        if (PAYLOAD_EVENTS.has(event) && (typeof payload !== "object" || payload === null)) return;
        next();
      });

      // Teachers create a room
      // Students join one.
      const join = async ({
        username,
        role,
        room,
        pup,
        studentKey,
        tabId,
        resume,
      }: Partial<Parameters<ClientToServerEvents["join"]>[0]>) => {
        const cleanUser = String(username || "").trim().slice(0, 32);
        const roomCode = String(room || "").trim().toUpperCase();

        if (!cleanUser || !roomCode) return;

        // Only the two known roles can join; anything else changes nothing.
        if (role !== "teacher" && role !== "student") {
          socket.emit("join error");
          socket.disconnect();
          return;
        }

        // A socket belongs to one room only.
        if (socket.data.room && socket.data.room !== roomCode) {
          socket.emit("join error");
          return;
        }

        // A room that ended recently says so, so a teacher or student coming
        // back to it (e.g. after it closed itself) learns what happened.
        const refuse = () => {
          socket.emit("join error", closedRooms.has(roomCode) ? "ended" : undefined);
          socket.disconnect();
        };

        // The logged-in user, from the login session (never from the browser's message).
        const sessionUser = (socket.request as SessionRequest).session?.user;
        const joinStarted = Date.now();
        // Taken before the first await: joins that start later are newer.
        const seq = ++joinCounter;
        const requestedKey = role === "student" ? cleanStudentKey(studentKey) : null;
        const tab = role === "student" ? cleanStudentKey(tabId) : null;

        let activityId: unknown = null;
        let hostID: string | null = null;
        let expiresAt: Date;
        // Students who arrive before the teacher clicks Open room wait in the lobby.
        let isOpen = true;
        // Set when the Room doc was read and says the room was opened (and when).
        let openedAt: Date | null | undefined;
        try{
          const success = await Room.findOne( {code : roomCode });
          if (success !== null && success.expiresAt !== null && success.expiresAt.getTime() > Date.now()) {
            activityId = success.activityId;
            hostID = success.hostID;
            expiresAt = success.expiresAt;
            isOpen = success.isOpen;
            if (success.isOpen) openedAt = (success as { updatedAt?: Date }).updatedAt ?? null;
          } else {
            // Past its 60 minutes (or the Room doc is gone): nobody new can
            // join, but the host can get back into a room that is still live,
            // and so can a student coming back to their own seat in it.
            const stillLive = liveRooms.get(roomCode);
            if (
              !stillLive ||
              stillLive.hostID === null ||
              (role !== "teacher" && !findSeat(stillLive, socket, requestedKey, cleanUser))
            ) {
              refuse();
              return;
            }
            activityId = stillLive.activityId;
            hostID = stillLive.hostID;
            expiresAt = new Date(stillLive.expiresAt);
          }
        } catch (e){
          // The database couldn't be reached. That's not a refusal (which
          // would make a student's browser forget their seat), so drop the
          // connection instead: the client reconnects and tries again.
          console.error(e);
          socket.conn.close();
          return;
        }

        // Only the room's host can join as its teacher (teachers see every student's work).
        if (role === "teacher" && (!sessionUser?.id || sessionUser.id !== hostID)) {
          refuse();
          return;
        }

        // Things that may have changed while the Room doc was loading. No await
        // from here until the socket has joined, so the room can't end in between.
        if (!socket.connected) return;
        if (socket.data.room && socket.data.room !== roomCode) {
          socket.emit("join error");
          return;
        }
        if (closedSince(roomCode, joinStarted)) {
          refuse();
          return;
        }

        const current = liveRooms.get(roomCode);
        const waiting = !isOpen && role !== "teacher";
        // A returning student gets their seat back.
        const found = role === "student" ? findSeat(current, socket, requestedKey, cleanUser) : undefined;

        // A new student can't join a full room, unless a seat nobody is using
        // (with nothing in it) can be given up for them.
        if (
          role === "student" &&
          !found &&
          current &&
          current.participants.size >= MAX_PARTICIPANTS &&
          !freeableSeat(roomCode, current)
        ) {
          refuse();
          return;
        }

        // The seat is held by another socket: a second tab, or this tab
        // reconnecting before the server noticed its old connection drop.
        // Normally the newest connection takes it. But a socket reconnecting
        // on its own doesn't take it from another tab that's using it, and a
        // join that started before the one holding the seat has lost.
        if (found && found.socketId !== null && found.socketId !== socket.id) {
          const holder = io.sockets.sockets.get(found.socketId);
          const sameTab = tab !== null && found.tabId === tab;
          if (holder && (seq < found.claimSeq || (resume === true && !sameTab))) {
            socket.emit("session replaced");
            socket.disconnect(true);
            return;
          }
        }

        // Remember who this socket is so later events don't resend it.
        socket.data.username = cleanUser;
        // A teacher's picture comes from their login session, not from what the
        // browser sends, so nobody can show someone else's picture. Students
        // have no account, so they get none (the chat shows their initials).
        socket.data.avatarUrl = role === "teacher" ? sessionUser?.picture ?? null : null;
        socket.data.role = role;
        // Students pick a pup avatar. Teachers show their picture instead.
        socket.data.pup = role === "student" ? cleanPup(pup) : null;
        socket.data.room = roomCode;
        socket.data.waiting = waiting;
        socket.data.tabId = tab;

        if (waiting){
          socket.join(lobbyChannel(roomCode));
          socket.emit("room waiting");
          broadcastParticipants(io,roomCode).catch(console.error);
          return;
        }

        //  subscribe this socket to a channel (room).
        socket.join(roomCode);
        socket.leave(lobbyChannel(roomCode));
        socket.data.joined = true;

        // The room's live state, kept until it ends so it can be saved. Waiting
        // students don't make it live; only those who get in do.
        const live = ensureLiveRoom(io, roomCode, expiresAt, hostID);
        live.activityId = activityId;
        if (openedAt !== undefined) markOpened(live, openedAt);
        // Someone is in the room, so an expired room no longer ends for being empty.
        cancelEmptyClose(live);

        let seat: Participant | undefined;
        if (role === "teacher") {
          // Only teachers get the list of who needs help and who's in the room.
          live.hostID = hostID;
          socket.join(teacherChannel(roomCode));
          socket.emit("hand queue", getQueue(roomCode));
          socket.emit("room roster", rosterOf(live));
          teacherBack(roomCode, live);
        } else {
          // A new student takes a new seat (giving up an unused empty one if
          // the room is full); a returning one gets theirs back.
          if (!found && live.participants.size >= MAX_PARTICIPANTS) {
            const freed = freeableSeat(roomCode, live);
            if (freed) deleteSeat(roomCode, live, freed);
          }
          seat = found ?? createSeat(live, requestedKey, cleanUser, socket.data.pup);
          // Whether this tab held the seat last, so its copy of the work is the newest.
          const sameTab = tab !== null && seat.tabId === tab;
          takeSeat(live, seat, socket, seq);
          socket.emit("student key", seat.key, { returning: found !== undefined, sameTab });
          broadcastRoster(roomCode);
          checkTeacherAway(roomCode, live);
        }

        // A student arrived, or a teacher needs the current number. Counted
        // after takeSeat, so a socket it replaced isn't counted.
        void sendStudentCount(roomCode);
        broadcastParticipants(io, roomCode).catch(console.error);

        // Everyone gets the room's activity, shaped for their role.
        const loaded = await loadActivity(activityId);
        // The room may have ended while the activity loaded; nothing to set up then.
        const stillLive = liveRooms.get(roomCode) === live;
        if (stillLive) {
          roomActivities.set(roomCode, {
            language: loaded?.language ?? null,
            questionCount: loaded?.questions.length ?? 0,
          });
        }
        if (!stillLive || !socket.connected) return;
        // Another tab took the seat while the activity loaded; it sets itself up.
        if (seat && seat.socketId !== socket.id) return;

        const roomActivity = seat ? studentView(loaded, seat.key) : teacherView(loaded);
        socket.emit("room activity", roomActivity);

        if (seat) {
          const mySeat = seat;
          mySeat.env ??= emptyStudentEnvironment(
            mySeat.key,
            mySeat.username,
            roomActivity?.type ?? null,
            roomActivity?.questions.length ?? 0
          );
          // Everything the student had: their work, their hand, their private
          // chat, and whether their teacher is in the room.
          if (roomActivity?.type === "coding") {
            const env = mySeat.env;
            socket.emit(
              "student activity",
              { studentId: mySeat.id, progress: codingProgressOf(env) },
              env.questions.map((_, i) => mySeat.studentTexts[i] ?? null)
            );
          }
          if (roomActivity?.type === "parsons" && loaded && mySeat.progress?.type === "parsons") {
            socket.emit("saved work", savedParsonsWork(mySeat.progress, loaded));
          }
          socket.emit("hand status", getQueue(roomCode).some((h) => h.id === mySeat.id));
          if (mySeat.chatOpened) {
            socket.emit("private chat opened", {
              chat: privateChatOf(mySeat),
              messages: mySeat.privateMessages,
              restored: true,
            });
            // Teachers closed it if the student had left, and a teacher who
            // refreshed while they were away may not have it.
            io.to(teacherChannel(roomCode)).emit("private chat opened", {
              chat: privateChatOf(mySeat),
              messages: mySeat.privateMessages,
            });
          }
          socket.emit("teacher away", live.teacherAwaySent, live.teacherAwaySent ? teacherGoneAtIso(live) : null);
        } else {
          for (const p of live.participants.values()) {
            // Put back the private chats of everyone still in the room, away or not.
            if (p.chatOpened && !p.left) {
              socket.emit("private chat opened", { chat: privateChatOf(p), messages: p.privateMessages });
            }
            // Every student's work so far, whether or not they have a chat open.
            if (p.progress !== null) {
              socket.emit("student activity", { studentId: p.id, progress: p.progress });
            }
          }
        }
        // Late joiners land on the question the teacher has picked.
        socket.emit("current question", currentQuestions.get(roomCode) ?? 0);

        //display room code
        // previous room data (messages)
        try {
          const recent = await Message.find({ room: roomCode })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

          const history: ChatMessage[] = recent.reverse().map(toChatMessage);

          socket.emit("chat history", history);
        } catch (err) {
          console.error("[socket] failed to load history:", err);
        }

        // Late joiners (either role) see the timer as it is right now
        // (students see nothing while the teacher has it hidden).
        socket.emit("timer state", role === "teacher" ? timerSnapshot(roomCode) : studentTimerSnapshot(roomCode));
      };

      // One join at a time, and none once in. (A student waiting in the lobby
      // joins again when the teacher lets them in.)
      socket.on("join", async (payload) => {
        if (socket.data.joining || socket.data.joined) return;
        socket.data.joining = true;
        try {
          await join(payload ?? {});
        } catch (err) {
          console.error("[socket] join failed:", err);
        } finally {
          socket.data.joining = false;
        }
      });

      // A student changes their pup avatar. Their later messages use it.
      socket.on("set pup", (payload) => {
        if (socket.data.role !== "student") return;
        socket.data.pup = cleanPup(payload?.pup);
        // The saved room shows the pup they had last.
        const p = seatOf(socket);
        if (p) p.pup = socket.data.pup;
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
        const { role, room } = socket.data;
        const seat = seatOf(socket);
        if (!room || role !== "student" || !seat) return;

        const queue = getQueue(room);
        if (queue.some((h) => h.id === seat.id)) {
          removeHand(room, seat.id);
          return;
        }

        setQueue(room, [
          ...queue,
          { id: seat.id, username: seat.username, raisedAt: new Date().toISOString() },
        ]);
        io.to(studentChannel(seat.id)).emit("hand status", true);
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

      socket.on("timer visibility", ({ visible }) => {
        const { role, room } = socket.data;
        if (!room || role !== "teacher") return;
        setTimerVisibility(room, visible === true);
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
      // this room can be chatted with (away ones too: they get it when they
      // come back), and reopening one just resends it.
      socket.on("open private chat", ({ studentId }) => {
        const { username, role, room } = socket.data;
        if (!room || role !== "teacher") return;

        const id = String(studentId || "");
        const student = getParticipant(room, id);
        if (!student || student.left) return;

        if (!student.chatOpened) {
          student.chatOpened = true;
          student.chatTeacherName = username;
        }
        sendPrivateChat(room, student);
      });

      // Students can only write in their own private chat. Teachers can write
      // in any private chat in their room, including an away student's: they
      // see it when they come back.

      socket.on("private message", ({ chatId, text }) => {

        if (socket.data.waiting) return;
        const { username, role, room } = socket.data;
        if (!username || !room) return;

        const state = getParticipant(room, String(chatId || ""));
        if (!state || state.left || !state.chatOpened) return;
        if (role === "student" && state.socketId !== socket.id) return;

        const cleanText = String(text || "").trim().slice(0, 1000);
        if (!cleanText) return;

        const message: ChatMessage = {
          username,
          role,
          text: cleanText,
          room,
          createdAt: new Date().toISOString(),
          chatId: state.id,
          avatarUrl: socket.data.avatarUrl ?? null,
          pup: socket.data.pup ?? null,
        };
        state.privateMessages = [...state.privateMessages, message].slice(-PRIVATE_HISTORY_LIMIT);

        // Only the student in this chat and the room's teachers get it.
        io.to([studentChannel(state.id), teacherChannel(room)]).emit("private message", message);
      });

      // A student's Parsons work reaches the room's teachers as it changes,
      // whether or not a private chat is open. Changing an answer clears its
      // result, since the old result no longer applies.
      socket.on("activity update", ({ answers }) => {
        if (socket.data.waiting) return;
        const { role, room } = socket.data;
        if (!room || role !== "student") return;

        const state = seatOf(socket);
        const cleaned = cleanAnswers(answers);
        if (!state || !cleaned) return;

        const previous = state.progress?.type === "parsons" ? state.progress : emptyParsons();
        const unchanged = (lines: ParsonsLine[], i: number) =>
          JSON.stringify(lines) === JSON.stringify(previous.answers[i]);
        setProgress(room, state, {
          type: "parsons",
          answers: cleaned,
          results: cleaned.map((lines, i) => (unchanged(lines, i) ? previous.results[i] ?? null : null)),
          marks: cleaned.map((lines, i) => (unchanged(lines, i) ? previous.marks[i] ?? null : null)),
        });
      });

      socket.on("edit student code", (edit, acknowledge) => {
        if (typeof acknowledge !== "function") return;
        const { role, room, waiting } = socket.data;
        if (!room || waiting || !edit || (role !== "student" && role !== "teacher")) {
          return acknowledge("You must join the room to edit code.");
        }
        const { studentId, questionIndex, before, code } = edit;
        // Students edit their own code. Only the authenticated room host can
        // join as a teacher, and a teacher can edit a connected student's code.
        const target = role === "student" ? seatOf(socket) : getParticipant(room, String(studentId ?? ""));
        const env = target?.env;
        const question = env && Number.isInteger(questionIndex) ? env.questions[questionIndex] : undefined;
        if (!target || target.socketId === null || target.left || !env || !question || question.parsons) {
          return acknowledge("That student's editor is unavailable.");
        }
        if (typeof before !== "string" || typeof code !== "string" ||
            before.length > STUDENT_CODE_MAX_LENGTH || code.length > STUDENT_CODE_MAX_LENGTH) {
          return acknowledge("The code is too long to share.");
        }
        const next = mergeCodeEdit(before, code, question.code);
        if (next === null) return acknowledge("Another edit changed the same text. Review the shared code and try again.");
        if (next.length > STUDENT_CODE_MAX_LENGTH) return acknowledge("The code is too long to share.");
        // The student's own text the server now has (usually the same string as the code).
        const tookStudentText = () => {
          if (role === "student") target.studentTexts[questionIndex] = code;
        };
        if (next === question.code) {
          tookStudentText();
          return acknowledge(null);
        }

        const previous = { ...question };
        question.code = next;
        question.lastRun = null;
        if (!publishCode(room, target, env)) {
          Object.assign(question, previous);
          return acknowledge("The room has reached its limit for saved work.");
        }
        tookStudentText();
        acknowledge(null);
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

          // Looked up after grading, since the room may have ended (or another
          // tab taken the seat) meanwhile.
          const state = seatOf(socket);
          if (state) {
            const previous = state.progress?.type === "parsons" ? state.progress : emptyParsons();
            setProgress(room, state, {
              type: "parsons",
              answers: withValue(previous.answers, index, answer, []),
              results: withValue(previous.results, index, graded.success, null),
              marks: withValue(previous.marks, index, graded.marks, null),
            });
          }
        } catch (err) {
          console.error("[socket] failed to check answer:", err);
        }
      });

      // Someone runs one question's code; the run waits its turn in the shared
      // queue. Students run the shared code. The teacher's own playground
      // has no environment, so its code runs as sent.
      socket.on("run code", ({ questionIndex, code }) => {
        if (socket.data.waiting) return;
        const { role, room } = socket.data;
        if (!room || !role) return;
        // A student's seat (with their environment), or undefined for a teacher.
        const seat = role === "student" ? seatOf(socket) : undefined;
        const env = seat?.env ?? null;
        if (role === "student" && !env) return;
        const owner = runOwner(socket);
        if (!owner) return;

        const index = Number(questionIndex);
        const reject = (reason: string) => socket.emit("run rejected", { questionIndex: index, reason });
        if (typeof code !== "string") return reject("There's no code to run.");
        if (code.length > STUDENT_CODE_MAX_LENGTH) return reject("Your code is too long to run.");

        const activity = roomActivities.get(room);
        const language = activity?.language ?? null;

        let started = false;
        let job: CodeRunJob;
        const hooks: JobHooks = {
          onQueued: (position) => socket.emit("run queued", { jobId: job.id, questionIndex: index, position }),
          onStart: () => {
            started = true;
            if (env) env.running = true;
            socket.emit("run started", { jobId: job.id, questionIndex: index });
          },
          onOutput: (stream, chunk) => socket.emit("run output", { jobId: job.id, stream, chunk }),
          onDone: (outcome) => {
            if (env && started) env.running = false;
            const question = env?.questions[index];
            // Saved only if the seat is still in the live room and the code didn't change since.
            const stillSeated = !!seat && liveRooms.get(room)?.participants.get(seat.id) === seat;
            if (seat && env && question && stillSeated && outcome.type === "finished" && question.code === job.request.code) {
              const previous = question.lastRun;
              question.lastRun = keptRun(outcome.result);
              if (!publishCode(room, seat, env)) question.lastRun = previous;
            }
            socket.emit("run finished", { jobId: job.id, questionIndex: index, outcome });
          },
        };

        try {
          if (env) {
            const question = Number.isInteger(index) ? env.questions[index] : undefined;
            if (!question) return reject("That question doesn't exist.");
            if (question.code !== code) return reject("The shared code changed. Review it and run again.");
            job = CodeRunJob.fromEnvironment(env, index, language, hooks);
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

        // Students' runs are limited per seat, so reconnecting doesn't reset it. Teachers' aren't.
        if (seat && !allowCodeRun(seat.runHistory)) {
          return reject("Too many runs. Wait a moment and try again.");
        }
        const result = executionQueue.enqueue(job);
        if (result.status === "queue-full") reject("Lots of people are running code. Try again in a moment.");
        if (result.status === "already-running") reject("Your code is already running.");
      });

      // Someone stops their own queued or running code.
      socket.on("cancel run", () => {
        if (!socket.data.role) return;
        const owner = runOwner(socket);
        if (owner) executionQueue.cancelOwner(owner);
      });

      // The Leave button. The seat is given up: teachers see the student go,
      // their work stays for the saved room, and their key no longer opens it,
      // so someone else using this browser can't get back into it. Joining
      // again starts a new seat.
      socket.on("leave room", (acknowledge) => {
        const { room, role } = socket.data;
        const live = room ? liveRooms.get(room) : undefined;
        const seat = role === "student" ? seatOf(socket) : undefined;
        if (room && live && seat) {
          if (live.byKey.get(seat.key) === seat) live.byKey.delete(seat.key);
          if (!seat.left) seatLeft(room, live, seat);
          broadcastRoster(room);
        }
        if (typeof acknowledge === "function") acknowledge();
      });

      socket.on("disconnect", (reason) => {
        console.log("[socket] user disconnected:", socket.id);
        // A newer socket of the same student took over: the seat and the room
        // are that socket's now, so there is nothing to clean up here.
        if (socket.data.replaced) return;
        const { room, role } = socket.data;
        const live = room ? liveRooms.get(room) : undefined;
        const seat = role === "student" ? seatOf(socket) : undefined;
        // Their output has nowhere to go, so free the runner for someone else.
        if (role) {
          const owner = runOwner(socket);
          if (owner) executionQueue.cancelOwner(owner);
        }
        if (!room) return;
        // This socket has already left its rooms, so the count no longer includes it.
        if (role === "student") void sendStudentCount(room);
        if (seat && live) {
          seat.socketId = null;
          // The page disconnected on purpose (the student went to another page
          // of the site): they left. Anything else -- a closed tab, a refresh,
          // a lost connection -- means they're away and may come back.
          if (reason === "client namespace disconnect") {
            if (!seat.left) seatLeft(room, live, seat);
          } else {
            seatAway(room, live, seat);
          }
          broadcastRoster(room);
        }
        if (role === "student") broadcastParticipants(io, room).catch(console.error);
        // The last teacher left: students hear about it if they don't come back soon.
        if (live && role === "teacher") checkTeacherAway(room, live);
        // An expired room ends once everyone has been gone for a while.
        if (live?.expired && socketCount(io, room) === 0) scheduleEmptyClose(io, room, live);
      });
    }
  );
}