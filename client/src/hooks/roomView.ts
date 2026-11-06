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
  StudentProgress,
  TimerState,
} from "../types";

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
  // Students, coding: their code and last Run output for each question.
  studentCodes: string[];
  studentOutputs: (string | null)[];
  setStudentCode: (questionIndex: number, code: string) => void;
  setStudentOutput: (questionIndex: number, output: string | null) => void;
  // Teachers: one student's work, or null when they have not started.
  studentProgress: (studentId: string) => StudentProgress | null;
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
