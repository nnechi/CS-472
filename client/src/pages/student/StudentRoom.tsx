import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import ActivityBox from "../../components/chat/ActivityBox"
import ChatPanel from "../../components/chat/ChatPanel"
import RoomLayout from "../../components/chat/RoomLayout"
import { useRoomSocket } from "../../hooks/useRoomSocket"
import { Session } from "../../types"
import { normalizeRoomCode } from "../../utils/roomCode"
import RoomNavbar from "../../components/chat/RoomNavbar"
import StudentHeader from "../../components/chat/StudentHeader"

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
        <div className="flex h-screen flex-col">
            <RoomNavbar session={session} onLeave={() => navigate("/")} />
            <StudentHeader session={session} room={room} />
            <RoomLayout
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
        </div>
    )
}
