// Keep this in sync with the server's src/types.ts.
export type Role = "student" | "teacher";

export type CodeSubmissionLanguage = "javascript" | "typescript";
export type CodeSubmissionAck =
  | {
      accepted: true;
      language: CodeSubmissionLanguage;
      bytes: number;
      exitCode: number | null;
      timedOut: boolean;
      cancelled: boolean;
      outputLimitExceeded: boolean;
      executionID : string; 
      stdout : string; 
      stderr : string; 

    }
  | { accepted: false; message: string };

   export type CodeRunUpdate =
    | { executionId: string; type: "status"; phase: "compiling" | "running" }
    | { executionId: string; type: "output"; stream: "stdout" | "stderr"; chunk: string }
    | {
        executionId: string;
        type: "complete";
        exitCode: number | null;
        signal: string | null;
        timedOut: boolean;
        cancelled: boolean;
        outputLimitExceeded: boolean;
      }
    | { executionId: string; type: "error"; message: string };

// Everything the chat needs to know about the current user. Built from the
// signed-in user (AuthProvider) plus the room code from the URL.
export interface Session {
  username: string;
  role: Role;
  room: string;
}

// The group chat's id. Private chats use the student's socket id instead.
export const GROUP_CHAT_ID = "group";

// The longest activity text a teacher can save or a student can write.
export const ACTIVITY_MAX_LENGTH = 5000;
// The longest name a teacher can give an activity.
export const ACTIVITY_NAME_MAX_LENGTH = 100;
// The languages a teacher can pick for an activity.
export const PROGRAMMING_LANGUAGES = ["python", "c++", "javascript", "other"] as const;
export type ProgrammingLanguage = typeof PROGRAMMING_LANGUAGES[number];

// One question in an activity, with the output a correct answer must produce.
export interface ActivityQuestion {
  question: string;
  output: string;
}

// An activity a teacher made, as listed for picking. Its text is not included.
export interface ActivitySummary {
  id: string;
  name: string;
}

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
  // A private chat was opened (or sent again on join). Includes its history.
  // The room's saved activity text. Sent to everyone on join.
  "room activity": (text: string) => void;
  // A private chat was opened (or sent again on join). Includes its history
  // and the student's current activity text.
  "private chat opened": (payload: {
    chat: PrivateChat;
    messages: ChatMessage[];
    activity: string;
  }) => void;
  // A student left, so their private chat is gone. Sent with the chat id.
  "private chat closed": (chatId: string) => void;
  "private message": (message: ChatMessage) => void;
  // Teachers only: a student's activity text changed in their private chat.
  "student activity": (payload: { chatId: string; text: string }) => void;
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
  // The server confirms that execution completed, without sending output.
  "code:submit": (
    payload: { language: CodeSubmissionLanguage; code: string },
    acknowledge: (response: CodeSubmissionAck) => void
  ) => void;
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
  // Teachers only: open a private chat with a student who raised a hand.
  "open private chat": (payload: { studentId: string }) => void;
  // Teachers send to any private chat in the room. Students only to their own.
  "private message": (payload: { chatId: string; text: string }) => void;
  // Students only, while their private chat is open: their activity text.
  "activity update": (payload: { text: string }) => void;
   "code:update": (update: CodeRunUpdate) => void;
}
