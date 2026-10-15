import { Navigate, useNavigate, useParams } from "react-router-dom"
import Chat from "../../components/Chat"
import useAuth from "../../hooks/useAuth"
import { normalizeRoomCode } from "../../utils/roomCode"

// /rooms/:roomId -- the teacher's view of a room: chat plus the raised-hand
// queue. Students who land here are sent to their own view of the same room.
export default function TeacherRoom() {
    const navigate = useNavigate()
    const { auth } = useAuth()
    const { roomId } = useParams()
    const room = normalizeRoomCode(roomId ?? "")

    if (!auth || !room) return <Navigate to="/dashboard" replace />

    return (
        <Chat
            session={{ username: auth.user.name, role: "teacher", room }}
            // Leaving unmounts the chat, which disconnects the socket.
            // Change this to deleting a room later: DELETE /api/rooms/:roomcode
            onLeave={() => navigate("/dashboard")}
        />
    )
}
