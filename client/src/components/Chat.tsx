import { FormEvent, useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { ChatMessage, Role } from "../types";
import { Session } from "../App";

interface ChatProps {
  session: Session;
}

export default function Chat({ session }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [room, setRoom] = useState(session.room);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to socket events once, when this component mounts.
  useEffect(() => {
    // The server sends the recent history right after we connect.
    const onJoined = (payload: { room: string; role: Role }) =>
      setRoom(payload.room);
    const onHistory = (history: ChatMessage[]) => setMessages(history);
    // Every new message (from anyone) arrives here and is appended.
    const onMessage = (message: ChatMessage) =>
      setMessages((prev) => [...prev, message]);

    socket.on("joined", onJoined);
    socket.on("chat history", onHistory);
    socket.on("chat message", onMessage);

    socket.emit("join", {
      username: session.username,
      role: session.role,
      room: session.room,
    });

    return () => {
      socket.off("joined", onJoined);
      socket.off("chat history", onHistory);
      socket.off("chat message", onMessage);
    };
  }, [session]);

  // Auto-scroll to the newest message whenever the list changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    // Send to the server; it will save + broadcast back to everyone (us included).
    socket.emit("chat message", { text: trimmed });
    setText("");
  };

  return (
    <div className="chat">
      <header className="chat-header">
        <span>CS HELP TOOL</span>
        <span className="chat-username">
          {session.username} · {session.role}
        </span>
      </header>

      {/* Room banner: teachers share this code with their students. */}
      <div className="room-banner">
        Room code: <strong>{room || "…"}</strong>
        {session.role === "teacher" && (
          <span className="room-hint"> — share this with your students</span>
        )}
      </div>

      <ul className="messages">
        {messages.map((m, i) => (
          <li
            key={i}
            className={
              m.username === session.username ? "message own" : "message"
            }
          >
            <span className="message-user">{m.username}</span>
            <span className="message-text">{m.text}</span>
          </li>
        ))}
        <div ref={bottomRef} />
      </ul>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          className="composer-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          autoComplete="off"
          maxLength={1000}
        />
        <button className="composer-button" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
