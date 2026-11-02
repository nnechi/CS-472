import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ChatMessage } from "../../types";
import UserAvatar from "../UserAvatar";

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
      <ul className="m-0 flex-1 list-none overflow-y-auto bg-paper p-4">
        {messages.map((m, i) => {
          const mine = m.username === username;
          return (
            // Each message: the sender's picture (or initials) beside the bubble.
            // Your own messages sit on the right with the picture on the right.
            <li key={i} className={`mb-2 flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <UserAvatar name={m.username} picture={m.avatarUrl} size="sm" />
              <div
                className={
                  mine
                    ? "max-w-[75%] rounded-lg bg-brand-light px-3 py-2 text-brand"
                    : "max-w-[75%] rounded-lg border border-brand/15 bg-white px-3 py-2 text-brand"
                }
              >
                <span className="mb-0.5 block text-xs font-bold text-brand">
                  {m.username}
                  <span className="font-normal text-brand/60"> · {m.role}</span>
                </span>
                <span className="break-words">{m.text}</span>
              </div>
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ul>

      {aboveInput}

      <form className="flex gap-2 border-t border-brand/20 bg-white p-3" onSubmit={handleSubmit}>
        <input
          className="flex-1 rounded-full border border-brand/30 px-4 py-2 text-brand placeholder:text-brand/50 focus:border-brand focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          maxLength={1000}
        />
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-white cursor-pointer hover:bg-brand/90"
        >
          Send
        </button>
      </form>
    </div>
  );
}
