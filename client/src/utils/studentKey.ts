// The key a student's seat is kept under on the server, one per room and
// name. The server hands it out on "join"; the client only remembers it and
// sends it back next time, which gets the student their seat (and their work)
// back after a dropped connection or a refresh.
//
// It's kept in sessionStorage, which belongs to this tab, and copied to
// localStorage for a few hours so a student who closed the tab can join again
// from the Join page with the same name. The server also checks the name, so
// a classmate using a different name on this computer never gets the seat.
// Pressing Leave forgets it here (and on the server), so whoever uses this
// browser next starts fresh.
//
// Storage can be blocked (private mode), so every read and write is allowed to
// fail -- the student just gets a new seat.

const SESSION_KEY = "littlepointers.studentKeys";
const LOCAL_KEY = "littlepointers.studentKeys";
// How long the copy for a closed tab is kept. A room lasts about an hour.
const KEEP_MS = 3 * 60 * 60 * 1000;

type Saved = Record<string, { key: string; savedAt: number }>;

// Names compare the way the server compares them: case and extra spaces don't matter.
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const entryId = (room: string, username: string) => `${room}\n${nameKey(username)}`;

function read(storage: Storage, item: string): Saved {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(item) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Saved) : {};
  } catch {
    return {};
  }
}

function write(storage: Storage, item: string, saved: Saved): void {
  try {
    storage.setItem(item, JSON.stringify(saved));
  } catch {
    // Storage unavailable: the key still works until the page reloads.
  }
}

const fresh = (entry: Saved[string] | undefined, now: number) =>
  !!entry && typeof entry.key === "string" && now - entry.savedAt < KEEP_MS;

// The key saved for this room and name, or undefined if there is none.
export function loadStudentKey(room: string, username: string): string | undefined {
  const id = entryId(room, username);
  try {
    const inTab = read(sessionStorage, SESSION_KEY)[id];
    if (inTab && typeof inTab.key === "string") return inTab.key;
  } catch {
    // sessionStorage blocked: fall through to the copy.
  }
  try {
    const copy = read(localStorage, LOCAL_KEY)[id];
    return fresh(copy, Date.now()) ? copy.key : undefined;
  } catch {
    return undefined;
  }
}

// True if this browser can get a seat back in this room under this name.
export function hasStudentKey(room: string, username: string): boolean {
  return loadStudentKey(room, username) !== undefined;
}

export function saveStudentKey(room: string, username: string, key: string): void {
  const id = entryId(room, username);
  const now = Date.now();
  try {
    const inTab = read(sessionStorage, SESSION_KEY);
    inTab[id] = { key, savedAt: now };
    write(sessionStorage, SESSION_KEY, inTab);
  } catch {
    // Ignore: see the note at the top.
  }
  try {
    const copies = read(localStorage, LOCAL_KEY);
    // Old rooms' keys are dropped as new ones are saved.
    for (const [other, entry] of Object.entries(copies)) if (!fresh(entry, now)) delete copies[other];
    copies[id] = { key, savedAt: now };
    write(localStorage, LOCAL_KEY, copies);
  } catch {
    // Ignore: see the note at the top.
  }
}

// Forget the key for this room and name: after Leave, or once the room ended.
export function forgetStudentKey(room: string, username: string): void {
  const id = entryId(room, username);
  for (const [storage, item] of [
    [() => sessionStorage, SESSION_KEY],
    [() => localStorage, LOCAL_KEY],
  ] as const) {
    try {
      const saved = read(storage(), item);
      if (!(id in saved)) continue;
      delete saved[id];
      write(storage(), item, saved);
    } catch {
      // Ignore: see the note at the top.
    }
  }
}
