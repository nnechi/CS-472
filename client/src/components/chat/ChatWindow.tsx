import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ChatMessage } from "../../types";

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
      <ul className="m-0 flex-1 list-none overflow-y-auto p-4">
        {messages.map((m, i) => (
          <li
            key={i}
            className={
              m.username === username
                ? "mb-2 ml-auto max-w-[80%] rounded-lg bg-indigo-100 px-3 py-2"
                : "mb-2 max-w-[80%] rounded-lg bg-gray-100 px-3 py-2"
            }
          >
            <span className="mb-0.5 block text-xs font-bold text-indigo-600">
              {m.username}
              <span className="font-normal text-gray-500"> · {m.role}</span>
            </span>
            <span className="break-words">{m.text}</span>
          </li>
        ))}
        <div ref={bottomRef} />
      </ul>

      {aboveInput}

      <form className="flex gap-2 border-t border-gray-200 p-3" onSubmit={handleSubmit}>
        <input
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:border-indigo-600 focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          maxLength={1000}
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white cursor-pointer hover:bg-indigo-700"
        >
          Send
        </button>
      </form>
    </div>
  );
}
