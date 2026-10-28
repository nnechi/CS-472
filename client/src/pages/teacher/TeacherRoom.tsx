import { Navigate, useNavigate, useParams } from "react-router-dom"
import TeacherActivity from "../../components/activity/TeacherActivity"
import ChatPanel from "../../components/chat/ChatPanel"
import RoomLayout from "../../components/chat/RoomLayout"
import { useRoomSocket } from "../../hooks/useRoomSocket"
import useAuth from "../../hooks/useAuth"
import { Session } from "../../types"
import { normalizeRoomCode } from "../../utils/roomCode"
import { deleteRoom } from "../../api"
import RoomNavbar from "../../components/chat/RoomNavbar"
import TeacherHeader from "../../components/chat/TeacherHeader"

// /rooms/:roomId -- the teacher's view of a room: the activity, the chat, the
// timer, and the raised-hand queue. Students who land here are sent to their
// own view of the same room.
export default function TeacherRoom() {
    const { auth } = useAuth()
    const { roomId } = useParams()
    const roomCode = normalizeRoomCode(roomId ?? "")

    if (!auth || !roomCode) return <Navigate to="/dashboard" replace />

    return (
        <TeacherRoomScreen
            session={{ username: auth.user.name, role: "teacher", room: roomCode }}
            hostID={auth.user.id}
        />
    )
}

// The socket is opened here, so it only runs once the sign-in check has passed.
function TeacherRoomScreen({ session, hostID }: { session: Session; hostID: string }) {
    const navigate = useNavigate()
    const room = useRoomSocket(session, {
        onJoinError: () => {
            window.alert("This room doesn't exist or it's expired.")
            navigate("/dashboard")
        },
    })

    async function endRoom() {
        if (!window.confirm("End this room for everyone?")) return

        try {
            const success = await deleteRoom(session.room, hostID)

            if (!success) console.warn("Delete did not trigger.")

        } catch (e) {
            console.error(e)
        }

        navigate("/dashboard")
    }

    // The activity follows the chat on screen: every question in the group
    // chat, or the student's work in their private chat.
    const activeChat = room.privateChats.find((c) => c.id === room.activeChatId)

    return (
        <div className="flex h-screen flex-col">
            <RoomNavbar session={session} onLeave={endRoom} />
            <TeacherHeader session={session} room={room} />
            <RoomLayout
                activity={
                    <TeacherActivity
                        title={activeChat ? `${activeChat.studentName}'s work` : "Activity"}
                        activity={room.activity}
                        progress={activeChat ? room.studentProgress(activeChat.id) : undefined}
                    />
                }
                chat={
                    <ChatPanel
                        room={room}
                        username={session.username}
                        privateLabel={(chat) => `Private: ${chat.studentName}`}
                    />
                }
            />
        </div>
    )
}
