import type { ActiveRoomSummary, ActivityNote, ActivityDetail, ActivitySummary, ActivityType, NoteSummary, NoteText, ParsonsSettings, PastRoomDetail, PastRoomSummary, ProgrammingLanguage, RoomNotes, RoomStatSummary } from "./types"
import type { AuthState } from "./context/AuthProvider"

// The server's address. The browser runs on your host machine, so it reaches the server via
// localhost:3000 (the port docker-compose publishes). Override it with VITE_SERVER_URL.
// Every file that talks to the server uses this one.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

// Thrown when the server says nobody is signed in (401), for example after the
// server restarted and lost its sessions. The page should send the user to sign in again.
export class SessionEndedError extends Error {
    constructor(message = "Your session has ended. Please sign in again.") {
        super(message);
        this.name = "SessionEndedError";
    }
}

// The server explains failures as { error }. Use that message when there is one.
async function failureMessage(res : Response, fallback : string) : Promise<string> {
    const data = await res.json().catch(() => null);
    return data?.error ?? `${fallback} (server responded ${res.status})`;
}

// Sends a request with the sign-in cookie. A 401 means the sign-in ended, so it throws SessionEndedError.
async function send(path : string, init : RequestInit = {}) : Promise<Response> {
    const res = await fetch(`${SERVER_URL}${path}`, { credentials: "include", ...init });
    if (res.status === 401) {
        // Whoever signs in next may be someone else, so nothing cached for this teacher may be shown to them.
        forgetAllActivities();
        throw new SessionEndedError();
    }
    return res;
}

// Like send, but any other failure throws too, with the server's reason or the fallback.
async function request(path : string, fallback : string, init : RequestInit = {}) : Promise<Response> {
    const res = await send(path, init);
    if (!res.ok) throw new Error(await failureMessage(res, fallback));
    return res;
}

// The options for a request that sends a JSON body.
function jsonBody(method : string, body : unknown) : RequestInit {
    return { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) };
}

// ---- Signing in ----

// How the server describes a signed-in user.
interface ServerUser {
    id : string;
    email : string;
    name : string | null;
    picture : string | null;
}

// The app's sign-in state for a user the server sent. Users without a name show their email.
function toAuthState(user : ServerUser) : AuthState {
    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name ?? user.email,
            picture: user.picture,
        },
    };
}

