// Keep this in sync with the server's src/types.ts.
export type Role = "student" | "teacher";

// Everything the chat needs to know about the current user. Built from the
// signed-in user (AuthProvider) plus the room code from the URL.
export interface Session {
  username: string;
  role: Role;
  room: string;
}

// The group chat's id. Private chats use the student's socket id instead.
export const GROUP_CHAT_ID = "group";

// The longest text a teacher can write for an activity, question, or line.
export const ACTIVITY_MAX_LENGTH = 5000;
// The longest name a teacher can give an activity.
export const ACTIVITY_NAME_MAX_LENGTH = 100;
// The languages a teacher can pick for a coding activity.
export const PROGRAMMING_LANGUAGES = ["python", "c++", "javascript", "other"] as const;
export type ProgrammingLanguage = typeof PROGRAMMING_LANGUAGES[number];
// Coding: students write code to match an output. Parsons: students put lines in order.
export const ACTIVITY_TYPES = ["coding", "parsons"] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];
// Most questions an activity can have, and most lines a Parsons question can have.
export const ACTIVITY_MAX_QUESTIONS = 50;
export const PARSONS_MAX_LINES = 60;

// The settings a teacher sets for a Parsons problem, with the generator's names
// and defaults.
export interface ParsonsSettings {
  maxWrongLines: number; // Max Distractors: extra lines a student is given
  requireDragging: boolean; // Require dragging: extra lines start in a trash area
  canIndent: boolean; // Indentation is on unless disabled
  xIndent: number; // Indent Size in pixels
  showFeedback: boolean; // Show feedback
  execLimit: number; // Execution limit in milliseconds (graders that run code)
}

export const DEFAULT_PARSONS_SETTINGS: ParsonsSettings = {
  maxWrongLines: 10,
  requireDragging: false,
  canIndent: true,
  xIndent: 50,
  showFeedback: true,
  execLimit: 2500,
};

// One question as the teacher writes it in the editor. Coding uses output.
// Parsons uses the code, the extra lines (one per row), and its settings.
export interface ActivityQuestion {
  question: string;
  output: string;
  code: string;
  distractors: string;
  settings: ParsonsSettings;
}

// An activity a teacher made, as listed for picking. Its text is not included.
export interface ActivitySummary {
  id: string;
  name: string;
  type: ActivityType;
}

// One line of a Parsons problem: its text (trimmed) and indentation level.
export interface ParsonsLine {
  code: string;
  indent: number;
}

// Where a student's line is wrong: its place in the order, or its indentation.
export interface LineMark {
  index: number; // the line's position in the student's answer
  kind: "position" | "indent";
}

// The Parsons options a student's widget needs. Set by the teacher.
export interface ParsonsDisplayOptions {
  requireDragging: boolean;
  canIndent: boolean;
  xIndent: number;
  showFeedback: boolean;
}

// One question as the server sends it. Students get the question, and for
// Parsons the shuffled lines and display options. Teachers also get the answer.
export interface RoomQuestion {
  question: string;
  lines?: string[]; // Parsons, students: the lines to arrange, shuffled
  options?: ParsonsDisplayOptions; // Parsons
  solution?: ParsonsLine[]; // Parsons, teachers: the lines in the right order
  distractors?: string[]; // Parsons, teachers: the extra lines that aren't in the answer
  output?: string; // coding, teachers: the output a correct answer produces
}

// The room's activity, with the questions shaped for the person receiving it.
export interface RoomActivity {
  type: ActivityType;
  questions: RoomQuestion[];
}

// A student's work on each Parsons question. results is null until the student
// checks that question, and is reset when its answer changes.
export interface AnswerProgress {
  answers: ParsonsLine[][];
  results: (boolean | null)[];
  // Which lines of each checked answer are wrong, for the teacher to see.
  marks: (LineMark[] | null)[];
}

// The feedback for one checked question: messages and the marked lines.
export interface AnswerFeedback {
  errors: string[];
  marks: LineMark[];
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
  // The room's activity, sent on join. Null when the teacher picked none.
  "room activity": (activity: RoomActivity | null) => void;
  // A private chat was opened (or sent again on join). Includes its history
  // and the student's progress on the activity.
  "private chat opened": (payload: {
    chat: PrivateChat;
    messages: ChatMessage[];
    progress: AnswerProgress;
  }) => void;
  // A student left, so their private chat is gone. Sent with the chat id.
  "private chat closed": (chatId: string) => void;
  "private message": (message: ChatMessage) => void;
  // Teachers only: a student's progress changed in their private chat.
  "student activity": (payload: { chatId: string; progress: AnswerProgress }) => void;
  // Students only: whether their checked answer is right.
  "answer result": (payload: {
    questionIndex: number;
    correct: boolean;
    errors: string[];
    marks: LineMark[];
  }) => void;
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
  // Teachers only: open a private chat with a student who raised a hand.
  "open private chat": (payload: { studentId: string }) => void;
  // Teachers send to any private chat in the room. Students only to their own.
  "private message": (payload: { chatId: string; text: string }) => void;
  // Students only, while their private chat is open: their arrangement of each Parsons question.
  "activity update": (payload: { answers: ParsonsLine[][] }) => void;
  // Students only: check one Parsons question's arrangement against the solution.
  "check answer": (payload: { questionIndex: number; lines: ParsonsLine[] }) => void;
}
