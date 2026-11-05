import { useEffect, useRef, useState } from "react";
import { DEFAULT_TIMER_MS } from "../components/Timer";
import { socket } from "../socket";
import { PupId, loadPupId, savePupId } from "../components/chat/PupAvatar";
import type { RoomView } from "./roomView";
import {
  AnswerFeedback,
  ChatMessage,
  GROUP_CHAT_ID,
  ParsonsLine,
  PrivateChat,
  RaisedHand,
  RosterStudent,
  RoomActivity,
  RoomQuestion,
  Session,
  StudentProgress,
  TimerState,
} from "../types";

interface RoomSocketOptions {
  onRoomClosed?: () => void;
  onJoinError?: () => void;
}

// How long a student's arrangement or code waits before it is sent to the teacher.
const PROGRESS_SYNC_DELAY_MS = 300;

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

// Everything the room screen needs from the server: the group chat, private
// chats, raised hands, the timer, and the activity. The components only render
// this and call the actions it returns.
export function useRoomSocket(
  session: Session,
  { onRoomClosed, onJoinError }: RoomSocketOptions
): RoomView {
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
  // Teachers only: everyone currently connected to the room.
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  // Shared countdown. The server sends it on join and on every play/pause.
  const [timer, setTimer] = useState<TimerState>({
    durationMs: DEFAULT_TIMER_MS,
    remainingMs: DEFAULT_TIMER_MS,
    running: false,
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
  // A student's own code and last Run output for each coding question. Kept per
  // question, so changing question does not wipe it. Reset when the activity changes.
  const [studentCodes, setStudentCodes] = useState<string[]>([]);
  const [studentOutputs, setStudentOutputs] = useState<(string | null)[]>([]);
  // Teachers only: each student's progress, keyed by that student's id.
  const [studentProgress, setStudentProgress] = useState<Record<string, StudentProgress>>({});
  // Students: whether they changed their work since the activity loaded. Until
  // then nothing is sent, so the teacher sees "no work yet".
  const touchedRef = useRef(false);
  // Students: work waiting out the sync delay, not sent yet. Sent right away if
  // the student leaves or the socket disconnects first. Edits made in the last
  // 300 ms before the teacher ends the room cannot be saved, because the server
  // has already closed the room by the time they are sent.
  const pendingAnswersRef = useRef<{ answers: ParsonsLine[][] } | null>(null);
  const pendingCodesRef = useRef<{ codes: string[]; outputs: (string | null)[] } | null>(null);
  // The JSON of the last activity received. After a reconnect the server sends
  // the activity again; if it is the same one, the student's work is kept.
  const lastActivityJsonRef = useRef<string | null>(null);

  // Whether the floating chat window is open. Closed, every new message is unread.
  const [chatOpen, setChatOpenState] = useState(false);
  // A student's pup avatar: saved on this browser, random on a first visit.
  const [pup, setPupState] = useState<PupId>(() => loadPupId());

  // Socket listeners run outside render, so they read the latest values here.
  const activeChatRef = useRef(GROUP_CHAT_ID);
  const chatOpenRef = useRef(false);
  const onRoomClosedRef = useRef(onRoomClosed);
  onRoomClosedRef.current = onRoomClosed;
  const onJoinErrorRef = useRef(onJoinError);
  onJoinErrorRef.current = onJoinError;

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
    setMessages((prev) => ({
      ...prev,
      [message.chatId]: [...(prev[message.chatId] ?? []), message],
    }));
    if (message.chatId !== activeChatRef.current || !chatOpenRef.current) {
      setUnread((prev) => ({ ...prev, [message.chatId]: (prev[message.chatId] ?? 0) + 1 }));
    }
  };

  useEffect(() => {
    const onHistory = (history: ChatMessage[]) =>
      setMessages((prev) => ({ ...prev, [GROUP_CHAT_ID]: history }));

    // Sent when a teacher opens a chat, and again to a teacher on join.
    const onPrivateOpened = ({
      chat,
      messages: history,
    }: {
      chat: PrivateChat;
      messages: ChatMessage[];
    }) => {
      setPrivateChats((prev) =>
        prev.some((c) => c.id === chat.id)
          ? prev.map((c) => (c.id === chat.id ? chat : c))
          : [...prev, chat]
      );
      setMessages((prev) => ({ ...prev, [chat.id]: history }));
      // A student is taken straight to a chat the teacher just opened with them,
      // and the chat window opens so they see it.
      if (session.role === "student") {
        selectChat(chat.id);
        setChatOpen(true);
      }
    };

    // The student left, so their chat is gone. Their progress stays.
    const onPrivateClosed = (chatId: string) => {
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

    // Teachers only: a student's work changed (or was sent on join).
    const onStudentProgress = ({ studentId, progress }: { studentId: string; progress: StudentProgress }) =>
      setStudentProgress((prev) => ({ ...prev, [studentId]: progress }));

    // The room's activity, sent on join (and again on every rejoin after a
    // reconnect). Students start with nothing arranged, but a rejoin with the
    // same activity keeps the work they already did.
    const onRoomActivity = (next: RoomActivity | null) => {
      setActivity(next);
      const json = JSON.stringify(next);
      if (lastActivityJsonRef.current === json) return;
      lastActivityJsonRef.current = json;
      const questions = next?.questions ?? [];
      setStudentAnswers(questions.map(startingAnswer));
      setStudentResults(questions.map(() => null));
      setStudentFeedback(questions.map(() => null));
      setStudentCodes(questions.map(() => ""));
      setStudentOutputs(questions.map(() => null));
      touchedRef.current = false;
      // Unsent work belonged to the previous activity.
      pendingAnswersRef.current = null;
      pendingCodesRef.current = null;
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
    const onClosed = () => onRoomClosedRef.current?.();
    const onJoinErrorEvent = () => onJoinErrorRef.current?.();

    socket.on("chat history", onHistory);
    socket.on("chat message", onMessage);
    socket.on("private chat opened", onPrivateOpened);
    socket.on("private chat closed", onPrivateClosed);
    socket.on("private message", onMessage);
    socket.on("student activity", onStudentProgress);
    socket.on("answer result", onAnswerResult);
    socket.on("room activity", onRoomActivity);
    socket.on("current question", setCurrentQuestion);
    socket.on("hand queue", onHandQueue);
    socket.on("student count", setStudentCount);
    socket.on("room roster", setRoster);
    socket.on("hand status", setHandRaised);
    socket.on("timer state", setTimer);
    socket.on("room closed", onClosed);
    socket.on("join error", onJoinErrorEvent);

    // Sent on every connect. Socket.IO reconnects by itself after a network
    // drop, and the new connection is in no room, so "join" must go again.
    const sendJoin = () => {
      socket.emit("join", {
        username: session.username,
        role: session.role,
        room: session.room,
        pup: session.role === "student" ? pup : undefined,
      });
    };
    socket.on("connect", sendJoin);

    // The socket is opened only while a room is on screen. Disconnecting on
    // unmount leaves the room server-side and drops a student from the
    // teacher's hand queue.
    socket.connect();

    return () => {
      socket.off("chat history", onHistory);
      socket.off("chat message", onMessage);
      socket.off("private chat opened", onPrivateOpened);
      socket.off("private chat closed", onPrivateClosed);
      socket.off("private message", onMessage);
      socket.off("student activity", onStudentProgress);
      socket.off("answer result", onAnswerResult);
      socket.off("room activity", onRoomActivity);
      socket.off("current question", setCurrentQuestion);
      socket.off("hand queue", onHandQueue);
      socket.off("student count", setStudentCount);
      socket.off("room roster", setRoster);
      socket.off("hand status", setHandRaised);
      socket.off("timer state", setTimer);
      socket.off("room closed", onClosed);
      socket.off("join error", onJoinErrorEvent);
      socket.off("connect", sendJoin);
      lastActivityJsonRef.current = null;
      // Send any work still waiting out the sync delay before leaving the room
      // or disconnecting. Edits made in the last 300 ms before the room ends
      // cannot be saved: the server has already closed the room.
      if (pendingAnswersRef.current) socket.emit("activity update", pendingAnswersRef.current);
      if (pendingCodesRef.current) socket.emit("code update", pendingCodesRef.current);
      pendingAnswersRef.current = null;
      pendingCodesRef.current = null;
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
      setTimer({ durationMs: DEFAULT_TIMER_MS, remainingMs: DEFAULT_TIMER_MS, running: false });
      setActivity(null);
      setCurrentQuestion(0);
      setStudentAnswers([]);
      setStudentResults([]);
      setStudentFeedback([]);
      setStudentCodes([]);
      setStudentOutputs([]);
      setStudentProgress({});
      touchedRef.current = false;
    };
  }, [session.username, session.role, session.room]);

  // A student's work goes to the teacher whenever it changes, with or without a
  // private chat. The server sends it to the teacher only.
  const isStudent = session.role === "student";
  const activityType = activity?.type ?? null;
  useEffect(() => {
    if (!isStudent || activityType !== "parsons" || !touchedRef.current) return;
    // Kept in a ref until sent. The cleanup below only cancels the timer, so the
    // socket effect's cleanup can still send it if the student leaves now.
    const payload = { answers: studentAnswers };
    pendingAnswersRef.current = payload;
    const id = setTimeout(() => {
      socket.emit("activity update", payload);
      if (pendingAnswersRef.current === payload) pendingAnswersRef.current = null;
    }, PROGRESS_SYNC_DELAY_MS);
    return () => clearTimeout(id);
  }, [studentAnswers, isStudent, activityType]);

  useEffect(() => {
    if (!isStudent || activityType !== "coding" || !touchedRef.current) return;
    const payload = { codes: studentCodes, outputs: studentOutputs };
    pendingCodesRef.current = payload;
    const id = setTimeout(() => {
      socket.emit("code update", payload);
      if (pendingCodesRef.current === payload) pendingCodesRef.current = null;
    }, PROGRESS_SYNC_DELAY_MS);
    return () => clearTimeout(id);
  }, [studentCodes, studentOutputs, isStudent, activityType]);

  // Student: change the lines in one question. A changed answer has no result or feedback yet.
  const setStudentAnswer = (questionIndex: number, lines: ParsonsLine[]) => {
    touchedRef.current = true;
    setStudentAnswers((prev) => prev.map((answer, i) => (i === questionIndex ? lines : answer)));
    setStudentResults((prev) => prev.map((result, i) => (i === questionIndex ? null : result)));
    setStudentFeedback((prev) => prev.map((feedback, i) => (i === questionIndex ? null : feedback)));
  };

  // Student: change the code of one question. Its last output no longer matches, so it is cleared.
  const setStudentCode = (questionIndex: number, code: string) => {
    touchedRef.current = true;
    setStudentCodes((prev) => prev.map((c, i) => (i === questionIndex ? code : c)));
    setStudentOutputs((prev) => prev.map((o, i) => (i === questionIndex ? null : o)));
  };

  // Student: the output of running one question's code.
  const setStudentOutput = (questionIndex: number, output: string | null) => {
    touchedRef.current = true;
    setStudentOutputs((prev) => prev.map((o, i) => (i === questionIndex ? output : o)));
  };

  // Student: ask the server whether this question's arrangement is right.
  const checkAnswer = (questionIndex: number) => {
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
      setPupState(next);
      savePupId(next);
      socket.emit("set pup", { pup: next });
    },
    handQueue,
    studentCount,
    handRaised,
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
    studentCodes,
    studentOutputs,
    setStudentCode,
    setStudentOutput,
    studentProgress: (studentId: string) => studentProgress[studentId] ?? null,
    selectChat,
    sendMessage,
    openPrivateChat,
    raiseHand: () => socket.emit("raise hand"),
    lowerHand: (id: string) => socket.emit("lower hand", { id }),
    ended: false,
  };
}

// The state and actions the room screen gets from useRoomSocket.
export type { RoomSocket, RoomView } from "./roomView";
