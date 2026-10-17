import { FormEvent, useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { ChatMessage, RaisedHand, Session } from "../types";

interface ChatProps {
  session: Session;
  // Called when the user clicks "Leave room". The parent decides where to go.
  onLeave?: () => void;
  onRoomClosed? : () => void; 

}

const buttonClass =
  "rounded-lg border border-indigo-600 px-3 py-1.5 text-sm text-indigo-600 cursor-pointer hover:bg-indigo-50";

export default function Chat({ session, onLeave, onRoomClosed}: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  // Teachers get the room's queue; students only learn their own status.
  const [handQueue, setHandQueue] = useState<RaisedHand[]>([]);
  const [handRaised, setHandRaised] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const onRoomClosedRef = useRef(onRoomClosed); 
  onRoomClosedRef.current = onRoomClosed; 


  useEffect(() => {
    const onHistory = (history: ChatMessage[]) => setMessages(history);
    const onClosed = () => onRoomClosedRef.current?.(); 
    const onMessage = (message: ChatMessage) =>
      setMessages((prev) => [...prev, message]);
    const onHandQueue = (queue: RaisedHand[]) => setHandQueue(queue);

    socket.on("chat history", onHistory);
    socket.on("chat message", onMessage);
    socket.on("hand queue", onHandQueue);
    socket.on("hand status", setHandRaised);
    socket.on("room closed", onClosed); 



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
      socket.off("hand queue", onHandQueue);
      socket.off("hand status", setHandRaised);
      socket.off("room closed", onClosed); 
      socket.disconnect();
      setMessages([]);
      setHandQueue([]);
      setHandRaised(false);
    };
  }, [session.username, session.role, session.room]);

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
    <div className="mx-auto flex h-screen w-full flex-col bg-white text-black">
      <header className="flex items-center justify-between border-b border-gray-200 p-4 font-semibold">
        <span>LittlePointers</span>
        <span className="flex items-center gap-3 text-sm font-normal text-gray-500">
          {session.username} · {session.role}
          {onLeave && (
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-3 py-1 text-gray-900 cursor-pointer hover:bg-neutral-100"
              onClick={onLeave}
            >
              Leave room
            </button>
          )}
        </span>
      </header>

      {/* Room banner: teachers share this code with their students. */}
      <div className="border-b border-gray-200 px-4 py-2 text-sm">
        Room code: <strong>{session.room}</strong>
        {session.role === "teacher" && (
          <span className="text-gray-500"> — share this with your students</span>
        )}
      </div>

      {/* Students: click once to ask for help, again to cancel. */}
      {session.role === "student" && (
        <div className="border-b border-gray-200 px-4 py-2">
          <button
            type="button"
            className={
              handRaised
                ? `${buttonClass} bg-indigo-600 text-white hover:bg-indigo-700`
                : buttonClass
            }
            onClick={() => socket.emit("raise hand")}
          >
            {handRaised ? "Lower hand" : "Raise hand"}
          </button>
        </div>
      )}

      {/* Teachers: students needing help, in the order they asked.
          Click a name once you've helped them. */}
      {session.role === "teacher" && (
        <div className="border-b border-gray-200 px-4 py-2 text-sm">
          <span className="font-semibold">Needs help ({handQueue.length})</span>
          {handQueue.length === 0 ? (
            <span className="ml-2 text-gray-500">No raised hands</span>
          ) : (
            <ol className="mt-1.5 list-decimal pl-6">
              {handQueue.map((h) => (
                <li key={h.id} className="mb-1">
                  <button
                    type="button"
                    className="rounded-md bg-indigo-100 px-2.5 py-1 text-sm text-indigo-700 cursor-pointer hover:line-through"
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

      <ul className="m-0 flex-1 list-none overflow-y-auto p-4">
        {messages.map((m, i) => (
          <li
            key={i}
            className={
              m.username === session.username
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

      <form className="flex gap-2 border-t border-gray-200 p-3" onSubmit={handleSubmit}>
        <input
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:border-indigo-600 focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
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
