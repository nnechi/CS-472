import { Session } from "../../types"
import useAuth from "../../hooks/useAuth"
import UserAvatar from "../UserAvatar"
import shortLogo from "../../assets/LittlePointers Logo/Short Logo.png"
import { LeaveRoomButton } from "./LeaveRoomButton"

interface RoomNavbarProps {
    session: Session

    // Leaving unmounts the chat, which disconnects the socket and
    // drops the student from the teacher's hand queue.
    onLeave?: () => void
}

// This component represents the very top navbar during the room activity. Contains our logo, the user's name and role,
// and the "leave room" button. It uses the same colors as the dashboard header.
export default function RoomNavbar({ session, onLeave } : RoomNavbarProps){
    const { auth } = useAuth()
    // Only signed-in teachers have a picture. Students get their initials.
    const picture = session.role === "teacher" ? auth?.user.picture : null

    return (
        <header className="flex h-16 items-center justify-between gap-4 border-b border-brand bg-brand-light px-4 text-brand sm:h-20 sm:px-8">
            <img src={shortLogo} alt="LittlePointers" className="h-10" />
            <span className="flex items-center gap-3 sm:gap-4">
                <UserAvatar name={session.username} picture={picture} />
                <span className="hidden flex-col leading-tight sm:flex">
                    <span className="font-semibold">{session.username}</span>
                    <span className="text-sm capitalize text-brand/70">{session.role}</span>
                </span>
                {onLeave && <LeaveRoomButton onLeave={onLeave} />}
            </span>
        </header>
    )
}