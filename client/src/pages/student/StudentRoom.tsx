import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import Chat from "../../components/Chat"
import { normalizeRoomCode } from "../../utils/roomCode"

// /rooms/join/:roomCode -- the student's view of a room: chat plus the
// raise-hand button. Students have no account; the name comes from the home
// page form via router state. Without a name (e.g. a shared link), send them
// back to the home page to enter one.
export default function StudentRoom() {
    const navigate = useNavigate()
    const location = useLocation()
    const { roomCode } = useParams()
    const room = normalizeRoomCode(roomCode ?? "")
    const username = (location.state as { username?: string } | null)?.username?.trim()

    if (!room || !username) return <Navigate to="/" replace />

    return (
        <Chat
            session={{ username, role: "student", room }}
            // Leaving unmounts the chat, which disconnects the socket and
            // drops the student from the teacher's hand queue.
            onLeave={() => navigate("/")}
            onRoomClosed={()=>  { 
                window.alert("Your teacher ended this room."); 
                navigate("/"); 
            }} 
            
            onJoinError = { () => { 
                window.alert("This room doesn't exist or it's expired."); 
                navigate("/"); 
            }}
        />
    )
}
