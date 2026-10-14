import { Navigate, useNavigate, useParams } from "react-router-dom"
import Chat from "../../components/Chat"
import useAuth from "../../hooks/useAuth"
import { normalizeRoomCode } from "../../utils/roomCode"

// /rooms/join/:roomCode -- the student's view of a room: chat plus the
// raise-hand button. Teachers who land here get their own view instead.
export default function StudentRoom() {
    const navigate = useNavigate()
    const { auth } = useAuth()
    const { roomCode } = useParams()
    const room = normalizeRoomCode(roomCode ?? "")

    if (!auth || !room) return <Navigate to="/dashboard" replace />
    if (auth.user.role !== "student") return <Navigate to={`/rooms/${room}`} replace />

    return (
        <Chat
            session={{ username: auth.user.name, role: auth.user.role, room }}
            // Leaving unmounts the chat, which disconnects the socket and
            // drops the student from the teacher's hand queue.
            onLeave={() => navigate("/dashboard")}
        />
    )
}
