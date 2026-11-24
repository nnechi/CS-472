import { isObjectIdOrHexString } from "mongoose";
import { Activity } from "./models/Activity";
import { Note } from "./models/Note";
import { PastRoom } from "./models/PastRoom";
import { Room } from "./models/Room";
import { liveRoomInfo } from "./socket";
import { ActivityNote, NOTE_MAX_LENGTH, NoteKind, NoteSummary, NoteText, RoomNotes } from "./types";

// Teacher notes, read and saved for the logged-in teacher only. The routes in
// index.ts pass the session user's id, never one the browser sends, and every
// function checks that the activity or room belongs to that teacher.

// Stray notes (their activity or room is gone) are only cleaned up once they're
// this old, so a note is never lost in the moment between a room ending and it
// being saved, when the room is briefly in neither place.
const STRAY_NOTE_AGE_MS = 60 * 60 * 1000;

// A date as an ISO string, or null. Saved dates come back as Date objects.
function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Room codes are saved in upper case, without spaces around them.
function cleanRoomCode(code: string): string {
  return String(code || "").trim().toUpperCase();
}

// The note text from a request body, or the reason it can't be saved.
export function parseNoteText(body: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = (body as { text?: unknown } | null | undefined)?.text;
  if (typeof text !== "string") return { ok: false, error: "Send the note's text." };
  if (text.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: `Notes can be at most ${NOTE_MAX_LENGTH} characters.` };
  }
  return { ok: true, text };
}

// One note's text, or empty text if the teacher hasn't written one.
async function readNote(teacherId: string, kind: NoteKind, targetId: string): Promise<NoteText> {
  const note = await Note.findOne({ teacherId, kind, targetId }).select("text updatedAt").lean();
  return note ? { text: note.text, updatedAt: iso(note.updatedAt) } : { text: "", updatedAt: null };
}

// Saves a note. Empty (or only spaces) text deletes it, so blank notes don't pile up.
async function writeNote(teacherId: string, kind: NoteKind, targetId: string, text: string): Promise<NoteText> {
  if (!text.trim()) {
    await Note.deleteOne({ teacherId, kind, targetId });
    return { text: "", updatedAt: null };
  }

  const filter = { teacherId, kind, targetId };
  const update = { $set: { text } };
  try {
    // upsert: update the note, or create it if this is the first save.
    const note = await Note.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
    }).lean();
    return { text: note?.text ?? text, updatedAt: iso(note?.updatedAt) };
  } catch (err) {
    // Two first saves at once: one created the note, so the other updates it.
    if ((err as { code?: number }).code !== 11000) throw err;
    const note = await Note.findOneAndUpdate(filter, update, { returnDocument: "after", runValidators: true }).lean();
    return { text: note?.text ?? text, updatedAt: iso(note?.updatedAt) };
  }
}

// ---------- Activity notes ----------

// The name of this teacher's activity, or null if it isn't theirs (or doesn't exist).
async function ownActivityName(activityId: string, teacherId: string): Promise<string | null> {
  if (!isObjectIdOrHexString(activityId)) return null;
  const activity = await Activity.findOne({ _id: activityId, teacherId }).select("name").lean();
  return activity ? activity.name : null;
}

// The note on one of this teacher's activities, or null if the activity isn't theirs.
export async function activityNoteFor(activityId: string, teacherId: string): Promise<ActivityNote | null> {
  const name = await ownActivityName(activityId, teacherId);
  if (name === null) return null;
  return { activityId, activityName: name, ...(await readNote(teacherId, "activity", activityId)) };
}

// Saves the note on one of this teacher's activities. Null if the activity isn't theirs.
export async function saveActivityNoteFor(activityId: string, teacherId: string, text: string): Promise<NoteText | null> {
  if ((await ownActivityName(activityId, teacherId)) === null) return null;
  return writeNote(teacherId, "activity", activityId, text);
}

// Deletes an activity's note. Used when the activity is deleted.
export async function deleteActivityNote(activityId: string, teacherId: string): Promise<void> {
  await Note.deleteOne({ teacherId, kind: "activity", targetId: activityId });
}

// ---------- Room notes ----------

// If this teacher hosts the room (being set up, live, or saved), the activity it
// uses. Null if the room isn't theirs.
async function ownRoom(code: string, teacherId: string): Promise<{ activityId: string | null } | null> {
  const room = await Room.findOne({ code, hostID: teacherId }).select("activityId").lean();
  if (room) return { activityId: room.activityId ? String(room.activityId) : null };

  // Live rooms outlast their Room doc (it expires after 60 minutes).
  const live = liveRoomInfo(code);
  if (live && live.hostID === teacherId) return { activityId: live.activityId ? String(live.activityId) : null };

  const past = await PastRoom.findOne({ code, hostID: teacherId }).select("activityId").lean();
  if (past) return { activityId: past.activityId ?? null };

  return null;
}

