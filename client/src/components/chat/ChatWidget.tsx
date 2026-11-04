import { RoomSocket } from "../../hooks/useRoomSocket";
import { PrivateChat } from "../../types";
import { useState } from "react";
import ChatPanel from "./ChatPanel";
import PupAvatar, { PUPS, PupPicker } from "./PupAvatar";

interface ChatWidgetProps {
  room: RoomSocket;
  username: string;
  // The tab label for a private chat. Each role names the other person.
  privateLabel: (chat: PrivateChat) => string;
}

// The chat as a button in the bottom-right corner, like a video call app.
// Clicking it opens the chat window; the number counts messages not seen yet.
// The socket stays connected while it is closed (useRoomSocket owns it).
export default function ChatWidget({ room, username, privateLabel }: ChatWidgetProps) {
  const unreadTotal = Object.values(room.unread).reduce((sum, n) => sum + n, 0);
  // Students can open "Choose your pup" from the bar under the header.
  const [pickingPup, setPickingPup] = useState(false);
  const isTeacher = room.role === "teacher";

  if (!room.chatOpen) {
    return (
      <button
        type="button"
        className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full bg-brand px-5 py-3 font-semibold text-white shadow-[0_4px_14px_rgba(34,21,116,0.35)] cursor-pointer hover:bg-brand/90"
        onClick={() => room.setChatOpen(true)}
        aria-label={unreadTotal > 0 ? `Open chat, ${unreadTotal} new messages` : "Open chat"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
        </svg>
        Chat
        {unreadTotal > 0 && (
          <span className="rounded-full bg-[#b45309] px-2 text-xs font-bold leading-5 text-white tabular-nums">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </button>
    );
  }

  return (
    <section
      aria-label="Chat"
      className={`fixed inset-x-0 bottom-0 z-50 flex h-[70vh] flex-col overflow-hidden border border-brand bg-white shadow-[0_8px_24px_rgba(34,21,116,0.25)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[32rem] sm:w-[24rem] sm:rounded-xl ${
        // Teachers see the same window as students, with a mint background
        // behind the messages and the tabs.
        isTeacher ? "[&_[role=tablist]]:bg-brand-light/40 [&_ul]:bg-brand-light/40" : ""
      }`}
    >
      <header className="flex items-center justify-between gap-2 bg-brand px-4 py-3 text-white">
        <span className="flex flex-col gap-0.5 leading-tight">
          <span className="font-bold">Class chat</span>
          {/* Room code for everyone; teachers also see how many students joined. */}
          <span className="flex flex-wrap items-center gap-x-2 text-xs font-semibold">
            <span className="text-white/80">Room {room.roomCode}</span>
          {isTeacher && (
            <span className="flex items-center gap-1" aria-live="polite">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {room.studentCount} {room.studentCount === 1 ? "student" : "students"} joined
            </span>
          )}
          </span>
        </span>
        <button
          type="button"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-white/10"
          onClick={() => room.setChatOpen(false)}
          aria-label="Close chat"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {/* Students: their name and pup. Clicking it opens "Choose your pup". */}
      {room.role === "student" && (
        <div className="flex items-center justify-between gap-2 border-b border-brand-light bg-brand-light/30 px-4 py-2">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 rounded-full border border-brand bg-white py-1 pr-3 pl-1 text-xs font-semibold text-brand hover:bg-brand-light/30"
            onClick={() => setPickingPup(true)}
          >
            <PupAvatar pup={room.pup} size={28} />
            You: {username} · {PUPS[room.pup].label}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.2 6.8a2 2 0 0 0-4-4L3.8 16.2l-1.3 4.3a.5.5 0 0 0 .6.6l4.3-1.3z" />
            </svg>
          </button>
        </div>
      )}

      {pickingPup && (
        <PupPicker
          name={username}
          current={room.pup}
          onClose={() => setPickingPup(false)}
          onSave={(next) => {
            room.setPup(next);
            setPickingPup(false);
          }}
        />
      )}

      <ChatPanel room={room} username={username} privateLabel={privateLabel} />
    </section>
  );
}
