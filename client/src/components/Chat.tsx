import { useRoomSocket } from "../hooks/useRoomSocket";
import { socket } from "../socket";
import { GROUP_CHAT_ID, Session } from "../types";
import ChatTabs, { ChatTab } from "./ChatTabs";
import ChatWindow from "./ChatWindow";
import { HandQueue, RaiseHandButton } from "./HandQueue";
import Timer from "./Timer";

interface ChatProps {
  session: Session;
  // Called when the user clicks "Leave room". The parent decides where to go.
  onLeave?: () => void;
  onRoomClosed? : () => void;
  onJoinError? : () => void;

}

export default function Chat({ session, onLeave, onRoomClosed, onJoinError}: ChatProps) {
  const isTeacher = session.role === "teacher";
  const {
    messages,
    privateChats,
    activeChatId,
    unread,
    handQueue,
    handRaised,
    timer,
    selectChat,
    sendMessage,
    openPrivateChat,
    raiseHand,
    lowerHand,
  } = useRoomSocket(session, { onRoomClosed, onJoinError });

  // The group chat first, then one tab for each private chat in the room.
  const tabs: ChatTab[] = [
    { id: GROUP_CHAT_ID, label: "Group chat" },
    ...privateChats.map((chat) => ({
      id: chat.id,
      label: `Private: ${isTeacher ? chat.studentName : chat.teacherName}`,
    })),
  ];

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
        {isTeacher && (
          <span className="text-gray-500"> — share this with your students</span>
        )}
      </div>

      {/* Countdown: teachers only. Students don't see it. */}
      {isTeacher && (
        <Timer
          durationMs={timer.durationMs}
          remainingMs={timer.remainingMs}
          running={timer.running}
          isTeacher={true}
          onPlay={() => socket.emit("timer play")}
          onPause={() => socket.emit("timer pause")}
          onRestart={() => socket.emit("timer restart")}
          onSetMinutes={(minutes) => socket.emit("timer set", { minutes })}
        />
      )}

      {/* Students: click once to ask for help, again to cancel. */}
      {!isTeacher && <RaiseHandButton raised={handRaised} onToggle={raiseHand} />}

      {/* Teachers: students needing help, with a private chat for each. */}
      {isTeacher && (
        <HandQueue
          queue={handQueue}
          onLowerHand={lowerHand}
          onOpenPrivateChat={openPrivateChat}
        />
      )}

      {/* Keyed by chat so a half-typed message never lands in the wrong chat. */}
      <ChatWindow
        key={activeChatId}
        messages={messages[activeChatId] ?? []}
        username={session.username}
        placeholder={activeChatId === GROUP_CHAT_ID ? "Type a message..." : "Type a private message..."}
        onSend={(text) => sendMessage(activeChatId, text)}
        aboveInput={
          <ChatTabs
            tabs={tabs}
            activeId={activeChatId}
            unread={unread}
            onSelect={selectChat}
          />
        }
      />
    </div>
  );
}
