import { ReactNode } from "react";

interface RoomLayoutProps {
  // The activity, on the left on wide screens.
  activity: ReactNode;
  // The chat, on the right on wide screens.
  chat: ReactNode;
}

// This component contains everything below the room navbars and the respective room headers (student header or teacher header)
// Is reused for both student room and teacher room
export default function RoomLayout({
  activity,
  chat,
}: RoomLayoutProps) {
  return (
    <div className="mx-auto flex min-h-0 flex-1 w-full flex-col bg-paper text-brand">
      <div className="flex min-h-0 flex-1 flex-col">{activity}</div>
      {chat}
    </div>
  );
}
