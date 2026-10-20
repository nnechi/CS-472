// Keep this in sync with the server's src/types.ts.
export type Role = "student" | "teacher";

// Everything the chat needs to know about the current user. Built from the
// signed-in user (AuthProvider) plus the room code from the URL.
export interface Session {
  username: string;
  role: Role;
  room: string;
}

export interface ChatMessage {
  username: string;
  role: Role;
  text: string;
  room: string;
  createdAt: string; // ISO timestamp
}

// A student waiting for help. `id` is the student's socket id.
export interface RaisedHand {
  id: string;
  username: string;
  raisedAt: string; // ISO timestamp
}

// The room's countdown timer. remainingMs is the time left right now, and
// running means it is counting down.
export interface TimerState {
  durationMs: number; // the length the teacher chose, what Restart returns to
  remainingMs: number;
  running: boolean;
}

export interface ServerToClientEvents {
  "chat message": (message: ChatMessage) => void;
  "chat history": (messages: ChatMessage[]) => void;
  "system message": (text: string) => void;
  // Raised hands in the room, oldest first.
  "hand queue": (queue: RaisedHand[]) => void;
  // Sent to a student when their own hand goes up or down.
  "hand status": (raised: boolean) => void;
  // The room's timer, sent to teachers on join and on every play/pause.
  "timer state": (timer: TimerState) => void;
  "room closed" : () => void;
  "join error" : () =>  void; 
}

export interface ClientToServerEvents {
  join: (payload: { username: string; role: Role; room: string }) => void;
  "chat message": (payload: { text: string }) => void;
  // Students only: toggles their own hand up/down.
  "raise hand": () => void;
  // Teachers only: lowers a student's hand after helping them.
  "lower hand": (payload: { id: string }) => void;
  // Teachers only: start or pause the room's countdown.
  "timer play": () => void;
  "timer pause": () => void;
  // Teachers only: reset the countdown to the full time and stop it.
  "timer restart": () => void;
  // Teachers only: set a new length in whole minutes (1 to 60) and stop the timer.
  "timer set": (payload: { minutes: number }) => void;
}
