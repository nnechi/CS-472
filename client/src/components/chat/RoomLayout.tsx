import { ReactNode } from "react";
import { Session } from "../../types";

interface RoomLayoutProps {
  session: Session;
  // Leaving is the page's choice. Undefined hides the button.
  onLeave?: () => void;
  // Shown after the room code in the banner, e.g. the teacher's share note.
  bannerNote?: ReactNode;
  // Role-specific controls under the banner, such as the timer or raise hand.
  controls?: ReactNode;
  // The activity, on the left on wide screens.
  activity: ReactNode;
  // The chat, on the right on wide screens.
  chat: ReactNode;
}

// The room screen both roles share: header, room code, controls, then the
// activity beside the chat. Each room page decides what goes in the slots.
export default function RoomLayout({
  session,
  onLeave,
  bannerNote,
  controls,
  activity,
  chat,
}: RoomLayoutProps) {
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

      <div className="border-b border-gray-200 px-4 py-2 text-sm">
        Room code: <strong>{session.room}</strong>
        {bannerNote}
      </div>

      {controls}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 flex-1 flex-col md:border-r md:border-gray-200">{activity}</div>
        <div className="flex min-h-0 flex-1 flex-col border-t border-gray-200 md:w-[28rem] md:flex-none md:border-t-0">
          {chat}
        </div>
      </div>
    </div>
  );
}
