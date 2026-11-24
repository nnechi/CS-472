import type { ActiveRoomSummary, ActivityNote, ActivityDetail, ActivitySummary, ActivityType, NoteSummary, NoteText, ParsonsSettings, PastRoomDetail, PastRoomSummary, ProgrammingLanguage, RoomNotes, RoomStatSummary } from "./types"

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

// api middleware to communicate to room service. 
export async function createRoom(hostID : string) : Promise<string>{ 
    const res = await fetch( `${SERVER_URL}/api/rooms`,  { 
        method:"POST", credentials: "include", 
        headers: {"Content-Type":"application/json"}, 
        body: JSON.stringify({hostID})
    }); 


    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not create a room."));
    const data = await res.json();
    if (typeof data.code !== "string" || !data.code) {
        throw new Error("Server did not return a room code.");
    }
    return data.code;
}


// api middleware to communicate a deletion to the room; 


export async function deleteRoom(roomCode : string, hostID : string) : Promise<Boolean> { 
    const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}`, { 
        method: "DELETE", credentials: "include",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({hostID})
    })

    // The sign-in expired: the caller signs the teacher out.
    if (res.status === 401) throw new SessionEndedError();
    return res.ok;

}

// The server explains failures as { error }. Use that message when there is one.
async function failureMessage(res : Response, fallback : string) : Promise<string> {
    const data = await res.json().catch(() => null);
    return data?.error ?? `${fallback} (server responded ${res.status})`;
}

// What the editor sends for one question. Only the fields for the activity's type are set.
export type ActivityQuestionInput =
    | { question : string; output : string }
    | { question : string; code : string; distractors : string; options : ParsonsSettings }

export interface ActivityInput {
    name : string;
    type : ActivityType;
    language : ProgrammingLanguage | null;
    questions : ActivityQuestionInput[];
}

// Saves a new activity for the signed-in teacher. Throws with the server's reason if it fails.
export async function createActivity(activity : ActivityInput) : Promise<ActivitySummary> {
    const res = await fetch(`${SERVER_URL}/api/activities`, {
        method: "POST", credentials: "include",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(activity)
    })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not save the activity."));
    return res.json();
}

// The activities the signed-in teacher made, A to Z. Throws with the server's reason if it fails.
export async function listActivities() : Promise<ActivitySummary[]> {
    const res = await fetch(`${SERVER_URL}/api/activities`, { credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load your activities."));
    return res.json();
}

// Activities already loaded for a preview, so hovering the same one again doesn't refetch.
// Holds the request itself, so two previews opening at once share one fetch.
const activityDetailCache = new Map<string, Promise<ActivityDetail>>();

// Loads one of the signed-in teacher's activities with its answers. Throws with the server's reason if it fails.
export function getActivity(activityId : string) : Promise<ActivityDetail> {
    const cached = activityDetailCache.get(activityId);
    if (cached) return cached;

    const request = (async () => {
        const res = await fetch(`${SERVER_URL}/api/activities/${encodeURIComponent(activityId)}`, { credentials: "include" })
        if (res.status === 401) throw new SessionEndedError();
        if (!res.ok) throw new Error(await failureMessage(res, "Could not load the activity."));
        return res.json() as Promise<ActivityDetail>;
    })();
    // A failed load isn't kept, so the next hover tries again.
    request.catch(() => activityDetailCache.delete(activityId));
    activityDetailCache.set(activityId, request);
    return request;
}

// Drops a cached activity so the next getActivity loads it fresh. Call after the activity changes or is deleted.
export function forgetActivity(activityId : string) : void {
    activityDetailCache.delete(activityId);
}

// Deletes one of the signed-in teacher's activities. Throws with the server's reason if it fails.
export async function deleteActivity(activityId : string) : Promise<void> {
    const res = await fetch(`${SERVER_URL}/api/activities/${encodeURIComponent(activityId)}`, {
        method: "DELETE", credentials: "include"
    })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not delete the activity."));
    forgetActivity(activityId);
}

// One question as the editor reads it back for editing. Only the fields for
// the activity's type are meaningful; the rest are empty/default.
export interface ActivityQuestionDetail {
    question : string;
    output : string;
    code : string;
    distractors : string;
    options : Partial<ParsonsSettings>;
}

// An activity with every question's content, for the edit page.
export interface ActivityDetail {
    id : string;
    name : string;
    type : ActivityType;
    language : ProgrammingLanguage | null;
    questions : ActivityQuestionDetail[];
}

// One of the signed-in teacher's activities, with its full content. Throws with the server's reason if it fails.
export async function getActivity(activityId : string) : Promise<ActivityDetail> {
    const res = await fetch(`${SERVER_URL}/api/activities/${encodeURIComponent(activityId)}`, { credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load that activity."));
    return res.json();
}

// Saves changes to one of the signed-in teacher's activities, in place. Throws with the server's reason if it fails.
export async function updateActivity(activityId : string, activity : ActivityInput) : Promise<ActivitySummary> {
    const res = await fetch(`${SERVER_URL}/api/activities/${encodeURIComponent(activityId)}`, {
        method: "PUT", credentials: "include",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(activity)
    })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not save the activity."));
    return res.json();
}

// Sets the activity a room uses. Throws with the server's reason if it fails.
export async function saveActivity(roomCode : string, activityId : string) : Promise<void> {
    const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}/activity`, {
        method: "PUT", credentials: "include",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({activityId})
    })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not save the activity."));
}

