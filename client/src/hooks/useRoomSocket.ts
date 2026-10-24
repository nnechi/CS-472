import { useEffect, useRef, useState } from "react";
import { DEFAULT_TIMER_MS } from "../components/Timer";
import { socket } from "../socket";
import {
  AnswerFeedback,
  AnswerProgress,
  ChatMessage,
  GROUP_CHAT_ID,
  ParsonsLine,
  PrivateChat,
  RaisedHand,
  RoomActivity,
  RoomQuestion,
  Session,
  TimerState,
} from "../types";

interface RoomSocketOptions {
  onRoomClosed?: () => void;
  onJoinError?: () => void;
}

// How long a student's arrangement waits before it is sent to the teacher.
const PROGRESS_SYNC_DELAY_MS = 300;

const EMPTY_PROGRESS: AnswerProgress = { answers: [], results: [] };

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
) {
  // Messages for each chat, keyed by chat id (GROUP_CHAT_ID or a student's id).
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  const [activeChatId, setActiveChatId] = useState(GROUP_CHAT_ID);
  // New messages in chats that are not on screen, keyed by chat id.
  const [unread, setUnread] = useState<Record<string, number>>({});
  // Teachers get the room's queue; students only learn their own status.
  const [handQueue, setHandQueue] = useState<RaisedHand[]>([]);
  const [handRaised, setHandRaised] = useState(false);
  // Shared countdown. The server sends it on join and on every play/pause.
  const [timer, setTimer] = useState<TimerState>({
    durationMs: DEFAULT_TIMER_MS,
    remainingMs: DEFAULT_TIMER_MS,
    running: false,
  });
  // The room's activity, questions shaped for this person's role.
  const [activity, setActivity] = useState<RoomActivity | null>(null);
  // A student's own arrangement of each Parsons question, whether each is right,
  // and the feedback for each (null until checked, or when feedback is off).
  const [studentAnswers, setStudentAnswers] = useState<ParsonsLine[][]>([]);
  const [studentResults, setStudentResults] = useState<(boolean | null)[]>([]);
  const [studentFeedback, setStudentFeedback] = useState<(AnswerFeedback | null)[]>([]);
  // Teachers only: each student's progress, keyed by that student's chat id.
  const [studentProgress, setStudentProgress] = useState<Record<string, AnswerProgress>>({});

  // Socket listeners run outside render, so they read the latest values here.
  const activeChatRef = useRef(GROUP_CHAT_ID);
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

  // Add a message to its chat. It counts as unread if that chat is not on screen.
  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => ({
      ...prev,
      [message.chatId]: [...(prev[message.chatId] ?? []), message],
    }));
    if (message.chatId !== activeChatRef.current) {
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
      progress,
    }: {
      chat: PrivateChat;
      messages: ChatMessage[];
      progress: AnswerProgress;
    }) => {
      setPrivateChats((prev) =>
        prev.some((c) => c.id === chat.id)
          ? prev.map((c) => (c.id === chat.id ? chat : c))
          : [...prev, chat]
      );
      setMessages((prev) => ({ ...prev, [chat.id]: history }));
      setStudentProgress((prev) => ({ ...prev, [chat.id]: progress }));
      // A student is taken straight to a chat the teacher just opened with them.
      if (session.role === "student") selectChat(chat.id);
    };

    // The student left, so their chat is gone.
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
      setStudentProgress((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
      if (activeChatRef.current === chatId) selectChat(GROUP_CHAT_ID);
    };

    const onStudentProgress = ({ chatId, progress }: { chatId: string; progress: AnswerProgress }) =>
      setStudentProgress((prev) => ({ ...prev, [chatId]: progress }));

    // The room's activity, sent on join. Students start with nothing arranged.
    const onRoomActivity = (next: RoomActivity | null) => {
      setActivity(next);
      const questions = next?.questions ?? [];
      setStudentAnswers(questions.map(startingAnswer));
      setStudentResults(questions.map(() => null));
      setStudentFeedback(questions.map(() => null));
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
    socket.on("hand queue", onHandQueue);
    socket.on("hand status", setHandRaised);
    socket.on("timer state", setTimer);
    socket.on("room closed", onClosed);
    socket.on("join error", onJoinErrorEvent);

    // The socket is opened only while a room is on screen. Socket.IO buffers
    // the "join" below until the connection is up, so emitting right away is
    // fine. Disconnecting on unmount leaves the room server-side and drops a
    // student from the teacher's hand queue.
    socket.connect();
    socket.emit("join", {
      username: session.username,
      role: session.role,
      room: session.room,
    });

    return () => {
      socket.off("chat history", onHistory);
      socket.off("chat message", onMessage);
      socket.off("private chat opened", onPrivateOpened);
      socket.off("private chat closed", onPrivateClosed);
      socket.off("private message", onMessage);
      socket.off("student activity", onStudentProgress);
      socket.off("answer result", onAnswerResult);
      socket.off("room activity", onRoomActivity);
      socket.off("hand queue", onHandQueue);
      socket.off("hand status", setHandRaised);
      socket.off("timer state", setTimer);
      socket.off("room closed", onClosed);
      socket.off("join error", onJoinErrorEvent);
      socket.disconnect();
      setMessages({});
      setPrivateChats([]);
      setUnread({});
      selectChat(GROUP_CHAT_ID);
      setHandQueue([]);
      setHandRaised(false);
      setTimer({ durationMs: DEFAULT_TIMER_MS, remainingMs: DEFAULT_TIMER_MS, running: false });
      setActivity(null);
      setStudentAnswers([]);
      setStudentResults([]);
      setStudentFeedback([]);
      setStudentProgress({});
    };
  }, [session.username, session.role, session.room]);

  // A student's arrangement goes to the teacher only while their private chat
  // is open. The effect runs again when the chat opens, so the teacher gets the
  // current arrangement right away.
  const hasPrivateChat = session.role === "student" && privateChats.length > 0;
  useEffect(() => {
    if (!hasPrivateChat) return;
    const id = setTimeout(
      () => socket.emit("activity update", { answers: studentAnswers }),
      PROGRESS_SYNC_DELAY_MS
    );
    return () => clearTimeout(id);
  }, [studentAnswers, hasPrivateChat]);

  // Student: change the lines in one question. A changed answer has no result or feedback yet.
  const setStudentAnswer = (questionIndex: number, lines: ParsonsLine[]) => {
    setStudentAnswers((prev) => prev.map((answer, i) => (i === questionIndex ? lines : answer)));
    setStudentResults((prev) => prev.map((result, i) => (i === questionIndex ? null : result)));
    setStudentFeedback((prev) => prev.map((feedback, i) => (i === questionIndex ? null : feedback)));
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
  const openPrivateChat = (studentId: string) => {
    selectChat(studentId);
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
    handQueue,
    handRaised,
    timer,
    activity,
    studentAnswers,
    studentResults,
    studentFeedback,
    setStudentAnswer,
    checkAnswer,
    resetProblem,
    studentProgress: (chatId: string) => studentProgress[chatId] ?? EMPTY_PROGRESS,
    selectChat,
    sendMessage,
    openPrivateChat,
    raiseHand: () => socket.emit("raise hand"),
    lowerHand: (id: string) => socket.emit("lower hand", { id }),
  };
}

// The state and actions the room screen gets from useRoomSocket.
export type RoomSocket = ReturnType<typeof useRoomSocket>;
