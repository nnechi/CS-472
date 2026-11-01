import { ReactNode } from "react";

interface RoomLayoutProps {
  // The activity, which fills the page.
  activity: ReactNode;
  // The chat, which floats on top of the activity and takes up no space.
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
      {activity}
      {chat}
    </div>
  )
}
