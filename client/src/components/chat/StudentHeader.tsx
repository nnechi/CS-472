import { RaiseHandButton } from "../HandQueue"
import { RoomCodeBadge } from "./RoomCodeBadge"
import { LeaveRoomButton } from "./LeaveRoomButton"
import Timer from "../Timer"
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
// control on the left; the classroom timer centered (mathematically, via a
// 3-column grid, regardless of how wide the two sides are) so it reads
// consistently with the teacher's header; the room code and leave-room
// control on the right.
export default function StudentHeader({ session, room, onLeave } : StudentHeaderProps){
    return (
        <div className="flex flex-col gap-3 border-b border-brand bg-brand-light px-4 py-3 sm:px-8 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-4">
                <img src={shortLogo} alt="LittlePointers" className="h-8 w-auto shrink-0" />
                <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-brand">{session.username}</span>
                    <RaiseHandButton raised={room.handRaised} onToggle={room.raiseHand} />
                </div>
            </div>

            <div className="flex items-center justify-center">
                <Timer
                    durationMs={room.timer.durationMs}
                    remainingMs={room.timer.remainingMs}
                    running={room.timer.running}
                    isTeacher={false}
                    onPlay={() => {}}
                    onPause={() => {}}
                    onRestart={() => {}}
                    onSetMinutes={() => {}}
                />
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
                <RoomCodeBadge code={session.room} size="lg" />
                <span className="h-6 w-px shrink-0 bg-brand/20" aria-hidden="true" />
                <LeaveRoomButton onLeave={onLeave} />
            </div>
        </div>
    )
}