import { startBrowserRun, type BrowserRun } from "../runner/browserRunner";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_TIMER_MS } from "../components/Timer";
import { socket } from "../socket";
import { PupId, loadPupId, savePupId } from "../components/chat/PupAvatar";
import { forgetStudentKey, loadStudentKey, saveStudentKey } from "../utils/studentKey";
import { replayFrom } from "../utils/codeResync";
import type { RoomView, RunState } from "./roomView";
import {
  AnswerFeedback,
  ChatMessage,
  GROUP_CHAT_ID,
  ParsonsLine,
  PrivateChat,
  RaisedHand,
  RosterStudent,
  RoomActivity,
  RoomClosedReason,
  RoomQuestion,
  RunOutcome,
  SavedParsonsWork,
  Session,
  StudentProgress,
  TimerState,
} from "../types";

interface RoomSocketOptions {
  // The room ended (with why, when the server says).
  onRoomClosed?: (reason?: RoomClosedReason) => void;
  // The join was refused; "ended" when the room has ended since.
  onJoinError?: (reason?: "ended") => void;
  startWaiting?: boolean;
}

// How long a student's Parsons arrangement waits before it is sent to the teacher.
const PROGRESS_SYNC_DELAY_MS = 300;
// How long a code edit waits for the server to confirm it.
const EDIT_TIMEOUT_MS = 5000;
// How long Leave waits for the server to confirm before going anyway, and how
// long it first waits for a page that is reconnecting to get back in.
const LEAVE_TIMEOUT_MS = 1500;
const LEAVE_REJOIN_WAIT_MS = 3000;

export type { RunState } from "./roomView";

const IDLE_RUN: RunState = {
  jobId: null,
  questionIndex: null,
  status: "idle",
  output: "",
  outcome: null,
  error: null,
};

// This page's id, sent with every join so the server can tell this tab from
// another tab of the same student. New on every page load and held only in
// memory: a duplicated tab copies sessionStorage, but not this.
const TAB_ID = makeTabId();
function makeTabId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // randomUUID needs a secure page (https or localhost); fall back below.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// How a (re)join treats the work this page already has. Decided when the
// room's activity arrives:
// - "adopt": the server's copy wins. A fresh page, or another tab used the
//   seat since this one did.
// - "continue": this tab held the seat last, so its copy is the newest. It's
//   sent again, since anything done while offline never reached the server.
// - "reupload": the server no longer had the seat (it restarted, say), but the
//   activity is the same, so this page's work is sent to the new seat.
type RestoreMode = "adopt" | "continue" | "reupload";

// An edit run on one question's code: the latest text, how many edits are
// waiting for the server's answer, the shared code the run started from, and
// every text sent since. A student's run that is still here with nothing
// waiting never got its answer (the connection dropped); it's sent again on
// rejoin (see resyncCode).
interface PendingEdit {
  code: string;
  count: number;
  base: string;
  sent: Set<string>;
}

// The text shown for a finished run: stdout, then stderr under a label.
function formatRunOutput(outcome: RunOutcome, streamed: string): string {
  if (outcome.type !== "finished") return streamed;
  const { stdout, stderr } = outcome.result;
  return `${stdout}${stderr ? "\n[stderr]\n" + stderr : ""}`;
}

// Fisher-Yates shuffle, for reshuffling a Parsons problem's lines.
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Where a student's answer starts. With dragging required, the lines start in
// the trash area, so the answer is empty. Otherwise every line starts in the
// answer, all at indent 0.
function startingAnswer(question: RoomQuestion): ParsonsLine[] {
  if (question.options?.requireDragging ?? true) return [];
  return shuffle(question.lines ?? []).map((code) => ({ code, indent: 0 }));
}

// Whether a saved answer fits the lines this student has: each of its lines
// is one of theirs, and with dragging off it uses all of them (there's
// nowhere else for a line to be).
function fitsLines(answer: ParsonsLine[], question: RoomQuestion): boolean {
  const left = [...(question.lines ?? [])];
  for (const line of answer) {
    const at = left.indexOf(line?.code);
    if (at === -1) return false;
    left.splice(at, 1);
  }
  return (question.options?.requireDragging ?? true) || left.length === 0;
}

