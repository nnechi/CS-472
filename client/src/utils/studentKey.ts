// The key a student's environment is kept under on the server, one per room.
// The server hands it out on "join"; the client only remembers it and sends it
// back next time. It's in sessionStorage, so it survives a refresh but each
// tab is its own student. Storage can be blocked (private mode), so every read
// and write is allowed to fail -- the student just gets a new environment.
const storageKey = (room: string) => `littlepointers.studentKey.${room}`;

// The key saved for this room, or undefined on a first visit.
export function loadStudentKey(room: string): string | undefined {
  try {
    return sessionStorage.getItem(storageKey(room)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveStudentKey(room: string, key: string): void {
  try {
    sessionStorage.setItem(storageKey(room), key);
  } catch {
    // Storage unavailable: the key still works until the page reloads.
  }
}
