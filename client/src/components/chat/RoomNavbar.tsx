import { Session } from "../../types"
import { LeaveRoomButton } from "./LeaveRoomButton"

interface RoomNavbarProps {
    session: Session

    // Leaving unmounts the chat, which disconnects the socket and
    // drops the student from the teacher's hand queue.
    onLeave?: () => void
}

// This component represents the very top navbar during the room activity. Contains our logo, the user's name and role,
// and the "leave room" button
// Only used for the teacher room now — the student room shows StudentHeader at the top instead.
export default function RoomNavbar({ session, onLeave } : RoomNavbarProps){
    return (
        <header className="flex items-center justify-between border-b border-gray-200 p-4 font-semibold bg-white text-black">
            <span>LittlePointers</span>
            <span className="flex items-center gap-3 text-sm font-normal text-gray-900">
            {session.username} · {session.role}
            {onLeave && <LeaveRoomButton onLeave={onLeave} />}
            </span>
        </header>
    )
}