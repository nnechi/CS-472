export type Role = "student" | "teacher";

// The group chat's id. Private chats use the student's socket id instead.
export const GROUP_CHAT_ID = "group";

// The longest text a teacher can write for an activity, question, or line.
export const ACTIVITY_MAX_LENGTH = 5000;
// The longest name a teacher can give an activity.
export const ACTIVITY_NAME_MAX_LENGTH = 100;
// The languages a teacher can pick for a coding activity.
export const PROGRAMMING_LANGUAGES = ["python", "c++", "javascript", "typescript", "java", "c", "other"] as const;
// Coding: students write code to match an output. Parsons: students put lines in order.
export const ACTIVITY_TYPES = ["coding", "parsons"] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];
// Most questions an activity can have.
export const ACTIVITY_MAX_QUESTIONS = 50;
// Most lines a Parsons question can have, solution and extra lines together.
export const PARSONS_MAX_LINES = 60;

// User role and message of a user, and what room they belong to.
export interface ChatMessage {
  username: string;
  role: Role;
  text: string;
  room: string;
  createdAt: string; // ISO timestamp
  chatId: string; // GROUP_CHAT_ID, or the id of a private chat
  // The sender's profile picture URL. Only signed-in teachers have one.
  avatarUrl?: string | null;
  // A student's pup avatar id (for example "corgi"). Teachers have none.
  pup?: string | null;
}

// A private chat between the room's teacher and one student. `id` is the
// student's socket id, which is how messages get routed to them.
export interface PrivateChat {
  id: string;
  studentName: string;
  teacherName: string;
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

// One question as the server sends it. What is set depends on who gets it:
// students get the question and correct output, and for Parsons the shuffled lines to arrange.
// Teachers also get the answer: the output for coding, the solution for Parsons.
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
  name: string;
  type: ActivityType;
  language: string | null;
  questions: RoomQuestion[];
}

// A student's work on each Parsons question. The teacher sees it. results is
// null until the student checks an answer, and is reset when the answer changes.
export interface AnswerProgress {
  answers: ParsonsLine[][];
  results: (boolean | null)[];
  // Which lines of each checked answer are wrong, for the teacher to see.
  // null until checked, and reset with the result when the answer changes.
  marks: (LineMark[] | null)[];
}

// The feedback for one checked question: messages and the marked lines.
export interface AnswerFeedback {
  errors: string[];
  marks: LineMark[];
}

// ---------------------------------------------------------------------------
// Student environments. Keep this block identical in client and server types.
//
// Each student has their own workspace: their work on every question, their
// last run, and what their screen looks like. The student owns it and sends it
// to the server, and a teacher watching that student renders the same
// components from it, read-only, to see exactly what the student sees.
// Everything here must survive JSON: no pixels, Monaco objects, or functions.
// ---------------------------------------------------------------------------

// Longest code a student can keep for one question.
export const STUDENT_CODE_MAX_LENGTH = 20000;
// Longest stdout or stderr kept from one run.
export const RUN_OUTPUT_MAX_LENGTH = 20000;

// One finished run of a student's code. The raw parts are kept, not the
// formatted text, so student and teacher format it the same way.
export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  finishedAt: string; // ISO timestamp
}

// How a run ended. Every run ends exactly once.
export type RunOutcome =
  | { type: "finished"; result: RunResult } // ran; check result for timeouts/compile errors
  | { type: "cancelled" } // stopped by its owner or a disconnect
  | { type: "replaced" } // still waiting when newer code was queued
  | { type: "error"; message: string }; // the runner itself failed

// A student's work on one Parsons question.
export interface ParsonsWork {
  answer: ParsonsLine[];
  // null until checked, and reset when the answer changes.
  result: boolean | null;
  // Exactly what the student was shown. null when feedback is off or unchecked.
  feedback: AnswerFeedback | null;
  // Teachers only: which lines are wrong, even when the student's feedback is off.
  marks: LineMark[] | null;
}

// A student's work on one question, whatever its type.
export interface QuestionWork {
  code: string; // coding: the editor contents
  lastRun: RunResult | null; // coding: null until the student runs it
  parsons: ParsonsWork | null; // Parsons only, null for coding questions
}

// A line and column in the editor, 1-based like Monaco's.
export interface EditorPosition {
  lineNumber: number;
  column: number;
}

