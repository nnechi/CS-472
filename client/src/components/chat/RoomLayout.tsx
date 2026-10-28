import { ReactNode } from "react";

interface RoomLayoutProps {
  // The activity, on the left on wide screens.
  activity: ReactNode;
  // The chat, on the right on wide screens.
  // TODO: CHANGE TO BE A CHAT WINDOW INSTEAD
  chat: ReactNode;
}

// This component contains everything below the room navbars and the respective room headers (student header or teacher header)
// Is reused for both student room and teacher room
export default function RoomLayout({
  activity,
  chat,
}: RoomLayoutProps) {
  return (
    <div className="mx-auto flex min-h-0 flex-1 w-full flex-col bg-white text-black">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 flex-1 flex-col md:border-r md:border-gray-200">{activity}</div>
        <div className="flex min-h-0 flex-1 flex-col border-t border-gray-200 md:w-[28rem] md:flex-none md:border-t-0">
          {chat}
        </div>
      </div>
    </div>
  );
}
