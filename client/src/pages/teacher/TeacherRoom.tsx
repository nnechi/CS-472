import { Navigate, useNavigate, useParams } from "react-router-dom"
import TeacherParsons from "../../components/activity/TeacherParsons"
import ChatWidget from "../../components/chat/ChatWidget"
import RoomLayout from "../../components/chat/RoomLayout"
import { useRoomSocket } from "../../hooks/useRoomSocket"
import useAuth from "../../hooks/useAuth"
import { Session } from "../../types"
import { normalizeRoomCode } from "../../utils/roomCode"
import { deleteRoom } from "../../api"
import TeacherHeader from "../../components/chat/TeacherHeader"
import CodeEditor from "../../components/activity/CodeEditor"
import { HandQueue } from "../../components/HandQueue"

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

    // The activity follows the chat on screen: the current question in the
    // group chat, or the student's work on it in their private chat.
    const activeChat = room.privateChats.find((c) => c.id === room.activeChatId)
    const progress = activeChat ? room.studentProgress(activeChat.id) : undefined

    return (
        <div className="flex h-screen flex-col bg-white text-black">
            <TeacherHeader session={session} room={room} progress={progress} onLeave={endRoom} />
            <div className="px-4 py-3 sm:px-8">
                <HandQueue
                    queue={room.handQueue}
                    onLowerHand={room.lowerHand}
                    onOpenPrivateChat={room.openPrivateChat}
                />
            </div>
            <RoomLayout
                activity={room.activity?.type === "parsons" ?
                    (
                        <TeacherParsons
                            title={activeChat ? `${activeChat.studentName}'s work` : "Activity"}
                            activity={room.activity}
                            currentQuestion={room.currentQuestion}
                            progress={progress}
                        />
                    ) :
                    (
                        <CodeEditor 
                            activity={room.activity}
                            currentQuestion={room.currentQuestion}
                            role="teacher"
                            codes={room.code}
                            run={room.run}
                            onCodeChange={room.setCode}
                            onRun={room.runCode}
                            onCancel={room.cancelRun}
                        />
                    )
                }
                chat={
                    <ChatWidget
                        room={room}
                        username={session.username}
                        privateLabel={(chat) => `Private: ${chat.studentName}`}
                    />
                }
            />
        </div>
    )
}