// What the student's screen looks like right now. Sizes are percentages and
// scroll is in lines, so it maps onto a teacher's screen of any size.
export interface EnvironmentViewport {
  // The coding layout's three resizable groups, each panel as a percentage.
  panels: {
    outer: number[]; // question/output column | editor/output column
    left: number[]; // question | correct output
    right: number[]; // editor | student output
  } | null;
  editorTopLine: number; // first visible line in the editor, 1-based
  cursor: EditorPosition | null;
  selection: { start: EditorPosition; end: EditorPosition } | null;
  // Parsons: how far down the activity is scrolled, 0 to 1.
  activityScrollRatio: number;
}

// One student's whole workspace in a room.
export interface StudentEnvironment {
  // Stable per student across refreshes (unlike the socket id).
  studentKey: string;
  username: string;
  // The question the student is looking at.
  questionIndex: number;
  // One entry per question in the room's activity.
  questions: QuestionWork[];
  // True while a run is in progress. Only one run at a time.
  running: boolean;
  viewport: EnvironmentViewport;
  // Goes up by one on every change. Anything older than what's held is ignored.
  version: number;
}

// The viewport before the student has scrolled, moved, or resized anything.
export const EMPTY_VIEWPORT: EnvironmentViewport = {
  panels: null,
  editorTopLine: 1,
  cursor: null,
  selection: null,
  activityScrollRatio: 0,
};

// A fresh environment for a student joining a room with this activity.
export function emptyStudentEnvironment(
  studentKey: string,
  username: string,
  activityType: ActivityType | null,
  questionCount: number,
): StudentEnvironment {
  const count = Math.max(0, Math.min(questionCount, ACTIVITY_MAX_QUESTIONS));
  return {
    studentKey,
    username,
    questionIndex: 0,
    questions: Array.from({ length: count }, () => ({
      code: "",
      lastRun: null,
      parsons: activityType === "parsons"
        ? { answer: [], result: null, feedback: null, marks: null }
        : null,
    })),
    running: false,
    viewport: { ...EMPTY_VIEWPORT },
    version: 0,
  };
}

// A student's work on a coding activity: the code they wrote for each question,
// and the output of their last Run of it (null if not run, or the code changed since).
export interface CodingProgress {
  codes: string[];
  outputs: (string | null)[];
}

// What the teacher sees of one student's work. The type says which kind of activity it is for.
export type StudentProgress =
  | ({ type: "parsons" } & AnswerProgress)
  | ({ type: "coding" } & CodingProgress);

//raise hand uses id not username incase multiple people pick the same username.
export interface RaisedHand {
  id: string;
  username: string;
  raisedAt: string; // ISO timestamp
}

// A student currently connected to the room. id is their socket id, same as
// RaisedHand -- a student can appear here whether or not they've raised a hand.
export interface RosterStudent {
  id: string;
  username: string;
}

// The room's countdown timer. remainingMs is the time left right now, and
// running means it is counting down.
export interface TimerState {
  durationMs: number; // the length the teacher chose, what Restart returns to
  remainingMs: number;
  running: boolean;
}

// A student who joined a room, as saved when the room ended.
export interface PastStudent {
  id: string; // the student's socket id during the room
  username: string;
  pup: string | null;
  joinedAt: string; // ISO timestamp
  hasPrivateChat: boolean; // the teacher opened a private chat with them
  progress: StudentProgress | null; // null if they never worked on the activity
  privateMessages: ChatMessage[];
}

// A room the teacher ran that has ended. Listed under Previous activities.
export interface PastRoomSummary {
  code: string;
  activityName: string | null;
  activityType: ActivityType | null;
  startedAt: string; // ISO timestamp, when the teacher opened the room
  endedAt: string; // ISO timestamp
  studentCount: number;
}

// Everything saved about one ended room, for the teacher's read-only view.
export interface PastRoomDetail {
  code: string;
  activityName: string | null;
  activity: RoomActivity | null; // the teacher's view of the activity, answers included
  startedAt: string;
  endedAt: string;
  students: PastStudent[];
  messages: ChatMessage[]; // the group chat, oldest first
}

