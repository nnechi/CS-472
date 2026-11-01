import { RoomSocket } from "../../hooks/useRoomSocket";
import { PrivateChat } from "../../types";
import ChatPanel from "./ChatPanel";

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
          <span className="rounded-full bg-accent px-2 text-xs font-bold leading-5 tabular-nums">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </button>
    );
  }

  return (
    <section
      aria-label="Chat"
      className="fixed inset-x-0 bottom-0 z-50 flex h-[70vh] flex-col overflow-hidden border border-brand bg-white shadow-[0_8px_24px_rgba(34,21,116,0.25)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[32rem] sm:w-[24rem] sm:rounded-xl"
    >
      <header className="flex items-center justify-between gap-2 bg-brand px-4 py-2 text-white">
        <span className="font-semibold">Chat</span>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-lg leading-none cursor-pointer hover:bg-white/10"
          onClick={() => room.setChatOpen(false)}
          aria-label="Close chat"
        >
          ✕
        </button>
      </header>

      <ChatPanel room={room} username={username} privateLabel={privateLabel} />
    </section>
  );
}
