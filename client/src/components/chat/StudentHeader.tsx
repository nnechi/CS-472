import { RaiseHandButton } from "../HandQueue"
import type { RoomSocket } from "../../hooks/useRoomSocket"
import { Session } from "../../types"

interface StudentHeaderProps {
    session: Session
    room: RoomSocket
}

// This component contains the header for the student interface. Only contains room code and raise hand button
export default function StudentHeader({ session, room } : StudentHeaderProps){
    return (
        <div className="border-b border-brand/20 bg-paper text-brand shadow-[0_2px_8px_rgba(34,21,116,0.08)]">
            <div className="flex flex-wrap items-center gap-3 px-6 pt-4 text-sm">
                <span className="text-brand/70">Room code</span>
                <strong className="rounded-md border border-brand bg-white px-3 py-1 text-xl tracking-[0.2em] text-brand">{session.room}</strong>
            </div>
            <RaiseHandButton raised={room.handRaised} onToggle={room.raiseHand} />
        </div>
    )
}