// Who is signed in, or null when nobody is. Throws only when the server can't be reached.
export async function getMe() : Promise<AuthState | null> {
    const res = await fetch(`${SERVER_URL}/api/me`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json() as { user : ServerUser };
    return toAuthState(data.user);
}

// Login and signup answer { user } on success and { message } on failure. A 401 here
// means a wrong email or password, not an ended session, so these don't use send().
async function startSession(path : string, body : unknown, fallback : string) : Promise<AuthState> {
    let res : Response;
    try {
        // credentials lets the browser keep the login cookie the server sends back
        res = await fetch(`${SERVER_URL}${path}`, { credentials: "include", ...jsonBody("POST", body) });
    } catch {
        // fetch only throws when the request never got an answer
        throw new Error("No server response. Please try again.");
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.user) throw new Error(data?.message || fallback);
    // A new sign-in, possibly a different teacher: drop what was cached for the last one.
    forgetAllActivities();
    return toAuthState(data.user);
}

// Signs in with email and password. Throws with the server's reason (wrong password, missing field) if it fails.
export function login(email : string, password : string) : Promise<AuthState> {
    return startSession("/api/auth/login", { email, password }, "Login failed. Please try again.");
}

// Makes an account and signs it in. Throws with the server's reason (email taken, invalid input) if it fails.
export function signup(name : string, email : string, password : string) : Promise<AuthState> {
    return startSession("/api/auth/signup", { user: name, email, password }, "Registration failed. Please try again.");
}

// ---- Account settings ----

// Whether the signed-in teacher signs in with a password (and so can change it here) rather than Google.
export async function getAccount() : Promise<{ passwordAccount : boolean }> {
    const res = await request("/api/account", "Could not load account settings. Please refresh or sign in again.");
    return res.json();
}

export type AccountAction = "email" | "password" | "delete";

// Changes the signed-in teacher's email or password, or deletes the account. Throws with the server's reason if it fails.
export async function updateAccount(action : AccountAction, body : object) : Promise<{ message : string; user? : ServerUser }> {
    const res = await request(`/api/account/${action}`, "Could not update your account.", jsonBody("POST", body));
    return res.json();
}

// ---- Rooms ----

// api middleware to communicate to room service.
export async function createRoom(hostID : string) : Promise<string>{
    const res = await request("/api/rooms", "Could not create a room.", jsonBody("POST", {hostID}));
    const data = await res.json();
    if (typeof data.code !== "string" || !data.code) {
        throw new Error("Server did not return a room code.");
    }
    return data.code;
}

// api middleware to communicate a deletion to the room. False if the server refused.
export async function deleteRoom(roomCode : string, hostID : string) : Promise<boolean> {
    const res = await send(`/api/rooms/${encodeURIComponent(roomCode)}`, jsonBody("DELETE", {hostID}));
    return res.ok;
}

// Sets the activity a room uses. Throws with the server's reason if it fails.
export async function saveActivity(roomCode : string, activityId : string) : Promise<void> {
    await request(`/api/rooms/${encodeURIComponent(roomCode)}/activity`, "Could not save the activity.", jsonBody("PUT", {activityId}));
}

// mark the room open for students to join
export async function markRoomOpen(roomCode : string, activityId : string) : Promise<void>{
    await request(`/api/rooms/${encodeURIComponent(roomCode)}/open`, "Could not open room.", jsonBody("PUT", {activityId}));
}

// determines whether the roomstatus is allowing students to join.
export type RoomStatus = "ok" | "not-found" | "not-open";

// Students aren't signed in, so this is a plain fetch: 404 and 409 are answers, not errors.
export async function getRoomStatus(roomCode : string) : Promise<RoomStatus> {
    const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}`)

    if (res.ok) return "ok";
    if (res.status === 404) return "not-found";
    if (res.status === 409) return "not-open";
    throw new Error(await failureMessage(res, "Could not look up the room."));
}

// This teacher's rooms that are still running, newest first: rooms they opened
// that haven't been ended, including ones whose tab they closed. Needs a
// signed-in teacher. Throws with the server's reason if it fails.
export async function listActiveRooms() : Promise<ActiveRoomSummary[]> {
    const res = await request("/api/active-rooms", "Could not load your running rooms.");
    return res.json();
}

// The rooms this teacher ended, newest first. Needs a signed-in teacher. Throws with the server's reason if it fails.
export async function listPastRooms() : Promise<PastRoomSummary[]> {
    const res = await request("/api/past-rooms", "Could not load your previous activities.");
    return res.json();
}

// The dashboard's room stats: every room this teacher ended, newest first. Unlike listPastRooms,
// deleting a previous activity does not remove a room from these. Throws with the server's reason if it fails.
export async function listRoomStats() : Promise<RoomStatSummary[]> {
    const res = await request("/api/room-stats", "Could not load your room stats.");
    return res.json();
}

// Everything saved about one ended room this teacher ran. Throws with the server's reason if it fails.
export async function getPastRoom(roomCode : string) : Promise<PastRoomDetail> {
    const res = await request(`/api/past-rooms/${encodeURIComponent(roomCode)}`, "Could not load that room.");
    return res.json();
}

// Deletes one ended room this teacher ran. Throws with the server's reason if it fails.
export async function deletePastRoom(roomCode : string) : Promise<void> {
    await request(`/api/past-rooms/${encodeURIComponent(roomCode)}`, "Could not delete that room.", { method: "DELETE" });
}

// ---- Teacher notes: private to the signed-in teacher ----

// Every note the signed-in teacher has written, most recently changed first. Throws with the server's reason if it fails.
export async function listNotes() : Promise<NoteSummary[]> {
    const res = await request("/api/notes", "Could not load your notes.");
    return res.json();
}

// The note on one of the signed-in teacher's activities. Throws with the server's reason if it fails.
export async function getActivityNote(activityId : string) : Promise<ActivityNote> {
    const res = await request(`/api/notes/activities/${encodeURIComponent(activityId)}`, "Could not load your note.");
    return res.json();
}

// Saves the note on one of the signed-in teacher's activities. Empty text deletes it.
export async function saveActivityNote(activityId : string, text : string) : Promise<NoteText> {
    const res = await request(`/api/notes/activities/${encodeURIComponent(activityId)}`, "Could not save your note.", jsonBody("PUT", { text }));
    return res.json();
}

// A room's notes: its own, and the note on the activity it uses. Works while the
// room is being set up, while it's live, and once it's saved.
export async function getRoomNotes(roomCode : string) : Promise<RoomNotes> {
    const res = await request(`/api/notes/rooms/${encodeURIComponent(roomCode)}`, "Could not load your notes.");
    return res.json();
}

// Saves a room's own note. Empty text deletes it.
export async function saveRoomNote(roomCode : string, text : string) : Promise<NoteText> {
    const res = await request(`/api/notes/rooms/${encodeURIComponent(roomCode)}`, "Could not save your note.", jsonBody("PUT", { text }));
    return res.json();
}

// ---- Activities ----

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
    const res = await request("/api/activities", "Could not save the activity.", jsonBody("POST", activity));
    return res.json();
}

// The activities the signed-in teacher made, A to Z. Throws with the server's reason if it fails.
export async function listActivities() : Promise<ActivitySummary[]> {
    const res = await request("/api/activities", "Could not load your activities.");
    return res.json();
}

// Activities already loaded for a preview, so hovering the same one again doesn't refetch.
// Holds the request itself, so two previews opening at once share one fetch.
const activityDetailCache = new Map<string, Promise<ActivityDetail>>();

// Loads one of the signed-in teacher's activities with its answers. Throws with the server's reason if it fails.
export function getActivity(activityId : string) : Promise<ActivityDetail> {
    const cached = activityDetailCache.get(activityId);
    if (cached) return cached;

    const loading = request(`/api/activities/${encodeURIComponent(activityId)}`, "Could not load the activity.")
        .then((res) => res.json() as Promise<ActivityDetail>);
    // A failed load isn't kept, so the next hover tries again.
    loading.catch(() => activityDetailCache.delete(activityId));
    activityDetailCache.set(activityId, loading);
    return loading;
}

// Drops a cached activity so the next getActivity loads it fresh. Call after the activity changes or is deleted.
export function forgetActivity(activityId : string) : void {
    activityDetailCache.delete(activityId);
}

// Drops every cached activity. The cache holds one teacher's answers, so it is
// cleared whenever the signed-in teacher may have changed.
function forgetAllActivities() : void {
    activityDetailCache.clear();
}

// Deletes one of the signed-in teacher's activities. Throws with the server's reason if it fails.
export async function deleteActivity(activityId : string) : Promise<void> {
    await request(`/api/activities/${encodeURIComponent(activityId)}`, "Could not delete the activity.", { method: "DELETE" });
    forgetActivity(activityId);
}

// Saves changes to one of the signed-in teacher's activities, in place. Throws with the server's reason if it fails.
export async function updateActivity(activityId : string, activity : ActivityInput) : Promise<ActivitySummary> {
    const res = await request(`/api/activities/${encodeURIComponent(activityId)}`, "Could not save the activity.", jsonBody("PUT", activity));
    // The cached copy is now out of date: the preview and the edit page must load the new one.
    forgetActivity(activityId);
    return res.json();
}
