import { Navigate, useNavigate, useParams } from "react-router-dom"
import Chat from "../../components/chat/MChat"
import useAuth from "../../hooks/useAuth"
import { normalizeRoomCode } from "../../utils/roomCode"


import { deleteRoom } from "../../api"

// /rooms/:roomId -- the teacher's view of a room: chat plus the raised-hand
// queue. Students who land here are sent to their own view of the same room.
export default function TeacherRoom() {
    const navigate = useNavigate()
    const { auth } = useAuth()
    const { roomId } = useParams()
    const room = normalizeRoomCode(roomId ?? "")

    if (!auth || !room) return <Navigate to="/dashboard" replace />


    async function endRoom() {
        if (!auth || !window.confirm("End this room for everyone?")) return; 

        try { 
            const success = await deleteRoom(room, auth.user.id); 

            if (!success) console.warn("Delete did not trigger."); 

        } catch (e){ 
            console.error(e); 
        }

        navigate("/dashboard");    
    }

    return (
        <Chat
            session={{ username: auth.user.name, role: "teacher", room }}
            // Leaving unmounts the chat, which disconnects the socket.
            // Change this to deleting a room later: DELETE /api/rooms/:roomcode
            onLeave={endRoom}
            onJoinError = { () => { 
                window.alert("This room doesn't exist or it's expired."); 
                navigate("/dashboard"); 
            }}
        />
    )
}

