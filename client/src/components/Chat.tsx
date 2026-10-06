import { FormEvent, useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { ChatMessage, RaisedHand } from "../types";
import { Session } from "../App";

interface ChatProps {
  session: Session;
}

export default function Chat({ session }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  // Teachers get the room's queue; students only learn their own status.
  const [handQueue, setHandQueue] = useState<RaisedHand[]>([]);
  const [handRaised, setHandRaised] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onHistory = (history: ChatMessage[]) => setMessages(history);
    const onMessage = (message: ChatMessage) =>
      setMessages((prev) => [...prev, message]);
    const onHandQueue = (queue: RaisedHand[]) => setHandQueue(queue);

    socket.on("chat history", onHistory);
    socket.on("chat message", onMessage);
    socket.on("hand queue", onHandQueue);
    socket.on("hand status", setHandRaised);

    socket.emit("join", {
      username: session.username,
      role: session.role,
      room: session.room,
    });

    return () => {
      socket.off("chat history", onHistory);
      socket.off("chat message", onMessage);
      socket.off("hand queue", onHandQueue);
      socket.off("hand status", setHandRaised);
    };
  }, [session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
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
        Room code: <strong>{session.room}</strong>
        {session.role === "teacher" && (
          <span className="room-hint"> — share this with your students</span>
        )}
      </div>

      {/* Students: click once to ask for help, again to cancel. */}
      {session.role === "student" && (
        <div className="hand-bar">
          <button
            type="button"
            className={handRaised ? "hand-button raised" : "hand-button"}
            onClick={() => socket.emit("raise hand")}
          >
            {handRaised ? "Lower hand" : "Raise hand"}
          </button>
        </div>
      )}

      {/* Teachers: students needing help, in the order they asked.
          Click a name once you've helped them. */}
      {session.role === "teacher" && (
        <div className="hand-queue">
          <span className="hand-queue-title">
            Needs help ({handQueue.length})
          </span>
          {handQueue.length === 0 ? (
            <span className="hand-queue-empty">No raised hands</span>
          ) : (
            <ol className="hand-queue-list">
              {handQueue.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="hand-queue-item"
                    title="Click once you've helped this student"
                    onClick={() => socket.emit("lower hand", { id: h.id })}
                  >
                    {h.username}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <ul className="messages">
        {messages.map((m, i) => (
          <li
            key={i}
            className={
              m.username === session.username ? "message own" : "message"
            }
          >
            <span className="message-user">
              {m.username}
              <span className="message-role"> · {m.role}</span>
            </span>
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