// Everything the room screen needs from the server: the group chat, private
// chats, raised hands, the timer, and the activity. The components only render
// this and call the actions it returns.
export function useRoomSocket(
  session: Session,
  { startWaiting = false, onRoomClosed, onJoinError }: RoomSocketOptions
): RoomView {
  const isStudent = session.role === "student";
  // Messages for each chat, keyed by chat id (GROUP_CHAT_ID or a student's id).
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  const [activeChatId, setActiveChatId] = useState(GROUP_CHAT_ID);
  // New messages in chats that are not on screen, keyed by chat id.
  const [unread, setUnread] = useState<Record<string, number>>({});
  // Teachers get the room's queue; students only learn their own status.
  const [handQueue, setHandQueue] = useState<RaisedHand[]>([]);
  // Teachers only: how many students are in the room right now.
  const [studentCount, setStudentCount] = useState(0);
  const [handRaised, setHandRaised] = useState(false);
  const [waiting, setWaiting] = useState(startWaiting);
  // Teachers only: everyone in the room, connected or away.
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  // Shared countdown. The server sends it on join and on every play/pause.
  const [timer, setTimer] = useState<TimerState>({
    durationMs: DEFAULT_TIMER_MS,
    remainingMs: DEFAULT_TIMER_MS,
    running: false,
    visibleToStudents: true,
  });
  // The room's activity, questions shaped for this person's role.
  const [activity, setActivity] = useState<RoomActivity | null>(null);
  // The question the teacher picked. The server sends it on join and on every change.
  const [currentQuestion, setCurrentQuestion] = useState(0);
  // A student's own arrangement of each Parsons question, whether each is right,
  // and the feedback for each (null until checked, or when feedback is off).
  const [studentAnswers, setStudentAnswers] = useState<ParsonsLine[][]>([]);
  const [studentResults, setStudentResults] = useState<(boolean | null)[]>([]);
  const [studentFeedback, setStudentFeedback] = useState<(AnswerFeedback | null)[]>([]);
  // Teachers only: each student's progress, keyed by that student's id.
  const [studentProgress, setStudentProgress] = useState<Record<string, StudentProgress>>({});
  // This person's code for each coding question, kept when the question
  // changes, and their latest browser run.
  const [code, setCode] = useState<string[]>([]);
  const [run, setRun] = useState<RunState>(IDLE_RUN);
  // The output of the last finished run of each question.
  const [codeOutputs, setCodeOutputs] = useState<(string | null)[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string | undefined>>({});
  // In the room (true once the server has let this connection in), offline
  // and trying to get back, taken over by another tab, and the teacher's presence.
  const [joined, setJoined] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const [teacherAway, setTeacherAway] = useState(false);
  const [roomClosesAt, setRoomClosesAt] = useState<string | null>(null);
  const pendingEdits = useRef(new Map<string, PendingEdit>());
  const runSource = useRef("");
  const browserRun = useRef<BrowserRun | null>(null);
  // Students: whether they changed their work since the activity loaded. Until
  // then nothing is sent, so the teacher sees "no work yet".
  const touchedRef = useRef(false);
  // Students: their work came from the server's saved copy since the activity loaded.
  const restoredRef = useRef(false);
  // Students: work waiting out the sync delay, not sent yet. Sent right away if
  // the student leaves or the socket disconnects first. Edits made in the last
  // 300 ms before the teacher ends the room cannot be saved, because the server
  // has already closed the room by the time they are sent.
  const pendingAnswersRef = useRef<{ answers: ParsonsLine[][] } | null>(null);
  // The JSON of the last activity received. After a reconnect the server sends
  // the activity again; if it is the same one, the student's work may be kept
  // (see RestoreMode).
  const lastActivityJsonRef = useRef<string | null>(null);
  // Students: the key of their seat (sent with every join), and what the
  // server said about the seat on the last join.
  const studentKeyRef = useRef<string | undefined>(undefined);
  const seatRef = useRef<{ returning: boolean; sameTab: boolean } | null>(null);
  const restoreModeRef = useRef<RestoreMode>("adopt");
  // Coding students: the server's code arrives right after the activity on
  // each join; this page's unsent code is sent once it has.
  const resyncCodeRef = useRef(false);
  // Whether this hook's socket has connected before: later connects are it
  // reconnecting on its own. "Use this tab" is a fresh claim instead.
  const connectedBeforeRef = useRef(false);
  const reclaimingRef = useRef(false);
  const joinedRef = useRef(false);
  // The latest values, for socket listeners, which don't see new renders.
  const activityRef = useRef<RoomActivity | null>(null);
  const studentAnswersRef = useRef<ParsonsLine[][]>([]);
  const visibleCodeRef = useRef<string[]>([]);
  // The code the server last sent this student, kept as soon as it arrives.
  const serverCodeRef = useRef<string[]>([]);
  // Private chats this page has shown, and when each one's latest message was.
  const knownChatsRef = useRef(new Set<string>());
  const lastMessageAtRef = useRef<Record<string, string>>({});

  // Whether the floating chat window is open. Closed, every new message is unread.
  const [chatOpen, setChatOpenState] = useState(false);
  // A student's pup avatar: saved on this browser, random on a first visit.
  const [pup, setPupState] = useState<PupId>(() => loadPupId());

  // Socket listeners run outside render, so they read the latest values here.
  const activeChatRef = useRef(GROUP_CHAT_ID);
  const chatOpenRef = useRef(false);
  const pupRef = useRef(pup);
  const onRoomClosedRef = useRef(onRoomClosed);
  onRoomClosedRef.current = onRoomClosed;
  const onJoinErrorRef = useRef(onJoinError);
  onJoinErrorRef.current = onJoinError;

  useEffect(() => {
    studentAnswersRef.current = studentAnswers;
  }, [studentAnswers]);

  // Show a chat and clear its unread count.
  const selectChat = (chatId: string) => {
    activeChatRef.current = chatId;
    setActiveChatId(chatId);
    setUnread((prev) => ({ ...prev, [chatId]: 0 }));
  };

  // Open or close the chat window. Opening it marks the chat on screen as read.
  const setChatOpen = (open: boolean) => {
    chatOpenRef.current = open;
    setChatOpenState(open);
    if (open) setUnread((prev) => ({ ...prev, [activeChatRef.current]: 0 }));
  };

  // Add a message to its chat. It counts as unread if that chat is not on
  // screen, or if the chat window is closed.
  const addMessage = (message: ChatMessage) => {
    lastMessageAtRef.current[message.chatId] = message.createdAt;
    setMessages((prev) => ({
      ...prev,
      [message.chatId]: [...(prev[message.chatId] ?? []), message],
    }));
    if (message.chatId !== activeChatRef.current || !chatOpenRef.current) {
      setUnread((prev) => ({ ...prev, [message.chatId]: (prev[message.chatId] ?? 0) + 1 }));
    }
  };

  const editKey = (studentId: string | null, index: number) => `${studentId ?? ""}:${index}`;

  // Drops a question's draft, so the server's code shows again.
  const dropDraft = (key: string) =>
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // Sends one code edit and tracks the server's answer. An error from the
  // server (like an edit that clashes with the teacher's) is shown, and the
  // draft dropped once nothing else is waiting. No answer at all (the
  // connection dropped) keeps a student's draft, to send again on rejoin.
  const sendEdit = (studentId: string | null, questionIndex: number, pending: PendingEdit, before: string, next: string) => {
    const key = editKey(studentId, questionIndex);
    pending.count++;
    pending.sent.add(next);
    socket.timeout(EDIT_TIMEOUT_MS).emit("edit student code", { studentId, questionIndex, before, code: next }, (timeout, error) => {
      if (pendingEdits.current.get(key) !== pending) return;
      pending.count--;
      if (error) {
        setEditErrors((prev) => ({ ...prev, [key]: error }));
      } else if (timeout && studentId !== null) {
        setEditErrors((prev) => ({ ...prev, [key]: "The room didn't confirm this edit. Check the shared code and try again." }));
      }
      if (pending.count > 0) return;
      // No answer, and the server doesn't show this text yet: kept, to send
      // again on rejoin (or dropped once the server's code arrives on a live
      // connection, see onStudentProgress).
      if (timeout && studentId === null && serverCodeRef.current[questionIndex] !== pending.code) return;
      pendingEdits.current.delete(key);
      dropDraft(key);
    });
  };

  // After a student (re)joins a coding room: bring the server up to date with
  // code this page has that it may not (typed while offline, or edits whose
  // answer never came), or give it up if the server's copy wins. A run of
  // edits the server partly got continues from the last of its texts the
  // server took in (studentTexts), on top of any change the teacher made since.
  const resyncCode = (serverCodes: string[], localCodes: string[], studentTexts: (string | null)[]) => {
    const mode = restoreModeRef.current;
    const stale = [...pendingEdits.current.entries()];
    if (mode === "adopt") {
      pendingEdits.current.clear();
      setDrafts({});
      setEditErrors({});
      return;
    }
    serverCodes.forEach((server, index) => {
      const key = editKey(null, index);
      const old = stale.find(([k]) => k === key)?.[1];
      const local = old?.code ?? (mode === "reupload" ? localCodes[index] : undefined);
      setEditErrors((prev) => ({ ...prev, [key]: undefined }));
      if (local === undefined) return;
      if (local === server) {
        pendingEdits.current.delete(key);
        dropDraft(key);
        return;
      }
      const before = replayFrom(mode, server, old, studentTexts[index] ?? null);
      const pending: PendingEdit = { code: local, count: 0, base: server, sent: new Set() };
      // A new run, so late answers to the old one are ignored.
      pendingEdits.current.set(key, pending);
      setDrafts((prev) => ({ ...prev, [key]: local }));
      sendEdit(null, index, pending, before, local);
    });
  };

  useEffect(() => {
    studentKeyRef.current = isStudent ? loadStudentKey(session.room, session.username) : undefined;

    const onHistory = (history: ChatMessage[]) =>
      setMessages((prev) => ({ ...prev, [GROUP_CHAT_ID]: history }));

    // Sent when a teacher opens a chat, to a teacher on join, and when a
    // student with a chat comes back (restored for the student).
    const onPrivateOpened = ({
      chat,
      messages: history,
      restored,
    }: {
      chat: PrivateChat;
      messages: ChatMessage[];
      restored?: boolean;
    }) => {
      const known = knownChatsRef.current.has(chat.id);
      knownChatsRef.current.add(chat.id);
      setPrivateChats((prev) =>
        prev.some((c) => c.id === chat.id)
          ? prev.map((c) => (c.id === chat.id ? chat : c))
          : [...prev, chat]
      );
      // Messages that arrived while this page was away count as new.
      const lastSeen = lastMessageAtRef.current[chat.id];
      const missed = known && lastSeen ? history.filter((m) => m.createdAt > lastSeen).length : 0;
      if (history.length) lastMessageAtRef.current[chat.id] = history[history.length - 1].createdAt;
      setMessages((prev) => ({ ...prev, [chat.id]: history }));
      if (missed > 0 && (chat.id !== activeChatRef.current || !chatOpenRef.current)) {
        setUnread((prev) => ({ ...prev, [chat.id]: (prev[chat.id] ?? 0) + missed }));
      }
      // A student is taken straight to a chat the teacher just opened with them,
      // and the chat window opens so they see it. A chat this page already had,
      // given back after a reconnect, stays as it was.
      if (isStudent && !(restored && known)) {
        selectChat(chat.id);
        setChatOpen(true);
      }
    };

    // The student left, so their chat is gone. Their progress stays.
    const onPrivateClosed = (chatId: string) => {
      knownChatsRef.current.delete(chatId);
      setPrivateChats((prev) => prev.filter((c) => c.id !== chatId));
      setMessages((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
      setUnread((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
      if (activeChatRef.current === chatId) selectChat(GROUP_CHAT_ID);
    };

    // Teachers: a student's work changed (or was sent on join). Coding
    // students: their own code, sent on every change and on each join.
    const onStudentProgress = (
      { studentId, progress }: { studentId: string; progress: StudentProgress },
      studentTexts?: (string | null)[]
    ) => {
      if (isStudent && progress.type === "coding") {
        // Read before the new code shows: what this page had.
        const localCodes = visibleCodeRef.current;
        serverCodeRef.current = progress.codes;
        setCode(progress.codes);
        setCodeOutputs(progress.outputs);
        if (resyncCodeRef.current) {
          resyncCodeRef.current = false;
          resyncCode(progress.codes, localCodes, studentTexts ?? []);
          joinedRef.current = true;
          setJoined(true);
        } else if (joinedRef.current) {
          // The connection works, so an edit whose answer timed out has reached
          // the server by now (and is in this code) or was refused. Either way
          // the server's code wins, as it does for any edit with an answer.
          for (const [key, pending] of [...pendingEdits.current.entries()]) {
            if (!key.startsWith(":") || pending.count > 0) continue;
            pendingEdits.current.delete(key);
            dropDraft(key);
          }
        }
      } else {
        setStudentProgress((prev) => ({ ...prev, [studentId]: progress }));
      }
    };

    // The room's activity, sent on join (and again on every rejoin after a
    // reconnect). It also means the server has let this connection in.
    const onRoomActivity = (next: RoomActivity | null) => {
      setWaiting(false);
      setActivity(next);
      activityRef.current = next;
      setReconnecting(false);
      // Coding students are in once their code has come too (see onStudentProgress).
      const codingStudent = isStudent && next?.type === "coding";
      resyncCodeRef.current = codingStudent;
      if (!codingStudent) {
        joinedRef.current = true;
        setJoined(true);
      }
      // Teachers get every open private chat again right after this; chats
      // that closed while this page was offline shouldn't linger.
      if (!isStudent) setPrivateChats([]);

      const json = JSON.stringify(next);
      const same = lastActivityJsonRef.current === json;
      const seat = seatRef.current;
      const mode: RestoreMode = !same
        ? "adopt"
        : !isStudent || !seat || seat.sameTab
          ? "continue"
          : seat.returning
            ? "adopt"
            : "reupload";
      restoreModeRef.current = mode;

      if (same && mode !== "adopt") {
        // This page's work is the newest. Send the Parsons answers again, since
        // changes made while offline never reached the server. (Coding code is
        // sent once the server's arrives, see resyncCode.)
        if (isStudent && next?.type === "parsons" && (touchedRef.current || restoredRef.current)) {
          pendingAnswersRef.current = null;
          socket.emit("activity update", { answers: studentAnswersRef.current });
        }
        return;
      }
      browserRun.current?.cancel();
      browserRun.current = null;
      setRun(IDLE_RUN);
      lastActivityJsonRef.current = json;
      const questions = next?.questions ?? [];
      setStudentAnswers(questions.map(startingAnswer));
      setStudentResults(questions.map(() => null));
      setStudentFeedback(questions.map(() => null));
      setCode(questions.map(() => ""));
      setCodeOutputs(questions.map(() => null));
      touchedRef.current = false;
      restoredRef.current = false;
      // Unsent work belonged to the previous activity, or lost to the server's copy.
      pendingAnswersRef.current = null;
      if (!codingStudent) {
        pendingEdits.current.clear();
        setDrafts({});
        setEditErrors({});
      }
    };

    // Students, Parsons: their saved work, right after the activity. Used
    // only when the server's copy wins (see RestoreMode).
    const onSavedWork = (work: SavedParsonsWork) => {
      if (restoreModeRef.current !== "adopt") return;
      const questions = activityRef.current?.questions ?? [];
      const answers = questions.map((question, i) => {
        const saved = work.answers?.[i];
        return Array.isArray(saved) && fitsLines(saved, question) ? saved : startingAnswer(question);
      });
      // Results and feedback only for answers that were kept.
      const kept = (i: number) => answers[i] === work.answers?.[i];
      setStudentAnswers(answers);
      setStudentResults(questions.map((_, i) => (kept(i) ? work.results?.[i] ?? null : null)));
      setStudentFeedback(questions.map((_, i) => (kept(i) ? work.feedback?.[i] ?? null : null)));
      restoredRef.current = true;
    };

    const onAnswerResult = ({
      questionIndex,
      correct,
      errors,
      marks,
    }: {
      questionIndex: number;
      correct: boolean;
      errors: string[];
      marks: AnswerFeedback["marks"];
    }) => {
      setStudentResults((prev) => prev.map((result, i) => (i === questionIndex ? correct : result)));
      setStudentFeedback((prev) =>
        prev.map((feedback, i) => (i === questionIndex ? { errors, marks } : feedback))
      );
    };

    const onMessage = (message: ChatMessage) => addMessage(message);
    const onHandQueue = (queue: RaisedHand[]) => setHandQueue(queue);
    const onClosed = (reason?: RoomClosedReason) => {
      browserRun.current?.cancel();
      browserRun.current = null;
      setRun(IDLE_RUN);
      // The seat is gone with the room.
      if (isStudent) forgetStudentKey(session.room, session.username);
      onRoomClosedRef.current?.(reason);
    };
    const onJoinErrorEvent = (reason?: "ended") => {
      if (isStudent) forgetStudentKey(session.room, session.username);
      onJoinErrorRef.current?.(reason);
    };
    const onWaiting = () => {
      setWaiting(true);
      setReconnecting(false);
    };
    // Used for the first join, after every reconnect, and again when a waiting
    // student is let in. Reads the pup from the ref, so a pup picked while
    // waiting isn't lost.
    const joinRoom = () => {
      const resume = connectedBeforeRef.current && !reclaimingRef.current;
      connectedBeforeRef.current = true;
      reclaimingRef.current = false;
      socket.emit("join", {
        username: session.username,
        role: session.role,
        room: session.room,
        pup: isStudent ? pupRef.current : undefined,
        studentKey: isStudent ? studentKeyRef.current : undefined,
        tabId: isStudent ? TAB_ID : undefined,
        resume: isStudent ? resume : undefined,
      });
    };
    // The server's key for this student's seat, to send back next time.
    const onStudentKey = (key: string, seat?: { returning: boolean; sameTab: boolean }) => {
      studentKeyRef.current = key;
      seatRef.current = seat ?? { returning: false, sameTab: false };
      saveStudentKey(session.room, session.username, key);
    };
    const onRoomOpened = () => joinRoom();
    // Another tab took this student's seat. Forget this page's copy of the
    // work, so taking the seat back adopts whatever was done there.
    const onSessionReplaced = () => {
      lastActivityJsonRef.current = null;
      touchedRef.current = false;
      restoredRef.current = false;
      pendingAnswersRef.current = null;
      pendingEdits.current.clear();
      setDrafts({});
      setEditErrors({});
      joinedRef.current = false;
      setJoined(false);
      setReconnecting(false);
      browserRun.current?.cancel();
      browserRun.current = null;
      setRun(IDLE_RUN);
      setReplaced(true);
    };
    const onTeacherAway = (away: boolean, closesAt?: string | null) => {
      setTeacherAway(away);
      setRoomClosesAt(away ? closesAt ?? null : null);
    };

    // Sent on every connect. Socket.IO reconnects by itself after a network
    // drop, and the new connection is in no room, so "join" must go again.
    // End work tied to the previous room connection.
    const onConnect = () => {
      browserRun.current?.cancel();
      browserRun.current = null;
      setRun((prev) => (prev.status === "idle" ? prev : IDLE_RUN));
      joinRoom();
    };

    const onDisconnect = (reason: string) => {
      joinedRef.current = false;
      setJoined(false);
      // Nothing stale is replayed into the next connection before its join.
      socket.sendBuffer = [];
      // A teacher's unconfirmed edits to a student's code are dropped; the
      // students' work is sent again on rejoin.
      if (!isStudent) {
        pendingEdits.current.clear();
        setDrafts({});
      }
      // The server ended this connection (room closed, join refused, another
      // tab took the seat) or the page did: those are handled elsewhere.
      // Anything else and Socket.IO is already trying to reconnect.
      if (reason === "io server disconnect" || reason === "io client disconnect") return;
      setReconnecting(true);
    };

    socket.on("chat history", onHistory);
    socket.on("chat message", onMessage);
    socket.on("private chat opened", onPrivateOpened);
    socket.on("private chat closed", onPrivateClosed);
    socket.on("private message", onMessage);
    socket.on("student activity", onStudentProgress);
    socket.on("answer result", onAnswerResult);
    socket.on("room activity", onRoomActivity);
    socket.on("saved work", onSavedWork);
    socket.on("current question", setCurrentQuestion);
    socket.on("hand queue", onHandQueue);
    socket.on("student count", setStudentCount);
    socket.on("room roster", setRoster);
    socket.on("hand status", setHandRaised);
    socket.on("timer state", setTimer);
    socket.on("room closed", onClosed);
    socket.on("join error", onJoinErrorEvent);
    socket.on("room waiting", onWaiting);
    socket.on("room opened", onRoomOpened);
    socket.on("student key", onStudentKey);
    socket.on("session replaced", onSessionReplaced);
    socket.on("teacher away", onTeacherAway);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    // The socket is opened only while a room is on screen. Disconnecting on
    // unmount tells the server the student left the room's page on purpose
    // (see "disconnect" there); closing the tab or losing the connection
    // instead leaves their seat waiting for them.
    socket.connect();

    return () => {
      browserRun.current?.cancel();
      browserRun.current = null;
      socket.off("chat history", onHistory);
      socket.off("chat message", onMessage);
      socket.off("private chat opened", onPrivateOpened);
      socket.off("private chat closed", onPrivateClosed);
      socket.off("private message", onMessage);
      socket.off("student activity", onStudentProgress);
      socket.off("answer result", onAnswerResult);
      socket.off("room activity", onRoomActivity);
      socket.off("saved work", onSavedWork);
      socket.off("current question", setCurrentQuestion);
      socket.off("hand queue", onHandQueue);
      socket.off("student count", setStudentCount);
      socket.off("room roster", setRoster);
      socket.off("hand status", setHandRaised);
      socket.off("timer state", setTimer);
      socket.off("room closed", onClosed);
      socket.off("join error", onJoinErrorEvent);
      socket.off("room waiting", onWaiting);
      socket.off("room opened", onRoomOpened);
      socket.off("student key", onStudentKey);
      socket.off("session replaced", onSessionReplaced);
      socket.off("teacher away", onTeacherAway);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      lastActivityJsonRef.current = null;
      // Send any work still waiting out the sync delay before leaving the room
      // or disconnecting. Edits made in the last 300 ms before the room ends
      // cannot be saved: the server has already closed the room.
      if (pendingAnswersRef.current && socket.connected) socket.emit("activity update", pendingAnswersRef.current);
      pendingAnswersRef.current = null;
      pendingEdits.current.clear();
      setDrafts({});
      setEditErrors({});
      socket.disconnect();
      setMessages({});
      setPrivateChats([]);
      setUnread({});
      selectChat(GROUP_CHAT_ID);
      setChatOpen(false);
      setHandQueue([]);
      setStudentCount(0);
      setHandRaised(false);
      setRoster([]);
      setTimer({ durationMs: DEFAULT_TIMER_MS, remainingMs: DEFAULT_TIMER_MS, running: false, visibleToStudents: true });
      setActivity(null);
      setCurrentQuestion(0);
      setStudentAnswers([]);
      setStudentResults([]);
      setStudentFeedback([]);
      setStudentProgress({});
      setRun(IDLE_RUN);
      setCode([]);
      setCodeOutputs([]);
      setJoined(false);
      setReconnecting(false);
      setReplaced(false);
      setTeacherAway(false);
      setRoomClosesAt(null);
      touchedRef.current = false;
      restoredRef.current = false;
      joinedRef.current = false;
      connectedBeforeRef.current = false;
      reclaimingRef.current = false;
      resyncCodeRef.current = false;
      seatRef.current = null;
      activityRef.current = null;
      serverCodeRef.current = [];
      knownChatsRef.current.clear();
      lastMessageAtRef.current = {};
    };
  }, [session.username, session.role, session.room]);

  // A student's work goes to the teacher whenever it changes, with or without a
  // private chat. The server sends it to the teacher only. While offline it
  // waits: the whole arrangement is sent again on rejoin.
  const activityType = activity?.type ?? null;
  useEffect(() => {
    if (!isStudent || activityType !== "parsons" || !touchedRef.current) return;
    // Kept in a ref until sent. The cleanup below only cancels the timer, so the
    // socket effect's cleanup can still send it if the student leaves now.
    const payload = { answers: studentAnswers };
    pendingAnswersRef.current = payload;
    const id = setTimeout(() => {
      if (!joinedRef.current) return;
      socket.emit("activity update", payload);
      if (pendingAnswersRef.current === payload) pendingAnswersRef.current = null;
    }, PROGRESS_SYNC_DELAY_MS);
    return () => clearTimeout(id);
  }, [studentAnswers, isStudent, activityType]);

  // Student: change the lines in one question. A changed answer has no result or feedback yet.
  const setStudentAnswer = (questionIndex: number, lines: ParsonsLine[]) => {
    touchedRef.current = true;
    setStudentAnswers((prev) => prev.map((answer, i) => (i === questionIndex ? lines : answer)));
    setStudentResults((prev) => prev.map((result, i) => (i === questionIndex ? null : result)));
    setStudentFeedback((prev) => prev.map((feedback, i) => (i === questionIndex ? null : feedback)));
  };

  // Shares a code edit: a student's own (studentId null) or a teacher's to a
  // student's. While a student is offline, or rejoining, their edits are kept
  // here and sent once they're back in the room, so nothing they type is lost.
  const shareCode = (studentId: string | null, questionIndex: number, next: string, shared: string) => {
    const key = editKey(studentId, questionIndex);
    const offline = !joinedRef.current;
    if (offline && studentId !== null) {
      setEditErrors((prev) => ({ ...prev, [key]: "Reconnecting to the room. Try again when connected." }));
      return;
    }
    const pending = pendingEdits.current.get(key) ?? { code: shared, count: 0, base: shared, sent: new Set<string>() };
    const before = pending.code;
    if (before === next) return;
    pending.code = next;
    pendingEdits.current.set(key, pending);
    setDrafts((prev) => ({ ...prev, [key]: next }));
    // Kept as a draft; resyncCode sends it once the student is back in the room.
    if (offline) return;
    if (pending.count === 0) setEditErrors((prev) => ({ ...prev, [key]: undefined }));
    sendEdit(studentId, questionIndex, pending, before, next);
  };

  const setCodeAt = (questionIndex: number, next: string) => {
    if (isStudent) return shareCode(null, questionIndex, next, code[questionIndex] ?? "");
    setCode((prev) => prev.map((c, i) => (i === questionIndex ? next : c)));
    setCodeOutputs((prev) => prev.map((o, i) => (i === questionIndex ? null : o)));
  };

  const visibleCode = code.map((value, i) => drafts[editKey(null, i)] ?? value);
  useEffect(() => {
    visibleCodeRef.current = visibleCode;
  });
  const codingProgress = (studentId: string) => {
    const progress = studentProgress[studentId];
    return progress?.type === "coding" ? progress : null;
  };

  // Student: ask the server whether this question's arrangement is right.
  const checkAnswer = (questionIndex: number) => {
    if (!joinedRef.current) return;
    socket.emit("check answer", { questionIndex, lines: studentAnswers[questionIndex] ?? [] });
  };

  // Student: start the question over with its lines reshuffled, as "Reset Problem" does.
  const resetProblem = (questionIndex: number) => {
    const question = activity?.questions[questionIndex];
    if (!question) return;
    setStudentAnswer(questionIndex, startingAnswer(question));
  };

  // Teachers click a student in the hand queue to open their chat.
  // The chat window opens on that student's chat so the teacher can start typing.
  const openPrivateChat = (studentId: string) => {
    selectChat(studentId);
    setChatOpen(true);
    socket.emit("open private chat", { studentId });
  };

  const sendMessage = (chatId: string, text: string) => {
    if (chatId === GROUP_CHAT_ID) socket.emit("chat message", { text });
    else socket.emit("private message", { chatId, text });
  };

  // If the chat on screen has closed, show the group chat instead.
  const shownChatId =
    activeChatId === GROUP_CHAT_ID || privateChats.some((c) => c.id === activeChatId)
      ? activeChatId
      : GROUP_CHAT_ID;

  return {
    messages,
    privateChats,
    activeChatId: shownChatId,
    unread,
    chatOpen,
    setChatOpen,
    role: session.role,
    roomCode: session.room,
    pup,
    // Students: save a new pup here and tell the server, so later messages use it.
    setPup: (next: PupId) => {
      pupRef.current = next;
      setPupState(next);
      savePupId(next);
      socket.emit("set pup", { pup: next });
    },
    handQueue,
    studentCount,
    handRaised,
    waiting,
    roster,
    timer,
    activity,
    currentQuestion,
    selectQuestion: (questionIndex: number) => socket.emit("set question", { questionIndex }),
    studentAnswers,
    studentResults,
    studentFeedback,
    setStudentAnswer,
    checkAnswer,
    resetProblem,
    studentProgress: (studentId: string) => {
      const progress = studentProgress[studentId] ?? null;
      if (activityType !== "coding") return progress;
      const shared = codingProgress(studentId);
      const codes = (activity?.questions ?? []).map((_, i) => drafts[editKey(studentId, i)] ?? shared?.codes[i] ?? "");
      return shared || codes.some(Boolean) ? {
        type: "coding",
        codes,
        outputs: codes.map((value, i) => value === shared?.codes[i] ? shared.outputs[i] ?? null : null),
      } : null;
    },
    editStudentCode: (studentId, index, next) =>
      shareCode(studentId, index, next, codingProgress(studentId)?.codes[index] ?? ""),
    codeEditError: (studentId, index) => editErrors[editKey(studentId, index)],
    selectChat,
    sendMessage,
    openPrivateChat,
    raiseHand: () => {
      if (joinedRef.current) socket.emit("raise hand");
    },
    lowerHand: (id: string) => socket.emit("lower hand", { id }),
    // This person's code for each question, their latest run, and the
    // actions to edit, start, or stop it. Students and teachers alike.
    code: visibleCode,
    codeOutputs: codeOutputs.map((value, i) => visibleCode[i] === code[i] ? value : null),
    setCode: setCodeAt,
    run: run.status === "idle" && run.questionIndex !== null && visibleCode[run.questionIndex] !== runSource.current
      ? IDLE_RUN : run,
    runCode: (questionIndex: number, code: string) => {
      if (browserRun.current) return;
      const selectedActivity = activityRef.current;
      if (!selectedActivity || selectedActivity.type !== "coding" || !selectedActivity.questions[questionIndex]) return;
      runSource.current = code;
      const jobId = makeTabId();
      setRun({ ...IDLE_RUN, jobId, questionIndex, status: "running", phase: "Loading language tools…" });
      const task = startBrowserRun(selectedActivity.language, code,
        chunk => setRun(prev => prev.jobId === jobId ? { ...prev, output: prev.output + chunk } : prev),
        phase => setRun(prev => prev.jobId === jobId ? { ...prev, phase } : prev));
      browserRun.current = task;
      void task.result.then(result => {
        if (browserRun.current !== task) return;
        const outcome: RunOutcome = { type: "finished", result };
        const output = formatRunOutput(outcome, "");
        if (visibleCodeRef.current[questionIndex] === code) {
          setCodeOutputs(prev => prev.map((value, i) => i === questionIndex ? output : value));
        }
        setRun(prev => prev.jobId === jobId ? { ...prev, status: "idle", outcome, output } : prev);
        // Results are shared as student-reported output, never executed by the server.
        if (isStudent && joinedRef.current && socket.connected && visibleCodeRef.current[questionIndex] === code) {
          socket.emit("browser run result", { questionIndex, code, result });
        }
      }, error => {
        if (browserRun.current !== task) return;
        setRun(prev => prev.jobId === jobId ? { ...prev, status: "idle", error: error instanceof Error ? error.message : "The browser runner failed." } : prev);
      }).finally(() => { if (browserRun.current === task) browserRun.current = null; });
    },
    cancelRun: () => {
      browserRun.current?.cancel();
      browserRun.current = null;
      setRun(prev => ({ ...prev, status: "idle", outcome: { type: "cancelled" }, error: null }));
    },
    ended: false,
    joined,
    reconnecting,
    replaced,
    // Students: "Use this tab". A fresh claim, so it takes the seat back.
    reclaim: () => {
      reclaimingRef.current = true;
      setReplaced(false);
      socket.connect();
    },
    teacherAway,
    roomClosesAt,
    // Students: the Leave button. Sends work still waiting, gives up the seat
    // and forgets its key in this browser, so whoever uses it next starts
    // fresh. A page that is reconnecting gets a moment to get back in first,
    // so the seat is really given up rather than left waiting as "away".
    // Resolves once the server confirms, or after a short wait.
    leave: async () => {
      for (let waited = 0; !joinedRef.current && socket.active && waited < LEAVE_REJOIN_WAIT_MS; waited += 100) {
        await new Promise((wake) => setTimeout(wake, 100));
      }
      if (joinedRef.current) {
        if (pendingAnswersRef.current) {
          socket.emit("activity update", pendingAnswersRef.current);
          pendingAnswersRef.current = null;
        }
        await new Promise<void>((resolve) => socket.timeout(LEAVE_TIMEOUT_MS).emit("leave room", () => resolve()));
      }
      forgetStudentKey(session.room, session.username);
      studentKeyRef.current = undefined;
    },
  };
}

// The state and actions the room screen gets from useRoomSocket.
export type { RoomSocket, RoomView } from "./roomView";
