import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ChatMessage } from "../../types";
import UserAvatar from "../UserAvatar";
import PupAvatar, { isPupId } from "./PupAvatar";

// "2:14 PM" in the viewer's own clock.
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

interface ChatWindowProps {
  messages: ChatMessage[];
  // The signed-in user's name, so their own messages stand out.
  username: string;
  placeholder: string;
  onSend: (text: string) => void;
  // Shown between the messages and the input, e.g. the chat tabs.
  aboveInput?: ReactNode;
}

// One chat on screen: its messages, and the box to write in it.
export default function ChatWindow({
  messages,
  username,
  placeholder,
  onSend,
  aboveInput,
}: ChatWindowProps) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="m-0 flex-1 list-none overflow-y-auto bg-paper px-4 pt-1 pb-4">
        {messages.map((m, i) => {
          const mine = m.username === username;
          const teacher = m.role === "teacher";
          // Back-to-back messages from the same person share one avatar and name.
          const prev = messages[i - 1];
          const grouped = !!prev && prev.username === m.username && prev.role === m.role;
          const bubble = mine
            ? "rounded-2xl rounded-br-md bg-brand text-white"
            : teacher
              ? "rounded-2xl rounded-bl-md border border-brand-light bg-brand-light/30 text-brand"
              : "rounded-2xl rounded-bl-md border border-brand/15 bg-white text-brand";

          if (mine) {
            return (
              <li key={i} className={`flex flex-col items-end gap-1 ${grouped ? "mt-1" : "mt-3"}`}>
                <div className={`max-w-[80%] px-3 py-2 text-sm leading-relaxed break-words ${bubble}`}>{m.text}</div>
                {!messages[i + 1] || messages[i + 1].username !== m.username ? (
                  <span className="text-xs text-brand/60">{timeOf(m.createdAt)}</span>
                ) : null}
              </li>
            );
          }

          return (
            <li key={i} className={`flex items-end gap-2 ${grouped ? "mt-1" : "mt-3"}`}>
              {/* Avatar only on the first message of a group; a spacer keeps bubbles lined up. */}
              <span className="w-9 shrink-0">
                {!grouped &&
                  (teacher ? (
                    <UserAvatar name={m.username} picture={m.avatarUrl} size="sm" />
                  ) : (
                    <PupAvatar pup={isPupId(m.pup) ? m.pup : "corgi"} size={36} />
                  ))}
              </span>
              <div className="flex min-w-0 max-w-[80%] flex-col gap-1">
                {!grouped && (
                  <span className="flex items-center gap-1.5 text-xs text-brand/60">
                    <b className="font-semibold text-brand">{m.username}</b>
                    {teacher && (
                      <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold leading-4 text-white">Teacher</span>
                    )}
                    {timeOf(m.createdAt)}
                  </span>
                )}
                <div className={`px-3 py-2 text-sm leading-relaxed break-words ${bubble}`}>{m.text}</div>
              </div>
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ul>

      {aboveInput}

      <form className="flex items-center gap-2 border-t border-brand/20 bg-white p-3" onSubmit={handleSubmit}>
        <input
          className="h-11 min-w-0 flex-1 rounded-full border border-brand/30 bg-paper px-4 text-sm text-brand placeholder:text-brand/50 focus:border-brand focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          maxLength={1000}
        />
        <button
          type="submit"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand text-white hover:bg-brand/90"
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
