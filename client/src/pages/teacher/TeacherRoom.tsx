import { Navigate, useNavigate, useParams } from "react-router-dom"
import ActivityBox from "../../components/chat/ActivityBox"
import ChatPanel from "../../components/chat/ChatPanel"
import RoomLayout from "../../components/chat/RoomLayout"
import { HandQueue } from "../../components/HandQueue"
import Timer from "../../components/Timer"
import { useRoomSocket } from "../../hooks/useRoomSocket"
import useAuth from "../../hooks/useAuth"
import { socket } from "../../socket"
import { Session } from "../../types"
import { normalizeRoomCode } from "../../utils/roomCode"

import { deleteRoom } from "../../api"

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

    // The activity box follows the chat on screen: the default activity in the
    // group chat, or the student's copy in a private chat.
    const activeChat = room.privateChats.find((c) => c.id === room.activeChatId)

    return (
        <RoomLayout
            session={session}
            // Leaving unmounts the chat, which disconnects the socket.
            // Change this to deleting a room later: DELETE /api/rooms/:roomcode
            onLeave={endRoom}
            bannerNote={<span className="text-gray-500"> — share this with your students</span>}
            controls={
                <>
                    <Timer
                        durationMs={room.timer.durationMs}
                        remainingMs={room.timer.remainingMs}
                        running={room.timer.running}
                        isTeacher={true}
                        onPlay={() => socket.emit("timer play")}
                        onPause={() => socket.emit("timer pause")}
                        onRestart={() => socket.emit("timer restart")}
                        onSetMinutes={(minutes) => socket.emit("timer set", { minutes })}
                    />
                    <HandQueue
                        queue={room.handQueue}
                        onLowerHand={room.lowerHand}
                        onOpenPrivateChat={room.openPrivateChat}
                    />
                </>
            }
            activity={
                <ActivityBox
                    title={activeChat ? `${activeChat.studentName}'s activity` : "Activity"}
                    text={activeChat ? room.studentActivities[activeChat.id] ?? "" : room.defaultActivity}
                    readOnly
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
    )
}
