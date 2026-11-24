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
export const PROGRAMMING_LANGUAGES = ["python", "c++", "javascript", "typescript", "java", "c", "other"] as const;
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

// An activity a teacher made, as listed for picking. Only each question's text is included, never its answer.
export interface ActivitySummary {
  id: string;
  name: string;
  type: ActivityType;
  language: ProgrammingLanguage | null; // only set for coding activities
  questionCount: number;
  questions: string[]; // each question's text, for the dashboard's hover preview
  createdAt: string; // ISO timestamp
}

// One line of a Parsons problem: its text (trimmed) and indentation level.
export interface ParsonsLine {
  code: string;
  indent: number;
}

// One question of an activity with its answer, as only the activity's teacher sees it.
export interface ActivityDetailQuestion {
  question: string;
  output?: string; // coding: the output a correct answer produces
  code?: string; // parsons: the solution code as the teacher typed it, one line per row, indentation kept
  distractors?: string; // parsons: the extra lines that aren't in the answer, one per row
  options?: Partial<ParsonsSettings>; // parsons: the question's settings; missing ones use the defaults
}

// A whole activity with its answers, from GET /api/activities/:activityId. Teacher-only.
export interface ActivityDetail {
  id: string;
  name: string;
  type: ActivityType;
  language: ProgrammingLanguage | null;
  createdAt: string; // ISO timestamp
  questions: ActivityDetailQuestion[];
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
  options: ParsonsDisplayOptions; // Parsons
  solution?: ParsonsLine[]; // Parsons, teachers: the lines in the right order
  distractors?: string[]; // Parsons, teachers: the extra lines that aren't in the answer
  output?: string; // coding, students and teachers: the output a correct answer produces
}