// A room's notes for this teacher: the room's own note, and the note on the
// activity it uses. Null if the room isn't theirs.
export async function roomNotesFor(code: string, teacherId: string): Promise<RoomNotes | null> {
  const c = cleanRoomCode(code);
  if (!c) return null;

  const owned = await ownRoom(c, teacherId);
  const room = await readNote(teacherId, "room", c);
  // A note the teacher already wrote stays theirs, even in the moment between
  // a room ending and it being saved, when the room is briefly in neither place.
  if (!owned && room.updatedAt === null) return null;

  const activity = owned?.activityId ? await activityNoteFor(owned.activityId, teacherId) : null;
  return { room, activity };
}

// Saves a room's own note. Null if the room isn't this teacher's.
export async function saveRoomNoteFor(code: string, teacherId: string, text: string): Promise<NoteText | null> {
  const c = cleanRoomCode(code);
  if (!c) return null;
  if (!(await ownRoom(c, teacherId))) {
    // Same exception as above: their existing note on a room that just ended.
    const existing = await Note.exists({ teacherId, kind: "room", targetId: c });
    if (!existing) return null;
  }
  return writeNote(teacherId, "room", c, text);
}

// Deletes a room's note. Used when a saved room is deleted.
export async function deleteRoomNote(code: string, teacherId: string): Promise<void> {
  await Note.deleteOne({ teacherId, kind: "room", targetId: cleanRoomCode(code) });
}

// ---------- The Notes page ----------

// Every note of this teacher, most recently changed first, with what it's about.
export async function notesForTeacher(teacherId: string): Promise<NoteSummary[]> {
  const notes = await Note.find({ teacherId }).sort({ updatedAt: -1 }).lean();

  const activityIds = new Set<string>();
  const roomCodes: string[] = [];
  for (const note of notes) {
    if (note.kind === "activity") activityIds.add(note.targetId);
    else roomCodes.push(note.targetId);
  }

  // Each room note's room: saved, or still being set up or live.
  const [pastRooms, rooms] = await Promise.all([
    PastRoom.find({ code: { $in: roomCodes }, hostID: teacherId }).select("code activityName endedAt").lean(),
    Room.find({ code: { $in: roomCodes }, hostID: teacherId }).select("code activityId").lean(),
  ]);
  const previous = new Map(pastRooms.map((room) => [room.code, room]));
  const current = new Map<string, string | null>(); // room code -> its activity's id
  for (const room of rooms) current.set(room.code, room.activityId ? String(room.activityId) : null);
  for (const code of roomCodes) {
    if (previous.has(code) || current.has(code)) continue;
    const live = liveRoomInfo(code);
    if (live && live.hostID === teacherId) current.set(code, live.activityId ? String(live.activityId) : null);
  }

  // The names of every activity involved: noted ones, and the ones current rooms use.
  for (const id of current.values()) if (id) activityIds.add(id);
  const validIds = [...activityIds].filter((id) => isObjectIdOrHexString(id));
  const activities = await Activity.find({ _id: { $in: validIds }, teacherId }).select("name").lean();
  const names = new Map(activities.map((activity) => [String(activity._id), activity.name]));

  const summaries: NoteSummary[] = [];
  const strays: unknown[] = [];
  const strayBefore = Date.now() - STRAY_NOTE_AGE_MS;
  for (const note of notes) {
    const updatedAt = iso(note.updatedAt) ?? "";
    const base = { kind: note.kind as NoteKind, targetId: note.targetId, text: note.text, updatedAt };

    if (note.kind === "activity") {
      const name = names.get(note.targetId);
      if (name !== undefined) {
        summaries.push({ ...base, activityName: name, roomStatus: null, endedAt: null });
        continue;
      }
    } else {
      const past = previous.get(note.targetId);
      if (past) {
        summaries.push({ ...base, activityName: past.activityName ?? null, roomStatus: "previous", endedAt: iso(past.endedAt) });
        continue;
      }
      if (current.has(note.targetId)) {
        const activityId = current.get(note.targetId);
        summaries.push({ ...base, activityName: activityId ? names.get(activityId) ?? null : null, roomStatus: "current", endedAt: null });
        continue;
      }
    }

    // Its activity or room no longer exists. Old enough: clean it up.
    if (new Date(note.updatedAt).getTime() < strayBefore) strays.push(note._id);
  }

  if (strays.length > 0) {
    await Note.deleteMany({ _id: { $in: strays }, teacherId }).catch((err) =>
      console.error("[notes] failed to clean up stray notes:", err),
    );
  }
  return summaries;
}
