import type { PupId } from "../components/chat/PupAvatar";
import type {
  AnswerFeedback,
  ChatMessage,
  ParsonsLine,
  PrivateChat,
  RaisedHand,
  Role,
  RoomActivity,
  RosterStudent,
  RunOutcome,
  StudentProgress,
  TimerState,
} from "../types";

// A person's current code run. Events for any other job are ignored, so a
// replaced or stale run can't overwrite the newest one.
export interface RunState {
  jobId: string | null;
  questionIndex: number | null;
  status: "idle" | "queued" | "running";
  position: number | null; // place in line while queued, 1 = next
  output: string; // streamed while running, then the final output
  outcome: RunOutcome | null; // how the last run ended
  error: string | null; // why a run was rejected
}

// Everything a room screen renders and the actions it can call. A live room
// (useRoomSocket) and a saved room (usePastRoom) both return this, so the same
// components show either one. In a saved room the actions that would talk to
// the server do nothing, and the UI hides them.
export interface RoomView {
  // Messages for each chat, keyed by chat id (GROUP_CHAT_ID or a student's id).
  messages: Record<string, ChatMessage[]>;
  privateChats: PrivateChat[];
  activeChatId: string;
  // New messages in chats that are not on screen, keyed by chat id.
  unread: Record<string, number>;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  role: Role;
  roomCode: string;
  // Students: their pup avatar, and how to change it.
  pup: PupId;
  setPup: (next: PupId) => void;
  // Teachers: the raised hands, how many students are in, and who they are.
  handQueue: RaisedHand[];
  studentCount: number;
  roster: RosterStudent[];
  // Students: whether their own hand is up.
  handRaised: boolean;
  // Students: joined before the teacher opened the room, so they wait in the lobby.
  waiting: boolean;
  timer: TimerState;
  activity: RoomActivity | null;
  currentQuestion: number;
  // Live: moves everyone in the room to the question. Saved: only this screen.
  selectQuestion: (questionIndex: number) => void;
  // Students, Parsons: their arrangement, results and feedback for each question.
  studentAnswers: ParsonsLine[][];
  studentResults: (boolean | null)[];
  studentFeedback: (AnswerFeedback | null)[];
  setStudentAnswer: (questionIndex: number, lines: ParsonsLine[]) => void;
  checkAnswer: (questionIndex: number) => void;
  resetProblem: (questionIndex: number) => void;
  // Coding: this person's code for each question, the output of each one's last
  // finished run, and their current run on the server. Students and teachers alike.
  code: string[];
  codeOutputs: (string | null)[];
  setCode: (questionIndex: number, code: string) => void;
  run: RunState;
  runCode: (questionIndex: number, code: string) => void;
  cancelRun: () => void;
  // Teachers: one student's work, or null when they have not started.
  studentProgress: (studentId: string) => StudentProgress | null;
  editStudentCode?: (studentId: string, questionIndex: number, code: string) => void;
  codeEditError?: (studentId: string | null, questionIndex: number) => string | undefined;
  selectChat: (chatId: string) => void;
  sendMessage: (chatId: string, text: string) => void;
  openPrivateChat: (studentId: string) => void;
  raiseHand: () => void;
  lowerHand: (id: string) => void;
  // False for a live room, true for a saved (ended) room, which is read-only.
  ended: boolean;
}

// The old name, so existing imports keep working.
export type RoomSocket = RoomView;