// Thrown when the server says nobody is signed in (401), for example after the
// server restarted and lost its sessions. The page should send the user to sign in again.
export class SessionEndedError extends Error {
    constructor(message = "Your session has ended. Please sign in again.") {
        super(message);
        this.name = "SessionEndedError";
    }
}

// This teacher's rooms that are still running, newest first: rooms they opened
// that haven't been ended, including ones whose tab they closed. Needs a
// signed-in teacher. Throws with the server's reason if it fails.
export async function listActiveRooms() : Promise<ActiveRoomSummary[]> {
    const res = await fetch(`${SERVER_URL}/api/active-rooms`, { credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load your running rooms."));
    return res.json();
}

// The rooms this teacher ended, newest first. Needs a signed-in teacher. Throws with the server's reason if it fails.
export async function listPastRooms() : Promise<PastRoomSummary[]> {
    const res = await fetch(`${SERVER_URL}/api/past-rooms`, { credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load your previous activities."));
    return res.json();
}

// The dashboard's room stats: every room this teacher ended, newest first. Unlike listPastRooms,
// deleting a previous activity does not remove a room from these. Throws with the server's reason if it fails.
export async function listRoomStats() : Promise<RoomStatSummary[]> {
    const res = await fetch(`${SERVER_URL}/api/room-stats`, { credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load your room stats."));
    return res.json();
}

// Everything saved about one ended room this teacher ran. Throws with the server's reason if it fails.
export async function getPastRoom(roomCode : string) : Promise<PastRoomDetail> {
    const res = await fetch(`${SERVER_URL}/api/past-rooms/${encodeURIComponent(roomCode)}`, { credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load that room."));
    return res.json();
}

// Deletes one ended room this teacher ran. Throws with the server's reason if it fails.
export async function deletePastRoom(roomCode : string) : Promise<void> {
    const res = await fetch(`${SERVER_URL}/api/past-rooms/${encodeURIComponent(roomCode)}`, { method: "DELETE", credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not delete that room."));
}

// ---------- Teacher notes: private to the signed-in teacher ----------

// Every note the signed-in teacher has written, most recently changed first. Throws with the server's reason if it fails.
export async function listNotes() : Promise<NoteSummary[]> {
    const res = await fetch(`${SERVER_URL}/api/notes`, { credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load your notes."));
    return res.json();
}

// The note on one of the signed-in teacher's activities. Throws with the server's reason if it fails.
export async function getActivityNote(activityId : string) : Promise<ActivityNote> {
    const res = await fetch(`${SERVER_URL}/api/notes/activities/${encodeURIComponent(activityId)}`, { credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load your note."));
    return res.json();
}

// Saves the note on one of the signed-in teacher's activities. Empty text deletes it.
export async function saveActivityNote(activityId : string, text : string) : Promise<NoteText> {
    const res = await fetch(`${SERVER_URL}/api/notes/activities/${encodeURIComponent(activityId)}`, {
        method: "PUT", credentials: "include",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ text })
    })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not save your note."));
    return res.json();
}

// A room's notes: its own, and the note on the activity it uses. Works while the
// room is being set up, while it's live, and once it's saved.
export async function getRoomNotes(roomCode : string) : Promise<RoomNotes> {
    const res = await fetch(`${SERVER_URL}/api/notes/rooms/${encodeURIComponent(roomCode)}`, { credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load your notes."));
    return res.json();
}

// Saves a room's own note. Empty text deletes it.
export async function saveRoomNote(roomCode : string, text : string) : Promise<NoteText> {
    const res = await fetch(`${SERVER_URL}/api/notes/rooms/${encodeURIComponent(roomCode)}`, {
        method: "PUT", credentials: "include",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ text })
    })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not save your note."));
    return res.json();
}

// determines whether the roomstatus is allowing students to join.
export type RoomStatus = "ok" | "not-found" | "not-open";

export async function getRoomStatus(roomCode : string) : Promise<RoomStatus> {
    const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}`)

    if (res.ok) return "ok";
    if (res.status === 404) return "not-found";
    if (res.status === 409) return "not-open";
    throw new Error(await failureMessage(res, "Could not look up the room."));
}

// mark the room open for students to join
export async function markRoomOpen(roomCode : string, activityId : string) : Promise<void>{ 
     const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}/open`, { 
        method: "PUT", credentials: "include",
        headers: {"Content-Type":"application/json"},
        body : JSON.stringify({activityId}), 
    })
    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not open room.")); 
}