import { RoomSocket } from "../../hooks/useRoomSocket";
import { GROUP_CHAT_ID, PrivateChat } from "../../types";
import ChatTabs, { ChatTab } from "./ChatTabs";
import ChatWindow from "./ChatWindow";

interface ChatPanelProps {
  room: RoomSocket;
  username: string;
  // The tab label for a private chat. Each role names the other person.
  privateLabel: (chat: PrivateChat) => string;
}

// The chat both roles use: the open chat's messages, the tab bar, and the box to write in.
export default function ChatPanel({ room, username, privateLabel }: ChatPanelProps) {
  const tabs: ChatTab[] = [
    { id: GROUP_CHAT_ID, label: "Group chat" },
    ...room.privateChats.map((chat) => ({ id: chat.id, label: privateLabel(chat) })),
  ];

  return (
    // Keyed by chat so a half-typed message never lands in the wrong chat.
    <ChatWindow
      key={room.activeChatId}
      messages={room.messages[room.activeChatId] ?? []}
      username={username}
      placeholder={room.activeChatId === GROUP_CHAT_ID ? "Type a message..." : "Type a private message..."}
      onSend={(text) => room.sendMessage(room.activeChatId, text)}
      aboveInput={
        <ChatTabs
          tabs={tabs}
          activeId={room.activeChatId}
          unread={room.unread}
          onSelect={room.selectChat}
        />
      }
    />
  );
}
