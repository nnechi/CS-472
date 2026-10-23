import type { ActivitySummary } from "./types"

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

// api middleware to communicate to room service. 
export async function createRoom(hostID : string) : Promise<string>{ 
    const res = await fetch( `${SERVER_URL}/api/rooms`,  { 
        method:"POST", 
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
        method: "DELETE", 
        headers: {"Content-Type":"application/json"}, 
        body: JSON.stringify({hostID})
    })


    return res.ok; 

}

// The server explains failures as { error }. Use that message when there is one.
async function failureMessage(res : Response, fallback : string) : Promise<string> {
    const data = await res.json().catch(() => null);
    return data?.error ?? `${fallback} (server responded ${res.status})`;
}

// Saves a new activity for a teacher. Throws with the server's reason if it fails.
export async function createActivity(teacherId : string, name : string, data : string) : Promise<ActivitySummary> {
    const res = await fetch(`${SERVER_URL}/api/activities`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({teacherId, name, data})
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

// Sets the activity a room uses. Throws with the server's reason if it fails.
export async function saveActivity(roomCode : string, hostID : string, activityId : string) : Promise<void> {
    const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}/activity`, {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({hostID, activityId})
    })

    if (!res.ok) throw new Error(await failureMessage(res, "Could not save the activity."));
}

export async function checkRoomExists(roomCode : string) : Promise<Boolean> {
    const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}`, { 
        method: "GET", 
        headers: {"Content-Type":"application/json"},
    })

    return res.ok; 
}