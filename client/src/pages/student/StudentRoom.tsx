import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import ActivityBox from "../../components/chat/ActivityBox"
import ChatPanel from "../../components/chat/ChatPanel"
import RoomLayout from "../../components/chat/RoomLayout"
import { RaiseHandButton } from "../../components/HandQueue"
import { useRoomSocket } from "../../hooks/useRoomSocket"
import { Session } from "../../types"
import { normalizeRoomCode } from "../../utils/roomCode"

// /rooms/join/:roomCode -- the student's view of a room: the activity, the chat,
// and the raise-hand button. Students have no account; the name comes from the
// home page form via router state. Without a name (e.g. a shared link), send
// them back to the home page to enter one.
export default function StudentRoom() {
    const location = useLocation()
    const { roomCode } = useParams()
    const room = normalizeRoomCode(roomCode ?? "")
    const username = (location.state as { username?: string } | null)?.username?.trim()

    if (!room || !username) return <Navigate to="/" replace />

    return <StudentRoomScreen session={{ username, role: "student", room }} />
}

// The socket is opened here, so it only runs once the name check has passed.
function StudentRoomScreen({ session }: { session: Session }) {
    const navigate = useNavigate()
    const room = useRoomSocket(session, {
        onRoomClosed: () => {
            window.alert("Your teacher ended this room.")
            navigate("/")
        },
        onJoinError: () => {
            window.alert("This room doesn't exist or it's expired.")
            navigate("/")
        },
    })

    return (
        <RoomLayout
            session={session}
            // Leaving unmounts the chat, which disconnects the socket and
            // drops the student from the teacher's hand queue.
            onLeave={() => navigate("/")}
            controls={<RaiseHandButton raised={room.handRaised} onToggle={room.raiseHand} />}
            activity={
                <ActivityBox title="Your activity" text={room.studentText} onChange={room.setStudentText} />
            }
            chat={
                <ChatPanel
                    room={room}
                    username={session.username}
                    privateLabel={(chat) => `Private: ${chat.teacherName}`}
                />
            }
        />
    )
}
