// Two kinds of users.
export type Role = "student" | "teacher";


// The group chat's id. Private chats use the student's socket id instead.
export const GROUP_CHAT_ID = "group";

// User role and message of a user, and what room they belong to.
export interface ChatMessage {
  username: string;
  role: Role;
  text: string;
  room: string;
  createdAt: string; // ISO timestamp
  chatId: string; // GROUP_CHAT_ID, or the id of a private chat
}

// A private chat between the room's teacher and one student. `id` is the
// student's socket id, which is how messages get routed to them.
export interface PrivateChat {
  id: string;
  studentName: string;
  teacherName: string;
}

//raise hand uses id not username incase multiple people pick the same username.
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

// What the client is allowed to send to the server.
export interface ClientToServerEvents {
  // Sent once, right after connecting.
  join: (payload: { username: string; role: Role; room: string }) => void;
  // Username, role, and room are remembered server-side, so we only send text.
  "chat message": (payload: { text: string }) => void;
  // Students toggles their own hand up/down.
  "raise hand": () => void;
  // Teachers lowers a student's hand after helping them.
  "lower hand": (payload: { id: string }) => void;
  // Teachers only: start or pause the room's countdown.
  "timer play": () => void;
  "timer pause": () => void;
  // Teachers only: reset the countdown to the full time and stop it.
  "timer restart": () => void;
  // Teachers only: set a new length in whole minutes (1 to 60) and stop the timer.
  "timer set": (payload: { minutes: number }) => void;
  // Teachers only: open a private chat with a student who raised a hand.
  "open private chat": (payload: { studentId: string }) => void;
  // Teachers send to any private chat in the room. Students only to their own.
  "private message": (payload: { chatId: string; text: string }) => void;
}

// What the server sends back to clients.
export interface ServerToClientEvents {
  "chat message": (message: ChatMessage) => void;
  "chat history": (messages: ChatMessage[]) => void;
  // A private chat was opened (or sent again on join). Includes its history.
  "private chat opened": (payload: { chat: PrivateChat; messages: ChatMessage[] }) => void;
  // A student left, so their private chat is gone. Sent with the chat id.
  "private chat closed": (chatId: string) => void;
  "private message": (message: ChatMessage) => void;
  //TODO not implement yet, for users joining or leaving, sever messages, maintenance, etc.
  "system message": (text: string) => void;
  // Raised hands in the room, oldest first.
  "hand queue": (queue: RaisedHand[]) => void;
  // Sent to a student when their own hand goes up or down.
  "hand status": (raised: boolean) => void;
  // The room's timer, sent on join and on every play/pause.
  "timer state": (timer: TimerState) => void;
  "room closed" : () => void;
  "join error" : () => void; 
}

//Incase we set up server-to-server events
export interface InterServerEvents {}

// Each socket needs this info
export interface SocketData {
  username: string;
  role: Role;
  room: string;
}