// What the client is allowed to send to the server.
export interface ClientToServerEvents {
  // Sent once, right after connecting.
  // Students send the studentKey they were given last time in this room, if any.
  join: (payload: { username: string; role: Role; room: string; pup?: string; studentKey?: string }) => void;
  // Run this question's code. Queued; results come back as "run ..." events.
  "run code": (payload: { questionIndex: number; code: string }) => void;
  // Stop your own queued or running code.
  "cancel run": () => void;
  // Students only: change their pup avatar. Later messages use the new pup.
  "set pup": (payload: { pup: string }) => void;
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
  // Teachers only: pick the question everyone in the room is on.
  "set question": (payload: { questionIndex: number }) => void;
  // Teachers only: open a private chat with a student who raised a hand.
  "open private chat": (payload: { studentId: string }) => void;
  // Teachers send to any private chat in the room. Students only to their own.
  "private message": (payload: { chatId: string; text: string }) => void;
  // Students only: their arrangement of each Parsons question. Sent as it changes.
  "activity update": (payload: { answers: ParsonsLine[][] }) => void;
  // Students only: check one Parsons question's arrangement against the solution.
  "check answer": (payload: { questionIndex: number; lines: ParsonsLine[] }) => void;
  // Students only: their code and last Run output for each coding question. Sent as it changes.
  "code update": (payload: { codes: string[]; outputs: (string | null)[] }) => void;
}

export interface Participant  { 
  id : string; 
  username : string; 
}
// What the server sends back to clients.
export interface ServerToClientEvents {
  "chat message": (message: ChatMessage) => void;
  "chat history": (messages: ChatMessage[]) => void;
  // The room's activity, sent on join. Null when the teacher picked none.
  "room activity": (activity: RoomActivity | null) => void;
  // The question the teacher picked, sent on join and on every change.
  "current question": (questionIndex: number) => void;
  // A private chat was opened (or sent again on join). Includes its history.
  // A student's progress comes in "student activity", not here.
  "private chat opened": (payload: { chat: PrivateChat; messages: ChatMessage[] }) => void;
  // A student left, so their private chat is gone. Sent with the chat id.
  "private chat closed": (chatId: string) => void;
  "private message": (message: ChatMessage) => void;
  // Teachers only: a student's work changed. Sent for every student who has
  // progress when a teacher joins, and again on each change.
  "student activity": (payload: { studentId: string; progress: StudentProgress }) => void;
  // Students only: whether their checked answer is right, and the feedback
  // (messages and marked lines) when the teacher turned feedback on.
  "answer result": (payload: {
    questionIndex: number;
    correct: boolean;
    errors: string[];
    marks: LineMark[];
  }) => void;
  //TODO not implement yet, for users joining or leaving, sever messages, maintenance, etc.
  "system message": (text: string) => void;
  // Raised hands in the room, oldest first.
  "hand queue": (queue: RaisedHand[]) => void;
  // Teachers only: how many students are in the room right now.
  "student count": (count: number) => void;
  // Teachers only: everyone currently connected to the room, sent on join
  // and whenever a student joins or leaves.
  "room roster": (roster: RosterStudent[]) => void;
  // Sent to a student when their own hand goes up or down.
  "hand status": (raised: boolean) => void;
  // The room's timer, sent on join and on every play/pause.
  "timer state": (timer: TimerState) => void;
  "room closed" : () => void;
  "join error" : () => void;


  "participants" : (participants : Participant[]) => void; 
  "room waiting" : () => void; 
  "room opened" : () => void;
  // Students only: the key their environment is kept under in this room.
  // Saved by the client and sent back with "join" so a refresh keeps their work.
  "student key": (studentKey: string) => void;
  // Your run is waiting. Sent again whenever its place changes (1 = next).
  "run queued": (payload: { jobId: string; questionIndex: number; position: number }) => void;
  "run started": (payload: { jobId: string; questionIndex: number }) => void;
  // Output as the program produces it.
  "run output": (payload: { jobId: string; stream: "stdout" | "stderr"; chunk: string }) => void;
  "run finished": (payload: { jobId: string; questionIndex: number; outcome: RunOutcome }) => void;
  // The run wasn't queued, with a message to show the student.
  "run rejected": (payload: { questionIndex: number; reason: string }) => void;

}

//Incase we set up server-to-server events
export interface InterServerEvents {}

// Each socket needs this info
export interface SocketData {
  username: string;
  role: Role;
  room: string;
  // A signed-in teacher's Google picture, from their login session.
  avatarUrl: string | null;
  waiting : boolean; 
  pup: string | null;
  // Students only: the key of their environment in this room.
  studentKey: string | null;
}
