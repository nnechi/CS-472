import { useEffect, useMemo, useState } from "react";
import { getPastRoom, SessionEndedError } from "../api";
import useAuth from "./useAuth";
import { DEFAULT_TIMER_MS } from "../components/Timer";
import { loadPupId } from "../components/chat/PupAvatar";
import type { RoomView } from "./roomView";
import {
  ChatMessage,
  GROUP_CHAT_ID,
  PastRoomDetail,
  PrivateChat,
  StudentProgress,
} from "../types";

export type PastRoomStatus = "loading" | "ready" | "missing" | "error";

export type PastRoom = RoomView & {
  status: PastRoomStatus;
  errorMessage: string;
  endedAt: string | null;
};

// The server's reason when the code is not one of this teacher's saved rooms (404).
const MISSING_MESSAGE = "Cannot find that room.";

const doNothing = () => {};

// A saved (ended) room, shaped like a live room so the teacher room view can
// show it. Loads the snapshot once over REST and never opens a socket. Picking
// a question or a chat only changes this screen; sending and every other
// server action does nothing.
export function usePastRoom(roomCode: string): PastRoom {
  const [detail, setDetail] = useState<PastRoomDetail | null>(null);
  const [status, setStatus] = useState<PastRoomStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [activeChatId, setActiveChatId] = useState(GROUP_CHAT_ID);
  const [chatOpen, setChatOpen] = useState(false);
  const [pup] = useState(() => loadPupId());
  const { setAuth } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");
    setDetail(null);
    setCurrentQuestion(0);
    setActiveChatId(GROUP_CHAT_ID);
    getPastRoom(roomCode)
      .then((room) => {
        if (cancelled) return;
        setDetail(room);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // The server no longer knows this user (e.g. it restarted). Signing out
        // here lets RequireAuth send them to /login, then back to this room.
        if (error instanceof SessionEndedError) {
          setAuth(null);
          return;
        }
        const message = error instanceof Error ? error.message : "Could not load that room.";
        setErrorMessage(message);
        setStatus(message === MISSING_MESSAGE ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode, setAuth]);

  // Everything derived from the snapshot, built once per load.
  const view = useMemo(() => {
    const students = detail?.students ?? [];
    const messages: Record<string, ChatMessage[]> = { [GROUP_CHAT_ID]: detail?.messages ?? [] };
    const progress: Record<string, StudentProgress> = {};
    const privateChats: PrivateChat[] = [];
    for (const student of students) {
      messages[student.id] = student.privateMessages ?? [];
      if (student.progress) progress[student.id] = student.progress;
      if (student.hasPrivateChat) {
        privateChats.push({ id: student.id, studentName: student.username, teacherName: "Teacher" });
      }
    }
    return {
      messages,
      progress,
      privateChats,
      roster: students.map((s) => ({ id: s.id, username: s.username })),
    };
  }, [detail]);

  const shownChatId =
    activeChatId === GROUP_CHAT_ID || view.privateChats.some((c) => c.id === activeChatId)
      ? activeChatId
      : GROUP_CHAT_ID;

  return {
    status,
    errorMessage,
    endedAt: detail?.endedAt ?? null,
    messages: view.messages,
    privateChats: view.privateChats,
    activeChatId: shownChatId,
    unread: {},
    chatOpen,
    setChatOpen,
    role: "teacher",
    roomCode,
    pup,
    setPup: doNothing,
    handQueue: [],
    studentCount: 0,
    handRaised: false,
    roster: view.roster,
    timer: { durationMs: DEFAULT_TIMER_MS, remainingMs: DEFAULT_TIMER_MS, running: false },
    activity: detail?.activity ?? null,
    currentQuestion,
    selectQuestion: setCurrentQuestion,
    studentAnswers: [],
    studentResults: [],
    studentFeedback: [],
    setStudentAnswer: doNothing,
    checkAnswer: doNothing,
    resetProblem: doNothing,
    studentCodes: [],
    studentOutputs: [],
    setStudentCode: doNothing,
    setStudentOutput: doNothing,
    studentProgress: (studentId: string) => view.progress[studentId] ?? null,
    selectChat: setActiveChatId,
    sendMessage: doNothing,
    openPrivateChat: setActiveChatId,
    raiseHand: doNothing,
    lowerHand: doNothing,
    ended: true,
  };
}
