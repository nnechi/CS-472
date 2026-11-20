import { PastRoom } from "./models/PastRoom";
import {
  ActivityType,
  ChatMessage,
  PastRoomDetail,
  PastRoomSummary,
  PastStudent,
  RoomActivity,
  StudentProgress,
} from "./types";

// Saved rooms, read back for the teacher who ran them. The routes in index.ts
// pass the logged-in session user's id, so a teacher only ever sees their own.

// A date as an ISO string. Saved dates come back as Date objects.
function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function activityTypeOf(value: unknown): ActivityType | null {
  return value === "coding" || value === "parsons" ? value : null;
}

// One saved student, in the shape the client expects.
// Saved students are Mixed, so the fields are checked one by one.
function toPastStudent(raw: any): PastStudent {
  return {
    id: String(raw?.id ?? ""),
    username: String(raw?.username ?? ""),
    pup: typeof raw?.pup === "string" ? raw.pup : null,
    joinedAt: iso(raw?.joinedAt),
    hasPrivateChat: Boolean(raw?.hasPrivateChat ?? raw?.chatOpened),
    progress: (raw?.progress ?? null) as StudentProgress | null,
    privateMessages: Array.isArray(raw?.privateMessages) ? (raw.privateMessages as ChatMessage[]) : [],
  };
}

// Every saved room of this teacher, the most recently ended first.
export async function pastRoomsForHost(hostID: string): Promise<PastRoomSummary[]> {
  const found = await PastRoom.find({ hostID })
    .sort({ endedAt: -1 })
    .select("code activityName activityType startedAt endedAt students")
    .lean();

  return found.map((room) => ({
    code: room.code,
    activityName: room.activityName ?? null,
    activityType: activityTypeOf(room.activityType),
    startedAt: iso(room.startedAt),
    endedAt: iso(room.endedAt),
    studentCount: Array.isArray(room.students) ? room.students.length : 0,
  }));
}

// One saved room of this teacher, or null if the code isn't one of theirs.
export async function pastRoomForHost(code: string, hostID: string): Promise<PastRoomDetail | null> {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;

  const room = await PastRoom.findOne({ code: c, hostID }).lean();
  if (!room) return null;

  return {
    code: room.code,
    activityName: room.activityName ?? null,
    activity: (room.activity ?? null) as RoomActivity | null,
    startedAt: iso(room.startedAt),
    endedAt: iso(room.endedAt),
    students: Array.isArray(room.students) ? room.students.map(toPastStudent) : [],
    messages: Array.isArray(room.messages) ? (room.messages as ChatMessage[]) : [],
  };
}

// Deletes one saved room of this teacher. Returns false if the code isn't one of theirs.
export async function deletePastRoomForHost(code: string, hostID: string): Promise<boolean> {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return false;

  const result = await PastRoom.deleteOne({ code: c, hostID });
  return result.deletedCount === 1;
}
