import { Session } from "../../types"

interface RoomNavbarProps {
    session: Session
    onLeave?: () => void
}

// This component represents the very top navbar during the room activity. Contains our logo, the user's name and role, 
// and the "leave room" button
export default function RoomNavbar({ session, onLeave } : RoomNavbarProps){
    return (
        <header className="flex items-center justify-between border-b border-gray-200 p-4 font-semibold bg-white text-black">
            <span>LittlePointers</span>
            <span className="flex items-center gap-3 text-sm font-normal text-gray-900">
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
    )
}