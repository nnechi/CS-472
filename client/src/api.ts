import type { ActivitySummary, ActivityType, ParsonsSettings, PastRoomDetail, PastRoomSummary, ProgrammingLanguage } from "./types"

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

// api middleware to communicate to room service. 
export async function createRoom(hostID : string) : Promise<string>{ 
    const res = await fetch( `${SERVER_URL}/api/rooms`,  { 
        method:"POST", credentials: "include", 
        headers: {"Content-Type":"application/json"}, 
        body: JSON.stringify({hostID})
    }); 


    if (res.ok){
        const data = await res.json(); 
        return data.code; 
    } 
     return "";  // dunno what to return here TBD 


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

// Saves a new activity for a teacher. Throws with the server's reason if it fails.
export async function createActivity(teacherId : string, activity : ActivityInput) : Promise<ActivitySummary> {
    const res = await fetch(`${SERVER_URL}/api/activities`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({teacherId, ...activity})
    })

    if (!res.ok) throw new Error(await failureMessage(res, "Could not save the activity."));
    return res.json();
}

// The activities a teacher made, A to Z. Throws with the server's reason if it fails.
export async function listActivities(teacherId : string) : Promise<ActivitySummary[]> {
    const res = await fetch(`${SERVER_URL}/api/activities?teacherId=${encodeURIComponent(teacherId)}`)

    if (!res.ok) throw new Error(await failureMessage(res, "Could not load your activities."));
    return res.json();
}

// Deletes one of a teacher's activities. Throws with the server's reason if it fails.
export async function deleteActivity(activityId : string, teacherId : string) : Promise<void> {
    const res = await fetch(`${SERVER_URL}/api/activities/${encodeURIComponent(activityId)}`, {
        method: "DELETE",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({teacherId})
    })

    if (!res.ok) throw new Error(await failureMessage(res, "Could not delete the activity."));
}

// Sets the activity a room uses. Throws with the server's reason if it fails.
export async function saveActivity(roomCode : string, hostID : string, activityId : string) : Promise<void> {
    const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}/activity`, {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({hostID, activityId})
    })

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

// The rooms this teacher ended, newest first. Needs a signed-in teacher. Throws with the server's reason if it fails.
export async function listPastRooms() : Promise<PastRoomSummary[]> {
    const res = await fetch(`${SERVER_URL}/api/past-rooms`, { credentials: "include" })

    if (res.status === 401) throw new SessionEndedError();
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load your previous activities."));
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

export async function checkRoomExists(roomCode : string) : Promise<Boolean> {
    const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}`, { 
        method: "GET", 
        headers: {"Content-Type":"application/json"},
    })

    return res.ok; 
}