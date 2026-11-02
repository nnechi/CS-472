import { RaiseHandButton } from "../HandQueue"
import { RoomCodeBadge } from "./RoomCodeBadge"
import { LeaveRoomButton } from "./LeaveRoomButton"
import type { RoomSocket } from "../../hooks/useRoomSocket"
import { Session } from "../../types"
import shortLogo from "../../assets/LittlePointers Logo/Short Logo.png"

interface StudentHeaderProps {
    session: Session
    room: RoomSocket

    // Leaving unmounts the chat, which disconnects the socket and
    // drops the student from the teacher's hand queue.
    onLeave: () => void
}

// This is the very top of the student room page (the site-wide navbar is not
// shown for students): the LP logo, the student's name, and the raise-hand
// control on the left; the room code and leave-room control on the right.
export default function StudentHeader({ session, room, onLeave } : StudentHeaderProps){
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand bg-brand-light px-4 py-3">
            <div className="flex items-center gap-4">
                <img src={shortLogo} alt="LittlePointers" className="h-8 w-auto shrink-0" />
                <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-brand">{session.username}</span>
                    <RaiseHandButton raised={room.handRaised} onToggle={room.raiseHand} />
                </div>
            </div>
            <div className="flex items-center gap-3">
                <RoomCodeBadge code={session.room} size="lg" />
                <span className="h-6 w-px bg-brand/20" aria-hidden="true" />
                <LeaveRoomButton onLeave={onLeave} />
            </div>
        </div>
    )
}