// The room's activity, with the questions shaped for the person receiving it.
export interface RoomActivity {
  name: string;
  type: ActivityType;
  language: string | null;
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
// student's id in the room (see RosterStudent), so the chat survives the
// student reconnecting.
export interface PrivateChat {
  id: string;
  studentName: string;
  teacherName: string;
}

// A student waiting for help. `id` is the student's id in the room.
export interface RaisedHand {
  id: string;
  username: string;
  raisedAt: string; // ISO timestamp
}

// A student in the room. `id` is their id in the room: it stays the same when
// they reconnect, refresh, or come back after closing the tab, so their hand,
// private chat and work stay theirs. Students who left on purpose aren't listed.
export interface RosterStudent {
  id: string;
  username: string;
  // Live rooms: false while the student is away (lost their connection or
  // closed the tab). They can come back to the same seat. Unset in saved rooms.
  connected?: boolean;
}

// A returning student's Parsons work, as the server kept it: their arrangement
// of each question, whether each checked one was right, and the feedback they
// were shown (null for questions not checked since they last changed).
export interface SavedParsonsWork {
  answers: ParsonsLine[][];
  results: (boolean | null)[];
  feedback: (AnswerFeedback | null)[];
}

// One of the teacher's rooms that is still running, for the dashboard.
export interface ActiveRoomSummary {
  code: string;
  activityName: string | null;
  activityType: ActivityType | null;
  startedAt: string | null; // ISO timestamp, when the teacher opened the room
  expiresAt: string; // ISO timestamp, when the room stops letting new students in
  expired: boolean; // past expiresAt: only people already in it can come back
  studentCount: number; // students connected right now
  awayCount: number; // students who lost their connection and can come back
  teacherConnected: boolean; // the room is open in one of the teacher's tabs
  // When the room will close on its own (saving everyone's work) unless the
  // teacher comes back: they've been out of it a while, or it's past its hour
  // with nobody in it. Null while it isn't going to.
  closesAt: string | null;
}

// Why a room closed: its teacher ended it, it closed itself after the teacher
// was away too long, or it ran out its time with nobody in it.
export type RoomClosedReason = "ended" | "teacher-away" | "expired";

// The room's countdown timer. remainingMs is the time left right now, and
// running means it is counting down.
export interface TimerState {
  durationMs: number; // the length the teacher chose, what Restart returns to
  remainingMs: number;
  running: boolean;
  // Whether students can see the timer. Teachers always see it.
  visibleToStudents: boolean;
}

export interface Participant { 
  id : string; 
  username : string; 
}

// A student who joined a room, as saved when the room ended.
export interface PastStudent {
  id: string; // the student's id during the room
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

// One ended room, as the dashboard stats need it. Kept apart from PastRoomSummary
// so these stats do not depend on previous activities still existing.
export interface RoomStatSummary {
  code: string;
  activityName: string | null;
  startedAt: string; // ISO timestamp
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

// Teacher notes. Private: only the teacher who wrote a note can read or change
// it, and notes are never sent over the room's socket, which students share.
export const NOTE_MAX_LENGTH = 20000;

// A note belongs to one of a teacher's activities, or to one of their rooms
// (by room code, from setting it up through to Previous activities).
export type NoteKind = "activity" | "room";

// One note's text. Empty text with a null updatedAt means there's no note yet.
export interface NoteText {
  text: string;
  updatedAt: string | null; // ISO timestamp
}

// An activity's note, with the activity's name to show next to it.
export interface ActivityNote extends NoteText {
  activityId: string;
  activityName: string;
}

// A room's notes: its own, and the note on the activity it uses (if it has one).
export interface RoomNotes {
  room: NoteText;
  activity: ActivityNote | null;
}

// One note in the list on the Notes page.
export interface NoteSummary {
  kind: NoteKind;
  targetId: string; // the activity's id, or the room's code
  text: string;
  updatedAt: string; // ISO timestamp
  activityName: string | null; // the activity, or the activity the room used
  // Rooms only: "previous" once it has ended, "current" while it's set up or live.
  roomStatus: "previous" | "current" | null;
  endedAt: string | null; // previous rooms only, ISO timestamp
}

export interface ServerToClientEvents {
  "chat message": (message: ChatMessage) => void;
  "chat history": (messages: ChatMessage[]) => void;
  "system message": (text: string) => void;
  // The room's activity, sent on join. Null when the teacher picked none.
  "room activity": (activity: RoomActivity | null) => void;
  // The question the teacher picked, sent on join and on every change.
  "current question": (questionIndex: number) => void;
  // A private chat was opened (or sent again on join). Includes its history.
  // A student's progress comes in "student activity", not here. restored is
  // set when a returning student gets their chat back, rather than the
  // teacher opening it just now.
  "private chat opened": (payload: { chat: PrivateChat; messages: ChatMessage[]; restored?: boolean }) => void;
  // A student left on purpose, so their private chat is gone. Sent with the chat id.
  "private chat closed": (chatId: string) => void;
  "private message": (message: ChatMessage) => void;
  // Teachers only: a student's work changed. Sent for every student who has
  // progress when a teacher joins, and again on each change. A coding student
  // gets their own too; when they join it also carries, for each question,
  // the latest text of theirs the server took in (so a rejoining student
  // sends only the rest of their typing).
  "student activity": (
    payload: { studentId: string; progress: StudentProgress },
    studentTexts?: (string | null)[]
  ) => void;
  // Students only: whether their checked answer is right.
  "answer result": (payload: {
    questionIndex: number;
    correct: boolean;
    errors: string[];
    marks: LineMark[];
  }) => void;
  // Raised hands in the room, oldest first.
  "hand queue": (queue: RaisedHand[]) => void;
  // Teachers only: how many students are in the room right now.
  "student count": (count: number) => void;
  // Teachers only: everyone currently connected to the room, sent on join
  // and whenever a student joins or leaves.
  "room roster": (roster: RosterStudent[]) => void;
  // Sent to a student when their own hand goes up or down.
  "hand status": (raised: boolean) => void;
  // The room's timer, sent to teachers on join and on every play/pause.
  "timer state": (timer: TimerState) => void;
  // The room ended, and everyone's work was saved for the teacher.
  "room closed" : (reason?: RoomClosedReason) => void;
  // The join was refused. "ended" when the room existed but has ended since.
  "join error" : (reason?: "ended") =>  void;
  "participants" : (participants : Participant[]) => void; 
  "room waiting" : () => void; 
  "room opened" : () => void; 
  // Students only: the key their seat is kept under in this room. Saved by the
  // client and sent back with "join", so a dropped connection, a refresh, or
  // rejoining with the same name keeps their work. seat.returning is true when
  // they got an existing seat back; seat.sameTab when this tab held it last,
  // so this tab's copy of their work is the newest.
  "student key": (studentKey: string, seat: { returning: boolean; sameTab: boolean }) => void;
  // Students only, Parsons: their saved work, sent right after "room activity"
  // when they join a seat that has some.
  "saved work": (work: SavedParsonsWork) => void;
  // Students only: true when the teacher has been out of the room for a
  // little while (closed their tab or lost their connection), false when
  // they're back. closesAt (ISO) is when the room will close itself, saving
  // everyone's work, if the teacher doesn't come back by then.
  "teacher away": (away: boolean, closesAt?: string | null) => void;
  // Students only: this seat was opened in another tab or window, which now
  // has it. This socket is disconnected right after.
  "session replaced": () => void;
}

export interface ClientToServerEvents {
  // Students send the studentKey they were given last time in this room, if
  // any; tabId, random per page load, so the server can tell this tab from
  // another tab of the same student; and resume, true when this is the
  // socket reconnecting on its own (not a page load or "Use this tab").
  join: (payload: {
    username: string;
    role: Role;
    room: string;
    pup?: string;
    studentKey?: string;
    tabId?: string;
    resume?: boolean;
  }) => void;
  // Share browser output for the student's current code. This is not a trusted grade.
  "browser run result": (payload: { questionIndex: number; code: string; result: RunResult }) => void;
  // Students only: change their pup avatar. Later messages use the new pup.
  "set pup": (payload: { pup: string }) => void;
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
  // Teachers only: show or hide the timer for students.
  "timer visibility": (payload: { visible: boolean }) => void;
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
  "edit student code": (
    payload: { studentId: string | null; questionIndex: number; before: string; code: string },
    acknowledge: (error: string | null) => void
  ) => void;
  // Students only: the Leave button. Their seat is given up: their work stays
  // with the teacher (and in the saved room), but joining again starts a new
  // seat. Acknowledged, so the client can disconnect after it arrives.
  "leave room": (acknowledge?: () => void) => void;
}
