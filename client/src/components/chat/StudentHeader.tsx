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
        <div className="bg-white text-black">
            <div className="border-b border-gray-200 px-4 py-2 text-sm">
                Room code: <strong>{session.room}</strong>
            </div>
            <RaiseHandButton raised={room.handRaised} onToggle={room.raiseHand} />
        </div>
    )
}