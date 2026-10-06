// Keep this in sync with the server's src/types.ts.
export type Role = "student" | "teacher";

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

export interface ServerToClientEvents {
  "chat message": (message: ChatMessage) => void;
  "chat history": (messages: ChatMessage[]) => void;
  "system message": (text: string) => void;
  // Raised hands in the room, oldest first.
  "hand queue": (queue: RaisedHand[]) => void;
  // Sent to a student when their own hand goes up or down.
  "hand status": (raised: boolean) => void;
}

export interface ClientToServerEvents {
  join: (payload: { username: string; role: Role; room: string }) => void;
  "chat message": (payload: { text: string }) => void;
  // Students only: toggles their own hand up/down.
  "raise hand": () => void;
  // Teachers only: lowers a student's hand after helping them.
  "lower hand": (payload: { id: string }) => void;
}
